"""Scoring domain logic: composite scores, blocking, category helpers."""

import logging
from collections.abc import Sequence

from slugify import slugify
from sqlmodel import Session, select

from backend.config import get_settings
from backend.database import smart_case
from backend.models import Category, CategoryAlias, CategoryWeight

logger = logging.getLogger(__name__)

MAX_COMPOSITE_SCORE = 20.0


def resolve_proposal(session: Session, proposed_name: str) -> Category | None:
    """Resolve a proposed category name through the proposal ladder (ADR-0001).

    slugify(proposed_name), then:
    1. Active category with that slug -> return it (no new row).
    2. CategoryAlias match -> target set: return the target category;
       target NULL: return None (discard — deleted junk stays dead).
    3. Otherwise create a normal-weight category flagged for triage.

    New categories are born ungrouped — parent_id is never set here
    (shelving belongs to auto-grouping and triage).
    """
    slug = slugify(proposed_name)

    category = session.exec(select(Category).where(Category.slug == slug)).first()
    if category:
        return category

    alias = session.exec(
        select(CategoryAlias).where(CategoryAlias.alias_slug == slug)
    ).first()
    if alias:
        if alias.target_id is None:
            return None
        target = session.get(Category, alias.target_id)
        if target is None:
            logger.warning(
                "Alias %r points at missing category id %s; treating as discard",
                slug,
                alias.target_id,
            )
        return target

    category = Category(
        display_name=smart_case(proposed_name),
        slug=slug,
        weight=CategoryWeight.NORMAL,
        needs_triage=True,
    )
    session.add(category)
    return category


def compute_composite_score(
    interest_score: int,
    quality_score: int,
    categories: list[Category],
) -> float:
    """Compute final composite score from interest, quality, and category weights.

    Formula: interest_score * category_multiplier * quality_multiplier
    Capped at 20.0 maximum. Weight multipliers come from config
    (scoring.weight_multipliers; normal/block are pinned in code).
    Weights apply directly — groups are display-only shelves and never
    affect scoring (ADR-0001).

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
        # Weight -> multiplier map from config, plus two pinned entries:
        # 'normal' is 1.0 by definition and 'block' is short-circuited via
        # is_blocked() before scoring — its 0.0 here is defense-in-depth in
        # case a blocked category ever reaches the math. Neither is
        # configurable.
        configured = get_settings().scoring.weight_multipliers
        multipliers: dict[str, float] = {
            CategoryWeight.BLOCK: 0.0,
            CategoryWeight.REDUCE: configured.reduce,
            CategoryWeight.NORMAL: 1.0,
            CategoryWeight.BOOST: configured.boost,
            CategoryWeight.MAX: configured.max,
        }
        weights = [multipliers.get(category.weight, 1.0) for category in categories]
        category_multiplier = sum(weights) / len(weights)

    # Quality multiplier: maps 0-10 to 0.5-1.0
    quality_multiplier = 0.5 + (quality_score / 10.0) * 0.5

    composite = interest_score * category_multiplier * quality_multiplier

    return min(composite, MAX_COMPOSITE_SCORE)


def is_blocked(categories: list[Category]) -> bool:
    """True if any category carries the blocked weight."""
    return any(category.weight == CategoryWeight.BLOCK for category in categories)


def load_categories(session: Session) -> Sequence[Category]:
    """Single load point for the category vocabulary, so future filters
    apply everywhere at once."""
    return session.exec(select(Category)).all()


def get_active_categories(session: Session) -> list[str]:
    """Get the full category vocabulary as a sorted display-name list.

    Blocked categories stay in the vocabulary — blocking suppresses
    articles, never labels (ADR-0001).
    """
    categories = load_categories(session)
    return sorted([cat.display_name for cat in categories], key=str.lower)


def get_category_hierarchy(session: Session) -> dict[str, list[str]] | None:
    """Get the display hierarchy (parent display name -> sorted child names).

    Groups are display-only shelves — never serialized into the
    categorization prompt (ADR-0001). Returns None when no groups exist.
    """
    categories = load_categories(session)

    hierarchy: dict[str, list[str]] = {}
    for cat in categories:
        if cat.parent_id is not None and cat.parent is not None:
            hierarchy.setdefault(cat.parent.display_name, []).append(cat.display_name)

    for children in hierarchy.values():
        children.sort(key=str.lower)

    return hierarchy if hierarchy else None
