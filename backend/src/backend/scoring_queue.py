"""Queue workers for categorization and scoring pipelines.

Workers are rate-limit-ignorant (ADR-0004): the Azure wrapper owns pause
state and raises typed exceptions. LLMUnavailable leaves work queued
without counting an attempt; LLMCallFailed counts toward MAX_TASK_RETRIES.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from slugify import slugify
from sqlmodel import Session, select

from backend.deps import TASK_CATEGORIZATION, TASK_SCORING
from backend.llm_client import (
    LLMCallFailed,
    LLMNotConfigured,
    LLMUnavailable,
    llm_client,
)
from backend.models import Article, ArticleCategoryLink, Category, UserPreferences
from backend.prompts import (
    BatchCategoryResponse,
    BatchScoringResponse,
    build_batch_categorization_prompt,
    build_batch_scoring_prompt,
)
from backend.scoring import (
    compute_composite_score,
    get_active_categories,
    get_or_create_category,
    is_blocked,
)

logger = logging.getLogger(__name__)

RESCORE_LOOKBACK_DAYS = 7
RESCORE_MAX_ARTICLES = 100
MAX_TASK_RETRIES = 3


# --- Per-task activity (consumed by the scoring status endpoint) ---


@dataclass
class TaskActivity:
    """Ephemeral in-memory activity for one pipeline task.

    Safe in single-worker asyncio — no threading concerns.
    """

    article_id: int | None = None
    phase: str = "idle"


_activity: dict[str, TaskActivity] = {
    TASK_CATEGORIZATION: TaskActivity(),
    TASK_SCORING: TaskActivity(),
}


def get_activity(task: str) -> TaskActivity:
    """Current activity for a task (copy — callers can't mutate worker state)."""
    current = _activity[task]
    return TaskActivity(article_id=current.article_id, phase=current.phase)


def _set_activity(task: str, article_id: int | None, phase: str) -> None:
    _activity[task].article_id = article_id
    _activity[task].phase = phase


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

        _set_activity(TASK_CATEGORIZATION, next(iter(batch_ids)), "categorizing")

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

        active_categories, category_hierarchy = get_active_categories(session)

        system_prompt, user_message = build_batch_categorization_prompt(
            article_dicts,
            active_categories,
            category_hierarchy=category_hierarchy,
        )

        def _requeue_batch(count_attempt: bool) -> None:
            for art in needs_cat_articles:
                if count_attempt:
                    art.categorization_attempts += 1
                if art.categorization_attempts >= MAX_TASK_RETRIES:
                    art.categorization_state = "failed"
                else:
                    art.categorization_state = "queued"
                session.add(art)
            session.commit()

        try:
            response = await llm_client.complete(
                TASK_CATEGORIZATION,
                system_prompt,
                user_message,
                BatchCategoryResponse,
            )
        except asyncio.CancelledError:
            logger.info("Categorization cancelled; re-queueing batch")
            _set_activity(TASK_CATEGORIZATION, None, "idle")
            session.rollback()
            for art in needs_cat_articles:
                art.categorization_state = "queued"
                session.add(art)
            session.commit()
            raise
        except LLMNotConfigured as e:
            _set_activity(TASK_CATEGORIZATION, None, "idle")
            logger.info("Categorization skipped: %s", e)
            session.rollback()
            for art in needs_cat_articles:
                art.categorization_state = "queued"
                session.add(art)
            session.commit()
            return len(score_only_articles)
        except LLMUnavailable as e:
            _set_activity(TASK_CATEGORIZATION, None, "idle")
            logger.warning(
                "Categorization unavailable; re-queueing (retry in %.0fs)", e.retry_in
            )
            _requeue_batch(count_attempt=False)
            return len(score_only_articles)
        except LLMCallFailed as e:
            _set_activity(TASK_CATEGORIZATION, None, "idle")
            logger.error("Categorization failed: %s", e)
            _requeue_batch(count_attempt=True)
            return len(score_only_articles)

        # Build result map, dropping hallucinated IDs
        cat_result_map = {
            result.article_id: result
            for result in response.results
            if result.article_id in batch_ids
        }
        dropped = len(response.results) - len(cat_result_map)
        if dropped:
            logger.warning(
                "Categorization returned %d result(s) with unknown article ids; dropped",
                dropped,
            )

        # Resolve categories, creating new ones flagged for triage
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

        # Replace category links for matched articles
        for aid in cat_result_map:
            old_links = session.exec(
                select(ArticleCategoryLink).where(
                    ArticleCategoryLink.article_id == aid,
                )
            ).all()
            for old_link in old_links:
                session.delete(old_link)

            for category in categories_by_article[aid]:
                link = ArticleCategoryLink(
                    article_id=aid,  # pyright: ignore[reportArgumentType]
                    category_id=category.id,  # pyright: ignore[reportArgumentType]
                )
                session.add(link)

        session.commit()

        # Route categorized articles: blocked → 'blocked', others → scoring queue
        processed = len(score_only_articles)
        for aid in batch_ids:
            art = article_map[aid]

            if aid not in cat_result_map:
                # Missing from the response — the model skipped it
                art.categorization_attempts += 1
                if art.categorization_attempts >= MAX_TASK_RETRIES:
                    art.categorization_state = "failed"
                else:
                    art.categorization_state = "queued"
                session.add(art)
                logger.warning("Article %s: no categorization result, re-queued", aid)
                continue

            cat_list = categories_by_article[aid]
            art.categorization_state = "categorized"

            if is_blocked(cat_list):
                art.interest_score = 0
                art.quality_score = 0
                art.composite_score = 0.0
                blocked_cats = ", ".join(c.display_name for c in cat_list)
                art.score_reasoning = f"Blocked: {blocked_cats}"
                art.scoring_state = "blocked"
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
        _set_activity(TASK_CATEGORIZATION, None, "idle")
        return processed


class ScoringWorker:
    """Scores categorized articles via LLM."""

    async def process_next_batch(self, session: Session, batch_size: int = 1) -> int:
        """Process next batch of articles needing scoring.

        Returns:
            Number of articles successfully scored
        """
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

        # Transition to 'scoring'
        batch_ids: set[int] = set()
        article_map: dict[int, Article] = {}
        for art in articles:
            art.scoring_state = "scoring"
            session.add(art)
            batch_ids.add(art.id)  # pyright: ignore[reportArgumentType]
            article_map[art.id] = art  # pyright: ignore[reportArgumentType]
        session.commit()

        _set_activity(TASK_SCORING, next(iter(batch_ids)), "scoring")

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

        system_prompt, user_message = build_batch_scoring_prompt(
            article_dicts,
            preferences.interests,
            preferences.anti_interests,
        )

        def _requeue_batch(count_attempt: bool) -> None:
            for art in articles:
                if count_attempt:
                    art.scoring_attempts += 1
                if art.scoring_attempts >= MAX_TASK_RETRIES:
                    art.scoring_state = "failed"
                else:
                    art.scoring_state = "queued"
                session.add(art)
            session.commit()

        try:
            response = await llm_client.complete(
                TASK_SCORING,
                system_prompt,
                user_message,
                BatchScoringResponse,
            )
        except asyncio.CancelledError:
            logger.info("Scoring cancelled; re-queueing batch")
            _set_activity(TASK_SCORING, None, "idle")
            session.rollback()
            for art in articles:
                art.scoring_state = "queued"
                session.add(art)
            session.commit()
            raise
        except LLMNotConfigured as e:
            _set_activity(TASK_SCORING, None, "idle")
            logger.info("Scoring skipped: %s", e)
            session.rollback()
            for art in articles:
                art.scoring_state = "queued"
                session.add(art)
            session.commit()
            return 0
        except LLMUnavailable as e:
            _set_activity(TASK_SCORING, None, "idle")
            logger.warning(
                "Scoring unavailable; re-queueing (retry in %.0fs)", e.retry_in
            )
            _requeue_batch(count_attempt=False)
            return 0
        except LLMCallFailed as e:
            _set_activity(TASK_SCORING, None, "idle")
            logger.error("Scoring failed: %s", e)
            _requeue_batch(count_attempt=True)
            return 0

        # Build result map, dropping hallucinated IDs
        score_result_map = {
            result.article_id: result
            for result in response.results
            if result.article_id in batch_ids
        }
        dropped = len(response.results) - len(score_result_map)
        if dropped:
            logger.warning(
                "Scoring returned %d result(s) with unknown article ids; dropped",
                dropped,
            )

        # Apply scores
        processed = 0
        for aid, scoring in score_result_map.items():
            art = article_map[aid]
            # Ranges are prompt-enforced, not schema-enforced — clamp defensively
            interest = max(0, min(10, scoring.interest_score))
            quality = max(0, min(10, scoring.quality_score))
            art.interest_score = interest
            art.quality_score = quality
            art.score_reasoning = scoring.reasoning
            art.composite_score = compute_composite_score(
                interest,
                quality,
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

        # Re-queue articles the model skipped
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
        _set_activity(TASK_SCORING, None, "idle")
        return processed
