"""LLM-powered article scoring and categorization."""

import logging

from slugify import slugify
from sqlmodel import Session, select

from backend.database import smart_case
from backend.models import Category

logger = logging.getLogger(__name__)

MAX_COMPOSITE_SCORE = 20.0

# Ephemeral in-memory state for real-time phase tracking, per task.
# Safe in single-worker asyncio — no threading concerns.
# Shape: {"article_id": int | None, "phase": str}
_categorization_activity: dict = {"article_id": None, "phase": "idle"}
_scoring_activity: dict = {"article_id": None, "phase": "idle"}

# Per-task rate-limit tracking: timestamp (time.time()) until which we're throttled.
_categorization_rate_limited_until: float = 0.0
_scoring_rate_limited_until: float = 0.0


# --- Categorization activity ---


def set_categorization_context(article_id: int | None) -> None:
    """Set the article currently being categorized."""
    _categorization_activity["article_id"] = article_id
    _categorization_activity["phase"] = "starting" if article_id else "idle"


def set_categorization_phase(phase: str) -> None:
    """Set the current categorization phase without changing article_id."""
    _categorization_activity["phase"] = phase


def get_categorization_activity() -> dict:
    """Get current categorization activity state."""
    return _categorization_activity.copy()


# --- Scoring activity ---


def set_scoring_context(article_id: int | None) -> None:
    """Set the article currently being scored. Called by scoring_queue."""
    _scoring_activity["article_id"] = article_id
    _scoring_activity["phase"] = "starting" if article_id else "idle"


def set_scoring_phase(phase: str) -> None:
    """Set the current scoring phase without changing article_id."""
    _scoring_activity["phase"] = phase


def get_scoring_activity() -> dict:
    """Get current scoring activity state. Called by API endpoint."""
    return _scoring_activity.copy()


# --- Categorization rate-limit ---


def set_categorization_rate_limited(retry_after_seconds: float) -> None:
    """Record that the categorization provider is rate-limited."""
    import time

    global _categorization_rate_limited_until
    _categorization_rate_limited_until = time.time() + retry_after_seconds


def is_categorization_rate_limited() -> bool:
    """Check if categorization is currently in a rate-limit window."""
    import time

    return time.time() < _categorization_rate_limited_until


def get_categorization_rate_limit_remaining() -> float:
    """Seconds remaining in categorization rate-limit window, or 0."""
    import time

    return max(0.0, _categorization_rate_limited_until - time.time())


# --- Scoring rate-limit ---


def set_scoring_rate_limited(retry_after_seconds: float) -> None:
    """Record that the scoring provider is rate-limited."""
    import time

    global _scoring_rate_limited_until
    _scoring_rate_limited_until = time.time() + retry_after_seconds


def is_scoring_rate_limited() -> bool:
    """Check if scoring is currently in a rate-limit window."""
    import time

    return time.time() < _scoring_rate_limited_until


def get_scoring_rate_limit_remaining() -> float:
    """Seconds remaining in scoring rate-limit window, or 0."""
    import time

    return max(0.0, _scoring_rate_limited_until - time.time())


# --- Backward-compatible aliases (remove when callers are updated) ---

set_rate_limited = set_scoring_rate_limited
is_rate_limited = is_scoring_rate_limited
get_rate_limit_remaining = get_scoring_rate_limit_remaining


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
    category = session.exec(select(Category).where(Category.slug == slug)).first()
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
    return category


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
    weight_map = {
        "block": 0.0,
        "reduce": 0.5,
        "normal": 1.0,
        "boost": 1.5,
        "max": 2.0,
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

    return min(composite, MAX_COMPOSITE_SCORE)


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
        if weight == "block":
            return True

    return False


def get_active_categories(
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
            hierarchy.setdefault(cat.parent.display_name, []).append(cat.display_name)

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
