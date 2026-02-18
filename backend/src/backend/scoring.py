"""LLM-powered article scoring and categorization."""

import logging

from ollama import AsyncClient
from slugify import slugify
from sqlmodel import Session, select
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from backend.database import smart_case
from backend.models import Category
from backend.prompts import (
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


def get_or_create_category(
    session: Session,
    display_name: str,
    suggested_parent: str | None = None,
) -> Category:
    """Find existing category by slug, or create new one.

    Args:
        session: Database session
        display_name: Human-readable category name
        suggested_parent: Optional parent category display name for new categories

    Returns:
        Existing or newly created Category
    """
    slug = slugify(display_name)
    category = session.exec(
        select(Category).where(Category.slug == slug)
    ).first()
    if category:
        return category

    # Create new category
    category = Category(
        display_name=smart_case(display_name),
        slug=slug,
        is_seen=False,
    )

    # Resolve parent if suggested
    if suggested_parent:
        parent_slug = slugify(suggested_parent)
        parent = session.exec(
            select(Category).where(Category.slug == parent_slug)
        ).first()
        if parent:
            category.parent_id = parent.id

    session.add(category)
    session.flush()
    return category


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
    category_hierarchy: dict[str, list[str]] | None = None,
    hidden_categories: list[str] | None = None,
) -> CategoryResponse:
    """Categorize an article using Ollama LLM.

    Args:
        article_title: Article title
        article_text: Article content
        existing_categories: List of existing categories to reuse
        settings: Application settings with Ollama config (host, thinking)
        model: Ollama model name to use for categorization
        category_hierarchy: Optional parent-child hierarchy to guide categorization
        hidden_categories: Optional list of hidden category names to avoid

    Returns:
        CategoryResponse with assigned categories and suggestions

    Raises:
        Exception: On LLM call failure after retries
    """
    prompt = build_categorization_prompt(
        article_title, article_text, existing_categories, category_hierarchy,
        hidden_categories=hidden_categories,
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


def get_effective_weight(category: Category) -> str:
    """Resolve weight: explicit override > parent weight > 'normal'."""
    if category.weight is not None:
        return category.weight
    if category.parent_id is not None and category.parent is not None:
        if category.parent.weight is not None:
            return category.parent.weight
    return "normal"


def compute_composite_score(
    interest_score: int,
    quality_score: int,
    categories: list[Category],
) -> float:
    """Compute final composite score from interest, quality, and category weights.

    Formula: interest_score * category_multiplier * quality_multiplier
    Capped at 20.0 maximum.

    Weight resolution uses Category objects directly:
    1. category.weight (explicit override)
    2. category.parent.weight (inherited from parent)
    3. "normal" (1.0) default

    Args:
        interest_score: Interest score 0-10
        quality_score: Quality score 0-10
        categories: List of Category objects

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
        # Old names for backward compatibility
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
        weights = []
        for category in categories:
            weight_str = get_effective_weight(category)
            weights.append(weight_map.get(weight_str, 1.0))
        category_multiplier = sum(weights) / len(weights)

    # Quality multiplier: maps 0-10 to 0.5-1.0
    quality_multiplier = 0.5 + (quality_score / 10.0) * 0.5

    # Compute composite score
    composite = interest_score * category_multiplier * quality_multiplier

    # Cap at 20.0
    return min(composite, 20.0)


def is_blocked(categories: list[Category]) -> bool:
    """Check if any category is blocked or hidden.

    Args:
        categories: List of Category objects

    Returns:
        True if any category is hidden or has effective weight "block"/"blocked"
    """
    if not categories:
        return False

    for category in categories:
        if category.is_hidden:
            return True
        weight = get_effective_weight(category)
        if weight in ("blocked", "block"):
            return True

    return False


async def get_active_categories(
    session: Session,
) -> tuple[list[str], dict[str, list[str]] | None, list[str]]:
    """Get active (non-hidden) categories, hierarchy, and hidden category names.

    Args:
        session: Database session

    Returns:
        Tuple of (sorted display name list, category hierarchy dict or None, sorted hidden names)
    """
    # Query all non-hidden categories
    categories = session.exec(
        select(Category).where(Category.is_hidden == False)  # noqa: E712
    ).all()

    # Collect display names
    display_names = sorted(
        [cat.display_name for cat in categories],
        key=str.lower,
    )

    # Build hierarchy from parent-child relationships
    hierarchy: dict[str, list[str]] = {}
    for cat in categories:
        if cat.parent_id is not None and cat.parent is not None:
            parent_name = cat.parent.display_name
            if parent_name not in hierarchy:
                hierarchy[parent_name] = []
            hierarchy[parent_name].append(cat.display_name)

    # Sort children lists for consistency
    for children in hierarchy.values():
        children.sort(key=str.lower)

    # Query hidden categories
    hidden_categories = session.exec(
        select(Category).where(Category.is_hidden == True)  # noqa: E712
    ).all()
    hidden_names = sorted(
        [cat.display_name for cat in hidden_categories],
        key=str.lower,
    )

    return display_names, hierarchy if hierarchy else None, hidden_names
