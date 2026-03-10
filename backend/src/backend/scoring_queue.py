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
)

logger = logging.getLogger(__name__)

RESCORE_LOOKBACK_DAYS = 7
RESCORE_MAX_ARTICLES = 100
_DEFAULT_RATE_LIMIT_BACKOFF = 60.0  # seconds


def _extract_rate_limit_delay(exc: Exception) -> float | None:
    """If exc is a 429 rate-limit error, return retry-after seconds (or default)."""
    import re

    exc_str = str(exc)
    if "429" not in exc_str:
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

        processed = 0
        for article in articles:
            try:
                # Mark as scoring
                article.scoring_state = "scoring"
                session.add(article)
                session.commit()

                set_scoring_context(article.id)

                article_text = article.content or article.summary or ""
                skip_categorization = article.rescore_mode == "score_only"

                # Step 1: Categorize (unless score_only re-score)
                article_categories: list[Category] = []

                if skip_categorization:
                    # Load existing categories from junction table
                    article_categories = list(
                        session.exec(
                            select(Category)
                            .join(ArticleCategoryLink)
                            .where(ArticleCategoryLink.article_id == article.id)
                        ).all()
                    )
                    if article_categories:
                        logger.info(
                            f"Article {article.id}: score-only re-score, keeping existing categories"
                        )

                if not skip_categorization or not article_categories:
                    batch_input = [{"id": article.id, "title": article.title, "content_markdown": article_text}]
                    cat_results = await categorization_provider.categorize(
                        batch_input,
                        active_categories,
                        config=cat_config,
                        category_hierarchy=category_hierarchy,
                        hidden_categories=hidden_categories or None,
                    )
                    categorization = cat_results[0] if cat_results else None

                    # Phase A: Resolve categories, then commit to get IDs
                    # Use no_autoflush to prevent SELECTs from starting
                    # implicit write transactions during category lookup.
                    seen_slugs: dict[str, Category] = {}
                    with session.no_autoflush:
                        for cat_name in categorization.categories:
                            slug = slugify(cat_name)
                            if slug not in seen_slugs:
                                category = get_or_create_category(session, cat_name)
                                seen_slugs[slug] = category
                            article_categories.append(seen_slugs[slug])

                        for cat_name in categorization.suggested_new:
                            slug = slugify(cat_name)
                            if slug not in seen_slugs:
                                category = get_or_create_category(
                                    session,
                                    cat_name,
                                    suggested_parent=categorization.suggested_parent,
                                )
                                seen_slugs[slug] = category
                            article_categories.append(seen_slugs[slug])

                    session.commit()  # ~1ms: persist new categories, get IDs

                    # Phase B: Write links + unhide, then commit
                    for category in article_categories:
                        existing_link = session.exec(
                            select(ArticleCategoryLink).where(
                                ArticleCategoryLink.article_id == article.id,
                                ArticleCategoryLink.category_id == category.id,
                            )
                        ).first()
                        if not existing_link:
                            link = ArticleCategoryLink(
                                article_id=article.id,  # pyright: ignore[reportArgumentType]
                                category_id=category.id,  # pyright: ignore[reportArgumentType]
                            )
                            session.add(link)

                    if not skip_categorization:
                        for cat in article_categories:
                            if cat.is_hidden:
                                cat.is_hidden = False
                                cat.is_seen = False
                                session.add(cat)
                                logger.info(
                                    f"Article {article.id}: unhid returned category '{cat.display_name}'"
                                )

                    session.commit()  # ~1ms: persist links + unhide mutations

                # Phase C: Score with no write lock held
                # Step 2: Check if blocked
                if is_blocked(article_categories):
                    # Auto-score 0 for blocked articles
                    article.interest_score = 0
                    article.quality_score = 0
                    article.composite_score = 0.0
                    blocked_cats = ", ".join(
                        cat.display_name for cat in article_categories
                    )
                    article.score_reasoning = f"Blocked: {blocked_cats}"
                    article.scoring_state = "scored"
                    article.scored_at = datetime.now()

                    logger.info(
                        f"Article {article.id} blocked by categories: {blocked_cats}"
                    )
                else:
                    # Step 3: Score non-blocked articles
                    batch_input = [{"id": article.id, "title": article.title, "content_markdown": article_text}]
                    score_results = await scoring_provider.score(
                        batch_input,
                        preferences.interests,
                        preferences.anti_interests,
                        config=score_config,
                    )
                    scoring = score_results[0]

                    article.interest_score = scoring.interest_score
                    article.quality_score = scoring.quality_score
                    article.score_reasoning = scoring.reasoning

                    # Compute composite score
                    article.composite_score = compute_composite_score(
                        scoring.interest_score,
                        scoring.quality_score,
                        article_categories,
                    )

                    article.scoring_state = "scored"
                    article.scored_at = datetime.now()

                    logger.info(
                        f"Article {article.id} scored: "
                        f"interest={article.interest_score}, "
                        f"quality={article.quality_score}, "
                        f"composite={article.composite_score:.2f}"
                    )

                # Clear re-scoring fields
                article.scoring_priority = 0
                article.rescore_mode = None

                session.add(article)
                session.commit()
                processed += 1

            except asyncio.CancelledError:
                logger.info("Scoring cancelled for article %s; re-queueing", article.id)
                session.rollback()
                article.scoring_state = "queued"
                session.add(article)
                session.commit()
                raise
            except Exception as e:
                rate_limit_delay = _extract_rate_limit_delay(e)
                if rate_limit_delay is not None:
                    # Transient rate limit — re-queue and back off
                    logger.warning(
                        "Article %s rate-limited; re-queueing (retry in %.0fs)",
                        article.id,
                        rate_limit_delay,
                    )
                    set_rate_limited(rate_limit_delay)
                    session.rollback()
                    article.scoring_state = "queued"
                    session.add(article)
                    session.commit()
                    break  # Stop processing this batch; let next cycle retry
                else:
                    logger.error(
                        "Failed to score article %s: %s",
                        article.id,
                        e,
                        exc_info=True,
                    )
                    # Mark as failed and continue
                    article.scoring_state = "failed"
                    article.scoring_priority = 0
                    article.rescore_mode = None
                    session.add(article)
                    session.commit()
            finally:
                set_scoring_context(None)

        return processed
