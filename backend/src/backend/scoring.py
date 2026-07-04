"""Scoring domain logic: composite scores, blocking, category helpers."""

import logging

from slugify import slugify
from sqlmodel import Session, select

from backend.database import smart_case
from backend.models import Category

logger = logging.getLogger(__name__)

MAX_COMPOSITE_SCORE = 20.0

WEIGHT_MULTIPLIERS = {
    "block": 0.0,
    "reduce": 0.5,
    "normal": 1.0,
    "boost": 1.5,
    "max": 2.0,
}


def get_or_create_category(
    session: Session,
    display_name: str,
    suggested_parent: str | None = None,
) -> Category:
    """Find existing category by slug, or create new one flagged for triage.

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

    # Create new category, live immediately but flagged for user triage
    category = Category(
        display_name=smart_case(display_name),
        slug=slug,
        needs_triage=True,
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


def compute_composite_score(
    interest_score: int,
    quality_score: int,
    categories: list[Category],
) -> float:
    """Compute final composite score from interest, quality, and category weights.

    Formula: interest_score * category_multiplier * quality_multiplier
    Capped at 20.0 maximum. Weights apply directly — groups are display-only
    shelves and never affect scoring (ADR-0001).

    Args:
        interest_score: Interest score 0-10
        quality_score: Quality score 0-10
        categories: List of Category objects

    Returns:
        Composite score (0.0-20.0)
    """
    if not categories:
        category_multiplier = 1.0
    else:
        weights = [
            WEIGHT_MULTIPLIERS.get(category.weight, 1.0) for category in categories
        ]
        category_multiplier = sum(weights) / len(weights)

    # Quality multiplier: maps 0-10 to 0.5-1.0
    quality_multiplier = 0.5 + (quality_score / 10.0) * 0.5

    composite = interest_score * category_multiplier * quality_multiplier

    return min(composite, MAX_COMPOSITE_SCORE)


def is_blocked(categories: list[Category]) -> bool:
    """True if any category carries the blocked weight."""
    return any(category.weight == "block" for category in categories)


def get_active_categories(
    session: Session,
) -> tuple[list[str], dict[str, list[str]] | None]:
    """Get the full category vocabulary and its display hierarchy.

    Blocked categories stay in the vocabulary — blocking suppresses
    articles, never labels (ADR-0001).

    Returns:
        Tuple of (sorted display name list, category hierarchy dict or None)
    """
    categories = session.exec(select(Category)).all()

    display_names = sorted(
        [cat.display_name for cat in categories],
        key=str.lower,
    )

    # Build hierarchy from parent-child relationships
    hierarchy: dict[str, list[str]] = {}
    for cat in categories:
        if cat.parent_id is not None and cat.parent is not None:
            hierarchy.setdefault(cat.parent.display_name, []).append(cat.display_name)

    for children in hierarchy.values():
        children.sort(key=str.lower)

    return display_names, hierarchy if hierarchy else None
