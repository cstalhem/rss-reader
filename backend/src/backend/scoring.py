"""LLM-powered article scoring and categorization."""

import logging
from datetime import datetime, timedelta

from ollama import AsyncClient
from sqlmodel import Session, select
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from backend.models import Article, UserPreferences
from backend.prompts import (
    DEFAULT_CATEGORIES,
    CategoryResponse,
    ScoringResponse,
    build_categorization_prompt,
    build_scoring_prompt,
)

logger = logging.getLogger(__name__)

# Ephemeral in-memory state for real-time scoring phase tracking.
# Safe in single-worker asyncio — no threading concerns.
_scoring_activity: dict = {"article_id": None, "phase": "idle"}


def set_scoring_context(article_id: int | None) -> None:
    """Set the article currently being scored. Called by scoring_queue."""
    _scoring_activity["article_id"] = article_id
    _scoring_activity["phase"] = "starting" if article_id else "idle"


def get_scoring_activity() -> dict:
    """Get current scoring activity state. Called by API endpoint."""
    return _scoring_activity.copy()


@retry(
    retry=retry_if_exception_type(Exception),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def categorize_article(
    article_title: str,
    article_text: str,
    existing_categories: list[str],
    settings,
    model: str,
) -> CategoryResponse:
    """Categorize an article using Ollama LLM.

    Args:
        article_title: Article title
        article_text: Article content
        existing_categories: List of existing categories to reuse
        settings: Application settings with Ollama config (host, thinking)
        model: Ollama model name to use for categorization

    Returns:
        CategoryResponse with assigned categories and suggestions

    Raises:
        Exception: On LLM call failure after retries
    """
    prompt = build_categorization_prompt(
        article_title, article_text, existing_categories
    )

    client = AsyncClient(
        host=settings.ollama.host,
        timeout=None,
    )

    # Use streaming to prevent httpx.ReadTimeout on slower models
    content = ""
    async for chunk in await client.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        format=CategoryResponse.model_json_schema(),
        options={"temperature": 0},
        stream=True,
        think=True if settings.ollama.thinking else None,
    ):
        if chunk["message"].get("thinking"):
            _scoring_activity["phase"] = "thinking"
        if chunk["message"].get("content"):
            _scoring_activity["phase"] = "categorizing"
        content += chunk["message"].get("content") or ""

    # Parse accumulated structured response
    result = CategoryResponse.model_validate_json(content)

    logger.info(
        f"Categorized article: {len(result.categories)} categories, "
        f"{len(result.suggested_new)} suggestions"
    )

    return result


@retry(
    retry=retry_if_exception_type(Exception),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
)
async def score_article(
    article_title: str,
    article_text: str,
    interests: str,
    anti_interests: str,
    settings,
    model: str,
) -> ScoringResponse:
    """Score an article's interest and quality using Ollama LLM.

    Args:
        article_title: Article title
        article_text: Article content
        interests: User's interest preferences
        anti_interests: User's anti-interest preferences
        settings: Application settings with Ollama config (host, thinking)
        model: Ollama model name to use for scoring

    Returns:
        ScoringResponse with interest/quality scores and reasoning

    Raises:
        Exception: On LLM call failure after retries
    """
    prompt = build_scoring_prompt(
        article_title, article_text, interests, anti_interests
    )

    client = AsyncClient(
        host=settings.ollama.host,
        timeout=None,
    )

    # Use streaming to prevent httpx.ReadTimeout on slower models
    content = ""
    async for chunk in await client.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        format=ScoringResponse.model_json_schema(),
        options={"temperature": 0},
        stream=True,
        think=True if settings.ollama.thinking else None,
    ):
        if chunk["message"].get("thinking"):
            _scoring_activity["phase"] = "thinking"
        if chunk["message"].get("content"):
            _scoring_activity["phase"] = "scoring"
        content += chunk["message"].get("content") or ""

    # Parse accumulated structured response
    result = ScoringResponse.model_validate_json(content)

    logger.info(
        f"Scored article: interest={result.interest_score}, "
        f"quality={result.quality_score}"
    )

    return result


def compute_composite_score(
    interest_score: int,
    quality_score: int,
    categories: list[str],
    topic_weights: dict[str, str] | None,
    category_groups: dict | None = None,
) -> float:
    """Compute final composite score from interest, quality, and topic weights.

    Formula: interest_score * category_multiplier * quality_multiplier
    Capped at 20.0 maximum.

    Weight resolution priority:
    1. topic_weights[category] -- explicit override
    2. Group weight for the group containing this category
    3. "normal" (1.0) default

    Args:
        interest_score: Interest score 0-10
        quality_score: Quality score 0-10
        categories: List of article categories
        topic_weights: User's topic weight preferences
        category_groups: Category groups structure with group-level weights

    Returns:
        Composite score (0.0-20.0)
    """
    # Weight mapping (new names + old names as fallback aliases)
    weight_map = {
        "block": 0.0,
        "reduce": 0.5,
        "normal": 1.0,
        "boost": 1.5,
        "max": 2.0,
        # Old names for backward compatibility during migration
        "blocked": 0.0,
        "low": 0.5,
        "neutral": 1.0,
        "medium": 1.5,
        "high": 2.0,
    }

    # Calculate average category multiplier
    if not categories:
        category_multiplier = 1.0
    else:
        # Build category -> group_weight lookup
        group_weights: dict[str, str] = {}
        if category_groups and "groups" in category_groups:
            for group in category_groups["groups"]:
                for cat in group.get("categories", []):
                    group_weights[cat.lower()] = group.get("weight", "normal")

        weights = []
        for category in categories:
            cat_lower = category.lower()
            # Priority 1: explicit override in topic_weights
            if topic_weights and cat_lower in topic_weights:
                weight_str = topic_weights[cat_lower]
            # Priority 2: group weight
            elif cat_lower in group_weights:
                weight_str = group_weights[cat_lower]
            # Priority 3: default
            else:
                weight_str = "normal"
            weights.append(weight_map.get(weight_str, 1.0))

        category_multiplier = sum(weights) / len(weights) if weights else 1.0

    # Quality multiplier: maps 0-10 to 0.5-1.0
    quality_multiplier = 0.5 + (quality_score / 10.0) * 0.5

    # Compute composite score
    composite = interest_score * category_multiplier * quality_multiplier

    # Cap at 20.0
    return min(composite, 20.0)


def is_blocked(
    categories: list[str],
    topic_weights: dict[str, str] | None,
    category_groups: dict | None = None,
) -> bool:
    """Check if any category in the list is blocked or hidden.

    Args:
        categories: List of article categories
        topic_weights: User's topic weight preferences
        category_groups: Category groups structure with hidden_categories

    Returns:
        True if any category has weight "block"/"blocked" or is in hidden_categories
    """
    if not categories:
        return False

    # Check hidden_categories
    if category_groups:
        hidden = category_groups.get("hidden_categories", [])
        for category in categories:
            if category.lower() in [h.lower() for h in hidden]:
                return True

    # Check topic_weights for blocked
    if topic_weights:
        for category in categories:
            weight = topic_weights.get(category.lower())
            if weight in ("blocked", "block"):
                return True

    return False


async def get_active_categories(session: Session) -> list[str]:
    """Get list of active categories from recent articles and preferences.

    Merges:
    - Unique categories from articles scored in last 30 days
    - Non-blocked categories from user preferences
    - DEFAULT_CATEGORIES

    Args:
        session: Database session

    Returns:
        Sorted, deduplicated list of categories (case-insensitive)
    """
    # Get categories from recent articles
    cutoff_date = datetime.now() - timedelta(days=30)
    recent_articles = session.exec(
        select(Article)
        .where(Article.scored_at.is_not(None))
        .where(Article.scored_at >= cutoff_date)
    ).all()

    categories_seen = {}  # lowercase -> original case

    # Collect from articles
    for article in recent_articles:
        if article.categories:
            for cat in article.categories:
                lower_cat = cat.lower()
                if lower_cat not in categories_seen:
                    categories_seen[lower_cat] = cat

    # Add non-blocked categories from preferences
    preferences = session.exec(select(UserPreferences)).first()
    if preferences and preferences.topic_weights:
        for category, weight in preferences.topic_weights.items():
            lower_cat = category.lower()
            if weight not in ("blocked", "block") and lower_cat not in categories_seen:
                categories_seen[lower_cat] = category

    # Add default categories
    for cat in DEFAULT_CATEGORIES:
        lower_cat = cat.lower()
        if lower_cat not in categories_seen:
            categories_seen[lower_cat] = cat

    # Return sorted list
    return sorted(categories_seen.values(), key=str.lower)
