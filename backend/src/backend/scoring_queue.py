"""Queue manager for processing article scoring in background."""

import logging
from datetime import datetime, timedelta

from sqlmodel import Session, select

from backend.config import get_settings
from backend.models import Article, UserPreferences
from backend.scoring import (
    categorize_article,
    compute_composite_score,
    get_active_categories,
    is_blocked,
    score_article,
)

logger = logging.getLogger(__name__)
settings = get_settings()


class ScoringQueue:
    """Manages the article scoring queue and processing pipeline."""

    async def enqueue_articles(
        self, session: Session, article_ids: list[int]
    ) -> int:
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

    async def process_next_batch(
        self, session: Session, batch_size: int = 1
    ) -> int:
        """Process next batch of queued articles.

        Two-step pipeline:
        1. Categorize article
        2. Score article (skip if blocked)

        Args:
            session: Database session
            batch_size: Number of articles to process

        Returns:
            Number of articles processed
        """
        # Get next batch of queued articles (oldest first)
        articles = session.exec(
            select(Article)
            .where(Article.scoring_state == "queued")
            .order_by(Article.published_at.asc())
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
                topic_weights=None,
            )
            session.add(preferences)
            session.commit()

        # Get active categories list
        active_categories = await get_active_categories(session)

        processed = 0
        for article in articles:
            try:
                # Mark as scoring
                article.scoring_state = "scoring"
                session.add(article)
                session.commit()

                # Step 1: Categorize
                article_text = article.content or article.summary or ""
                categorization = await categorize_article(
                    article.title,
                    article_text,
                    active_categories,
                    settings,
                )

                # Store categories (normalized to kebab-case)
                article.categories = [
                    cat.lower().replace("_", "-").replace(" ", "-").replace("/", "-")
                    for cat in categorization.categories
                ]

                # Step 2: Check if blocked
                if is_blocked(article.categories, preferences.topic_weights):
                    # Auto-score 0 for blocked articles
                    article.interest_score = 0
                    article.quality_score = 0
                    article.composite_score = 0.0
                    blocked_cats = ", ".join(article.categories)
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
                    )

                    article.interest_score = scoring.interest_score
                    article.quality_score = scoring.quality_score
                    article.score_reasoning = scoring.reasoning

                    # Compute composite score
                    article.composite_score = compute_composite_score(
                        scoring.interest_score,
                        scoring.quality_score,
                        article.categories,
                        preferences.topic_weights,
                    )

                    article.scoring_state = "scored"
                    article.scored_at = datetime.now()

                    logger.info(
                        f"Article {article.id} scored: "
                        f"interest={article.interest_score}, "
                        f"quality={article.quality_score}, "
                        f"composite={article.composite_score:.2f}"
                    )

                session.add(article)
                session.commit()
                processed += 1

            except Exception as e:
                logger.error(
                    f"Failed to score article {article.id}: {e}", exc_info=True
                )
                # Mark as failed and continue
                article.scoring_state = "failed"
                session.add(article)
                session.commit()

        return processed
