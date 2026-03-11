"""Queue workers for categorization and scoring pipelines."""

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
    is_categorization_rate_limited,
    is_scoring_rate_limited,
    set_categorization_context,
    set_categorization_phase,
    set_categorization_rate_limited,
    set_scoring_context,
    set_scoring_phase,
    set_scoring_rate_limited,
)

logger = logging.getLogger(__name__)

RESCORE_LOOKBACK_DAYS = 7
RESCORE_MAX_ARTICLES = 100
MAX_TASK_RETRIES = 3
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


class CategorizationWorker:
    """Categorizes articles via LLM and routes them to scoring queue."""

    def enqueue_articles(self, session: Session, article_ids: list[int]) -> int:
        """Enqueue articles for categorization.

        Sets categorization_state='queued' for articles where
        categorization_state in ('uncategorized', 'failed'). Resets attempts.

        Returns:
            Number of articles enqueued
        """
        count = 0
        for article_id in article_ids:
            article = session.get(Article, article_id)
            if article and article.categorization_state in ("uncategorized", "failed"):
                article.categorization_state = "queued"
                article.categorization_attempts = 0
                session.add(article)
                count += 1

        session.commit()
        logger.info(f"Enqueued {count} articles for categorization")
        return count

    def enqueue_recent_for_rescoring(
        self,
        session: Session,
        days: int = RESCORE_LOOKBACK_DAYS,
        max_articles: int = RESCORE_MAX_ARTICLES,
        score_only: bool = False,
    ) -> int:
        """Enqueue recent unread articles for re-scoring.

        Args:
            session: Database session
            days: Look back this many days
            max_articles: Maximum articles to re-score
            score_only: If True, skip categorization and go straight to scoring

        Returns:
            Number of articles enqueued
        """
        cutoff_date = datetime.now() - timedelta(days=days)

        articles = session.exec(
            select(Article)
            .where(~Article.is_read)  # pyright: ignore[reportArgumentType]
            .where(Article.published_at >= cutoff_date)  # pyright: ignore[reportOptionalOperand]
            .order_by(Article.published_at.desc())  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
            .limit(max_articles)
        ).all()

        count = 0
        for article in articles:
            if score_only:
                article.scoring_state = "queued"
                article.scoring_attempts = 0
                article.rescore_mode = "score_only"
            else:
                article.categorization_state = "queued"
                article.categorization_attempts = 0
            session.add(article)
            count += 1

        session.commit()
        logger.info(
            f"Enqueued {count} articles for re-scoring (score_only={score_only})"
        )
        return count

    def enqueue_single_for_rescoring(self, session: Session, article: Article) -> None:
        """Enqueue a single article for full re-scoring with high priority."""
        article.categorization_state = "queued"
        article.categorization_attempts = 0
        article.scoring_priority = 1
        session.add(article)
        session.commit()

    async def process_next_batch(self, session: Session, batch_size: int = 1) -> int:
        """Process next batch of articles needing categorization.

        Returns:
            Number of articles successfully categorized
        """
        # Check task readiness
        categorization_runtime = await evaluate_task_readiness(
            session, TASK_CATEGORIZATION
        )
        if not categorization_runtime.ready:
            logger.warning(
                "Categorization skipped: not ready (%s)",
                format_readiness_reason(categorization_runtime),
            )
            return 0

        # Check rate limit
        if is_categorization_rate_limited():
            logger.info("Categorization skipped: rate limited")
            return 0

        try:
            provider = get_provider(categorization_runtime.provider)
        except KeyError:
            logger.warning("Categorization skipped: unsupported provider")
            return 0

        # Fetch queued articles
        articles = session.exec(
            select(Article)
            .where(Article.categorization_state == "queued")
            .order_by(Article.scoring_priority.desc(), Article.published_at.asc())  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
            .limit(batch_size)
        ).all()

        if not articles:
            return 0

        # Separate score_only articles from those needing categorization
        score_only_articles: list[Article] = []
        needs_cat_articles: list[Article] = []
        for art in articles:
            if art.rescore_mode == "score_only":
                score_only_articles.append(art)
            else:
                needs_cat_articles.append(art)

        # Route score_only articles directly to scoring queue
        for art in score_only_articles:
            art.categorization_state = "categorized"
            art.scoring_state = "queued"
            art.scoring_attempts = 0
            session.add(art)
        if score_only_articles:
            session.commit()

        if not needs_cat_articles:
            return len(score_only_articles)

        # Transition to 'categorizing'
        batch_ids: set[int] = set()
        article_map: dict[int, Article] = {}
        for art in needs_cat_articles:
            art.categorization_state = "categorizing"
            session.add(art)
            batch_ids.add(art.id)  # pyright: ignore[reportArgumentType]
            article_map[art.id] = art  # pyright: ignore[reportArgumentType]
        session.commit()

        set_categorization_context(next(iter(batch_ids)))

        # Build article dicts
        article_dicts: list[dict] = []
        for art in needs_cat_articles:
            text = art.content_markdown or art.content or art.summary or ""
            article_dicts.append(
                {
                    "id": art.id,
                    "title": art.title,
                    "content_markdown": text,
                }
            )

        # Get active categories
        active_categories, category_hierarchy, hidden_categories = (
            get_active_categories(session)
        )

        from backend.llm_providers.base import ProviderTaskConfig

        cat_config = ProviderTaskConfig(
            endpoint=categorization_runtime.endpoint,
            model=categorization_runtime.model,
            thinking=categorization_runtime.thinking,
            api_key=categorization_runtime.api_key,
        )

        set_categorization_phase("categorizing")
        try:
            cat_results = await provider.categorize(
                article_dicts,
                active_categories,
                config=cat_config,
                category_hierarchy=category_hierarchy,
                hidden_categories=hidden_categories or None,
            )
        except asyncio.CancelledError:
            logger.info("Categorization cancelled; re-queueing batch")
            set_categorization_context(None)
            session.rollback()
            for art in needs_cat_articles:
                art.categorization_state = "queued"
                session.add(art)
            session.commit()
            raise
        except Exception as e:
            set_categorization_context(None)
            rate_limit_delay = _extract_rate_limit_delay(e)
            if rate_limit_delay is not None:
                logger.warning(
                    "Categorization rate-limited; re-queueing (retry in %.0fs)",
                    rate_limit_delay,
                )
                set_categorization_rate_limited(rate_limit_delay)

            else:
                logger.error("Categorization failed: %s", e, exc_info=True)

            # Increment attempts and re-queue or fail
            for art in needs_cat_articles:
                art.categorization_attempts += 1
                if art.categorization_attempts >= MAX_TASK_RETRIES:
                    art.categorization_state = "failed"
                else:
                    art.categorization_state = "queued"
                session.add(art)
            session.commit()
            return len(score_only_articles)

        # Build result map, ignoring hallucinated IDs
        cat_result_map: dict[int, object] = {}
        for result in cat_results:
            if result.article_id in batch_ids:
                cat_result_map[result.article_id] = result

        # Delete old category links and persist new ones
        categories_by_article: dict[int, list[Category]] = {
            aid: [] for aid in batch_ids
        }

        seen_slugs: dict[str, Category] = {}
        with session.no_autoflush:
            for aid, categorization in cat_result_map.items():
                for cat_name in categorization.categories:
                    slug = slugify(cat_name)
                    if slug not in seen_slugs:
                        seen_slugs[slug] = get_or_create_category(session, cat_name)
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

        # Delete old links, write new links, unhide categories
        for aid, cat_list in categories_by_article.items():
            if aid not in cat_result_map:
                continue  # unmatched — will be re-queued below

            # Delete old links for this article
            old_links = session.exec(
                select(ArticleCategoryLink).where(
                    ArticleCategoryLink.article_id == aid,
                )
            ).all()
            for old_link in old_links:
                session.delete(old_link)

            # Insert new links
            for category in cat_list:
                link = ArticleCategoryLink(
                    article_id=aid,  # pyright: ignore[reportArgumentType]
                    category_id=category.id,  # pyright: ignore[reportArgumentType]
                )
                session.add(link)

            # Unhide returned categories
            for cat in cat_list:
                if cat.is_hidden:
                    cat.is_hidden = False
                    cat.is_seen = False
                    session.add(cat)
                    logger.info(
                        f"Article {aid}: unhid returned category '{cat.display_name}'"
                    )

        session.commit()

        # Route categorized articles: blocked → scored with zero, non-blocked → scoring queue
        processed = len(score_only_articles)
        for aid, cat_list in categories_by_article.items():
            if aid not in cat_result_map:
                # No categorization result — re-queue
                art = article_map[aid]
                art.categorization_attempts += 1
                if art.categorization_attempts >= MAX_TASK_RETRIES:
                    art.categorization_state = "failed"
                else:
                    art.categorization_state = "queued"
                session.add(art)
                logger.warning("Article %s: no categorization result, re-queued", aid)
                continue

            art = article_map[aid]
            art.categorization_state = "categorized"

            if is_blocked(cat_list):
                art.interest_score = 0
                art.quality_score = 0
                art.composite_score = 0.0
                blocked_cats = ", ".join(c.display_name for c in cat_list)
                art.score_reasoning = f"Blocked: {blocked_cats}"
                art.scoring_state = "scored"
                art.scored_at = datetime.now()
                art.scoring_priority = 0
                art.rescore_mode = None
                logger.info(f"Article {aid} blocked by categories: {blocked_cats}")
            else:
                art.scoring_state = "queued"
                art.scoring_attempts = 0

            session.add(art)
            processed += 1

        session.commit()
        set_categorization_context(None)
        return processed


class ScoringWorker:
    """Scores categorized articles via LLM."""

    async def process_next_batch(self, session: Session, batch_size: int = 1) -> int:
        """Process next batch of articles needing scoring.

        Returns:
            Number of articles successfully scored
        """
        # Check task readiness
        scoring_runtime = await evaluate_task_readiness(session, TASK_SCORING)
        if not scoring_runtime.ready:
            logger.warning(
                "Scoring skipped: not ready (%s)",
                format_readiness_reason(scoring_runtime),
            )
            return 0

        # Check rate limit
        if is_scoring_rate_limited():
            logger.info("Scoring skipped: rate limited")
            return 0

        try:
            provider = get_provider(scoring_runtime.provider)
        except KeyError:
            logger.warning("Scoring skipped: unsupported provider")
            return 0

        # Fetch queued articles
        articles = session.exec(
            select(Article)
            .where(Article.scoring_state == "queued")
            .order_by(Article.scoring_priority.desc(), Article.published_at.asc())  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
            .limit(batch_size)
        ).all()

        if not articles:
            return 0

        # Load preferences
        preferences = session.exec(select(UserPreferences)).first()
        if not preferences:
            preferences = UserPreferences(interests="", anti_interests="")
            session.add(preferences)
            session.commit()

        from backend.llm_providers.base import ProviderTaskConfig

        score_config = ProviderTaskConfig(
            endpoint=scoring_runtime.endpoint,
            model=scoring_runtime.model,
            thinking=scoring_runtime.thinking,
            api_key=scoring_runtime.api_key,
        )
        if score_config.model is None:
            logger.warning("Scoring skipped: unresolved provider configuration")
            return 0

        # Transition to 'scoring'
        batch_ids: set[int] = set()
        article_map: dict[int, Article] = {}
        for art in articles:
            art.scoring_state = "scoring"
            session.add(art)
            batch_ids.add(art.id)  # pyright: ignore[reportArgumentType]
            article_map[art.id] = art  # pyright: ignore[reportArgumentType]
        session.commit()

        set_scoring_context(next(iter(batch_ids)))

        # Build article dicts
        article_dicts: list[dict] = []
        for art in articles:
            text = art.content_markdown or art.content or art.summary or ""
            article_dicts.append(
                {
                    "id": art.id,
                    "title": art.title,
                    "content_markdown": text,
                }
            )

        # Load categories from DB for each article
        categories_by_article: dict[int, list[Category]] = {}
        for aid in batch_ids:
            cats = list(
                session.exec(
                    select(Category)
                    .join(ArticleCategoryLink)
                    .where(ArticleCategoryLink.article_id == aid)
                ).all()
            )
            categories_by_article[aid] = cats

        set_scoring_phase("scoring")
        try:
            score_results = await provider.score(
                article_dicts,
                preferences.interests,
                preferences.anti_interests,
                config=score_config,
            )
        except asyncio.CancelledError:
            logger.info("Scoring cancelled; re-queueing batch")
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
                    "Scoring rate-limited; re-queueing (retry in %.0fs)",
                    rate_limit_delay,
                )
                set_scoring_rate_limited(rate_limit_delay)
            else:
                logger.error("Scoring failed: %s", e, exc_info=True)

            # Increment attempts and re-queue or fail
            for art in articles:
                art.scoring_attempts += 1
                if art.scoring_attempts >= MAX_TASK_RETRIES:
                    art.scoring_state = "failed"
                else:
                    art.scoring_state = "queued"
                session.add(art)
            session.commit()
            return 0

        # Build result map, ignoring hallucinated IDs
        score_result_map: dict[int, object] = {}
        for result in score_results:
            if result.article_id in batch_ids:
                score_result_map[result.article_id] = result

        # Apply scores
        processed = 0
        for aid, scoring in score_result_map.items():
            art = article_map[aid]
            art.interest_score = scoring.interest_score
            art.quality_score = scoring.quality_score
            art.score_reasoning = scoring.reasoning
            art.composite_score = compute_composite_score(
                scoring.interest_score,
                scoring.quality_score,
                categories_by_article.get(aid, []),
            )
            art.scoring_state = "scored"
            art.scored_at = datetime.now()
            art.scoring_priority = 0
            art.scoring_attempts = 0
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
        for aid in batch_ids:
            if aid not in score_result_map:
                art = article_map[aid]
                art.scoring_attempts += 1
                if art.scoring_attempts >= MAX_TASK_RETRIES:
                    art.scoring_state = "failed"
                else:
                    art.scoring_state = "queued"
                session.add(art)
                logger.warning("Article %s: no score result, re-queued", aid)

        session.commit()
        set_scoring_context(None)
        return processed
