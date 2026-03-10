"""Queue manager for processing article scoring in background."""

import asyncio
import logging
from datetime import datetime, timedelta

from slugify import slugify
from sqlmodel import Session, select

from backend.deps import (
    TASK_CATEGORIZATION,
    TASK_SCORING,
    evaluate_task_readiness,
    format_readiness_reason,
)
from backend.llm_providers.registry import get_provider
from backend.models import Article, ArticleCategoryLink, Category, UserPreferences
from backend.scoring import (
    compute_composite_score,
    get_active_categories,
    get_or_create_category,
    is_blocked,
    set_rate_limited,
    set_scoring_context,
    set_scoring_phase,
)

logger = logging.getLogger(__name__)

RESCORE_LOOKBACK_DAYS = 7
RESCORE_MAX_ARTICLES = 100
_DEFAULT_RATE_LIMIT_BACKOFF = 60.0  # seconds


def _extract_rate_limit_delay(exc: Exception) -> float | None:
    """If exc is a transient server error (429/503), return retry-after seconds (or default)."""
    import re

    exc_str = str(exc)
    # Treat both 429 (rate limit) and 503 (service unavailable/high demand) as transient
    if "429" not in exc_str and "503" not in exc_str:
        return None
    # Try to extract retryDelay from Google-style error messages
    match = re.search(r"retryDelay.*?(\d+(?:\.\d+)?)s", exc_str)
    if match:
        return float(match.group(1))
    return _DEFAULT_RATE_LIMIT_BACKOFF


class ScoringQueue:
    """Manages the article scoring queue and processing pipeline."""

    def enqueue_articles(self, session: Session, article_ids: list[int]) -> int:
        """Enqueue articles for scoring.

        Args:
            session: Database session
            article_ids: List of article IDs to enqueue

        Returns:
            Number of articles enqueued
        """
        count = 0
        for article_id in article_ids:
            article = session.get(Article, article_id)
            if article and article.scoring_state in ["unscored", "failed"]:
                article.scoring_state = "queued"
                session.add(article)
                count += 1

        session.commit()
        logger.info(f"Enqueued {count} articles for scoring")
        return count

    def enqueue_recent_for_rescoring(
        self,
        session: Session,
        days: int = RESCORE_LOOKBACK_DAYS,
        max_articles: int = RESCORE_MAX_ARTICLES,
    ) -> int:
        """Enqueue recent unread articles for re-scoring.

        Called when user preferences change.

        Args:
            session: Database session
            days: Look back this many days
            max_articles: Maximum articles to re-score

        Returns:
            Number of articles enqueued for re-scoring
        """
        cutoff_date = datetime.now() - timedelta(days=days)

        # Find unread articles from last N days
        articles = session.exec(
            select(Article)
            .where(~Article.is_read)  # pyright: ignore[reportArgumentType]
            .where(Article.published_at >= cutoff_date)  # pyright: ignore[reportOptionalOperand]
            .order_by(Article.published_at.desc())  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
            .limit(max_articles)
        ).all()

        count = 0
        for article in articles:
            article.scoring_state = "queued"
            session.add(article)
            count += 1

        session.commit()
        logger.info(f"Enqueued {count} articles for re-scoring")
        return count

    async def process_next_batch(self, session: Session, batch_size: int = 1) -> int:
        """Process next batch of queued articles.

        Two-step pipeline:
        1. Categorize article (skip if rescore_mode == "score_only")
        2. Score article (skip if blocked)

        Task provider/model/endpoint are resolved from task routes and provider configs.

        Args:
            session: Database session
            batch_size: Number of articles to process

        Returns:
            Number of articles processed
        """
        categorization_runtime = await evaluate_task_readiness(
            session, TASK_CATEGORIZATION
        )
        if not categorization_runtime.ready:
            logger.warning(
                "Scoring skipped: categorization not ready (%s)",
                format_readiness_reason(categorization_runtime),
            )
            return 0

        scoring_runtime = await evaluate_task_readiness(session, TASK_SCORING)
        if not scoring_runtime.ready:
            logger.warning(
                "Scoring skipped: scoring not ready (%s)",
                format_readiness_reason(scoring_runtime),
            )
            return 0

        try:
            categorization_provider = get_provider(categorization_runtime.provider)
            scoring_provider = get_provider(scoring_runtime.provider)
        except KeyError:
            logger.warning("Scoring skipped: unsupported configured provider")
            return 0

        # Get next batch -- priority articles first, then oldest
        articles = session.exec(
            select(Article)
            .where(Article.scoring_state == "queued")
            .order_by(Article.scoring_priority.desc(), Article.published_at.asc())  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
            .limit(batch_size)
        ).all()

        if not articles:
            return 0

        # Load preferences once for the batch
        preferences = session.exec(select(UserPreferences)).first()
        if not preferences:
            # Create default preferences
            preferences = UserPreferences(
                interests="",
                anti_interests="",
            )
            session.add(preferences)
            session.commit()

        from backend.llm_providers.base import ProviderTaskConfig

        cat_config = ProviderTaskConfig(
            endpoint=categorization_runtime.endpoint,
            model=categorization_runtime.model,
            thinking=categorization_runtime.thinking,
            api_key=categorization_runtime.api_key,
        )
        score_config = ProviderTaskConfig(
            endpoint=scoring_runtime.endpoint,
            model=scoring_runtime.model,
            thinking=scoring_runtime.thinking,
            api_key=scoring_runtime.api_key,
        )
        if cat_config.model is None or score_config.model is None:
            logger.warning("Scoring skipped: unresolved provider runtime configuration")
            return 0

        # Get active categories list, hierarchy, and hidden categories
        active_categories, category_hierarchy, hidden_categories = (
            get_active_categories(session)
        )

        # --- Step 1: Transition ALL to "scoring" ---
        batch_ids: set[int] = set()
        article_map: dict[int, Article] = {}
        for article in articles:
            article.scoring_state = "scoring"
            session.add(article)
            batch_ids.add(article.id)  # pyright: ignore[reportArgumentType]
            article_map[article.id] = article  # pyright: ignore[reportArgumentType]
        session.commit()

        # Signal batch is active (no single article — frontend shows phase on all)
        set_scoring_context(next(iter(batch_ids)))

        # --- Step 2: Build article dicts ---
        article_dicts: dict[int, dict] = {}
        for article in articles:
            text = article.content_markdown or article.content or article.summary or ""
            article_dicts[article.id] = {  # pyright: ignore[reportArgumentType]
                "id": article.id,
                "title": article.title,
                "content_markdown": text,
            }

        # --- Step 3: Categorize batch ---
        # Split: score_only articles vs articles needing categorization
        score_only_ids: set[int] = set()
        needs_cat_ids: set[int] = set()
        # article_id -> list[Category]
        categories_by_article: dict[int, list[Category]] = {
            aid: [] for aid in batch_ids
        }

        for aid in batch_ids:
            art = article_map[aid]
            if art.rescore_mode == "score_only":
                existing_cats = list(
                    session.exec(
                        select(Category)
                        .join(ArticleCategoryLink)
                        .where(ArticleCategoryLink.article_id == aid)
                    ).all()
                )
                if existing_cats:
                    score_only_ids.add(aid)
                    categories_by_article[aid] = existing_cats
                    logger.info(
                        f"Article {aid}: score-only re-score, keeping existing categories"
                    )
                else:
                    needs_cat_ids.add(aid)
            else:
                needs_cat_ids.add(aid)

        requeued_ids: set[int] = set()

        if needs_cat_ids:
            cat_input = [article_dicts[aid] for aid in sorted(needs_cat_ids)]
            set_scoring_phase("categorizing")
            try:
                cat_results = await categorization_provider.categorize(
                    cat_input,
                    active_categories,
                    config=cat_config,
                    category_hierarchy=category_hierarchy,
                    hidden_categories=hidden_categories or None,
                )
            except asyncio.CancelledError:
                logger.info("Scoring cancelled during categorization; re-queueing batch")
                set_scoring_context(None)
                session.rollback()
                for art in articles:
                    art.scoring_state = "queued"
                    session.add(art)
                session.commit()
                raise
            except Exception as e:
                set_scoring_context(None)
                rate_limit_delay = _extract_rate_limit_delay(e)
                if rate_limit_delay is not None:
                    logger.warning(
                        "Categorization rate-limited; re-queueing batch (retry in %.0fs)",
                        rate_limit_delay,
                    )
                    set_rate_limited(rate_limit_delay)
                else:
                    logger.error("Categorization failed: %s", e, exc_info=True)
                # Re-queue all articles
                for art in articles:
                    art.scoring_state = "queued"
                    session.add(art)
                session.commit()
                return 0

            # Build result map, ignoring hallucinated IDs
            cat_result_map: dict[int, object] = {}
            for result in cat_results:
                if result.article_id in needs_cat_ids:
                    cat_result_map[result.article_id] = result

            # Process matched results
            seen_slugs: dict[str, Category] = {}
            with session.no_autoflush:
                for aid, categorization in cat_result_map.items():
                    for cat_name in categorization.categories:
                        slug = slugify(cat_name)
                        if slug not in seen_slugs:
                            seen_slugs[slug] = get_or_create_category(
                                session, cat_name
                            )
                        categories_by_article[aid].append(seen_slugs[slug])

                    for cat_name in categorization.suggested_new:
                        slug = slugify(cat_name)
                        if slug not in seen_slugs:
                            seen_slugs[slug] = get_or_create_category(
                                session,
                                cat_name,
                                suggested_parent=categorization.suggested_parent,
                            )
                        categories_by_article[aid].append(seen_slugs[slug])

            session.commit()  # persist new categories, get IDs

            # Write links + unhide
            for aid, cat_list in categories_by_article.items():
                if aid not in cat_result_map and aid in needs_cat_ids:
                    continue  # unmatched — will be re-queued below
                for category in cat_list:
                    existing_link = session.exec(
                        select(ArticleCategoryLink).where(
                            ArticleCategoryLink.article_id == aid,
                            ArticleCategoryLink.category_id == category.id,
                        )
                    ).first()
                    if not existing_link:
                        link = ArticleCategoryLink(
                            article_id=aid,  # pyright: ignore[reportArgumentType]
                            category_id=category.id,  # pyright: ignore[reportArgumentType]
                        )
                        session.add(link)

                if aid not in score_only_ids:
                    for cat in cat_list:
                        if cat.is_hidden:
                            cat.is_hidden = False
                            cat.is_seen = False
                            session.add(cat)
                            logger.info(
                                f"Article {aid}: unhid returned category '{cat.display_name}'"
                            )

            session.commit()  # persist links + unhide mutations

            # Re-queue articles that got no categorization result
            for aid in needs_cat_ids:
                if aid not in cat_result_map:
                    requeued_ids.add(aid)
                    art = article_map[aid]
                    art.scoring_state = "queued"
                    session.add(art)
                    logger.warning(
                        "Article %s: no categorization result, re-queued", aid
                    )
            if requeued_ids:
                session.commit()

        # --- Step 4: Score batch ---
        # Determine which articles to score vs block vs skip (re-queued)
        blocked_ids: set[int] = set()
        scoreable_ids: set[int] = set()

        for aid in batch_ids:
            if aid in requeued_ids:
                continue
            cat_list = categories_by_article[aid]
            if is_blocked(cat_list):
                blocked_ids.add(aid)
                art = article_map[aid]
                art.interest_score = 0
                art.quality_score = 0
                art.composite_score = 0.0
                blocked_cats = ", ".join(c.display_name for c in cat_list)
                art.score_reasoning = f"Blocked: {blocked_cats}"
                art.scoring_state = "scored"
                art.scored_at = datetime.now()
                art.scoring_priority = 0
                art.rescore_mode = None
                session.add(art)
                logger.info(f"Article {aid} blocked by categories: {blocked_cats}")
            else:
                scoreable_ids.add(aid)

        if blocked_ids:
            session.commit()

        processed = len(blocked_ids)

        if scoreable_ids:
            score_input = [article_dicts[aid] for aid in sorted(scoreable_ids)]
            set_scoring_phase("scoring")
            try:
                score_results = await scoring_provider.score(
                    score_input,
                    preferences.interests,
                    preferences.anti_interests,
                    config=score_config,
                )
            except asyncio.CancelledError:
                logger.info("Scoring cancelled during score step; re-queueing")
                set_scoring_context(None)
                session.rollback()
                for aid in scoreable_ids:
                    art = article_map[aid]
                    art.scoring_state = "queued"
                    session.add(art)
                session.commit()
                raise
            except Exception as e:
                set_scoring_context(None)
                rate_limit_delay = _extract_rate_limit_delay(e)
                if rate_limit_delay is not None:
                    logger.warning(
                        "Scoring rate-limited; re-queueing unscored (retry in %.0fs)",
                        rate_limit_delay,
                    )
                    set_rate_limited(rate_limit_delay)
                else:
                    logger.error("Scoring failed: %s", e, exc_info=True)
                # Re-queue unscored articles (categories are already committed)
                for aid in scoreable_ids:
                    art = article_map[aid]
                    art.scoring_state = "queued"
                    session.add(art)
                session.commit()
                return processed

            # Build result map, ignoring hallucinated IDs
            score_result_map: dict[int, object] = {}
            for result in score_results:
                if result.article_id in scoreable_ids:
                    score_result_map[result.article_id] = result

            # Apply scores for matched results
            for aid, scoring in score_result_map.items():
                art = article_map[aid]
                art.interest_score = scoring.interest_score
                art.quality_score = scoring.quality_score
                art.score_reasoning = scoring.reasoning
                art.composite_score = compute_composite_score(
                    scoring.interest_score,
                    scoring.quality_score,
                    categories_by_article[aid],
                )
                art.scoring_state = "scored"
                art.scored_at = datetime.now()
                art.scoring_priority = 0
                art.rescore_mode = None
                session.add(art)
                logger.info(
                    f"Article {aid} scored: "
                    f"interest={art.interest_score}, "
                    f"quality={art.quality_score}, "
                    f"composite={art.composite_score:.2f}"
                )
                processed += 1

            # Re-queue articles with no score result
            for aid in scoreable_ids:
                if aid not in score_result_map:
                    art = article_map[aid]
                    art.scoring_state = "queued"
                    session.add(art)
                    logger.warning(
                        "Article %s: no score result, re-queued", aid
                    )

            session.commit()

        set_scoring_context(None)
        return processed
