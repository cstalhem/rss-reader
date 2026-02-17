"""Queue manager for processing article scoring in background."""

import logging
from datetime import datetime, timedelta

from sqlmodel import Session, select

from backend.config import get_settings
from backend.models import Article, ArticleCategoryLink, Category, UserPreferences
from backend.scoring import (
    categorize_article,
    compute_composite_score,
    get_active_categories,
    get_or_create_category,
    is_blocked,
    score_article,
    set_scoring_context,
)

logger = logging.getLogger(__name__)
settings = get_settings()


class ScoringQueue:
    """Manages the article scoring queue and processing pipeline."""

    async def enqueue_articles(self, session: Session, article_ids: list[int]) -> int:
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

    async def enqueue_recent_for_rescoring(
        self,
        session: Session,
        days: int = 7,
        max_articles: int = 100,
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
            .where(~Article.is_read)
            .where(Article.published_at >= cutoff_date)
            .order_by(Article.published_at.desc())
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

        Model names are read from UserPreferences per-batch (two-tier config).
        Infrastructure settings (host, thinking) still come from Pydantic Settings.

        Args:
            session: Database session
            batch_size: Number of articles to process

        Returns:
            Number of articles processed
        """
        # Get next batch -- priority articles first, then oldest
        articles = session.exec(
            select(Article)
            .where(Article.scoring_state == "queued")
            .order_by(Article.scoring_priority.desc(), Article.published_at.asc())
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

        # Resolve model names: UserPreferences overrides -> YAML/env defaults
        categorization_model = (
            preferences.ollama_categorization_model
            or settings.ollama.categorization_model
        )
        if preferences.ollama_use_separate_models:
            scoring_model = (
                preferences.ollama_scoring_model or settings.ollama.scoring_model
            )
        else:
            scoring_model = categorization_model

        # Get active categories list and hierarchy
        active_categories, category_hierarchy = await get_active_categories(session)

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
                    categorization = await categorize_article(
                        article.title,
                        article_text,
                        active_categories,
                        settings,
                        model=categorization_model,
                        category_hierarchy=category_hierarchy,
                    )

                    # Create/find categories and write junction table links
                    for cat_name in categorization.categories:
                        category = get_or_create_category(session, cat_name)
                        article_categories.append(category)

                    for cat_name in categorization.suggested_new:
                        category = get_or_create_category(
                            session,
                            cat_name,
                            suggested_parent=categorization.suggested_parent,
                        )
                        article_categories.append(category)

                    # Write ArticleCategoryLink rows (skip if already exists)
                    for category in article_categories:
                        existing_link = session.exec(
                            select(ArticleCategoryLink).where(
                                ArticleCategoryLink.article_id == article.id,
                                ArticleCategoryLink.category_id == category.id,
                            )
                        ).first()
                        if not existing_link:
                            link = ArticleCategoryLink(
                                article_id=article.id,
                                category_id=category.id,
                            )
                            session.add(link)

                    session.flush()

                # Step 1.5: Handle returned hidden categories
                if not skip_categorization and article_categories:
                    for cat in article_categories:
                        if cat.is_hidden:
                            # Category reappeared -- unhide it and mark unseen
                            cat.is_hidden = False
                            cat.is_seen = False
                            session.add(cat)
                            logger.info(
                                f"Article {article.id}: unhid returned category '{cat.display_name}'"
                            )
                    session.flush()

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
                    scoring = await score_article(
                        article.title,
                        article_text,
                        preferences.interests,
                        preferences.anti_interests,
                        settings,
                        model=scoring_model,
                    )

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

            except Exception as e:
                logger.error(
                    f"Failed to score article {article.id}: {e}", exc_info=True
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
