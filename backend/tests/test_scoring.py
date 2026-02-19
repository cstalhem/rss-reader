"""Unit tests for scoring pure functions (no DB needed)."""

from backend.models import Category
from backend.scoring import compute_composite_score, get_effective_weight, is_blocked


def _make_category(
    weight: str | None = None,
    is_hidden: bool = False,
    parent: Category | None = None,
) -> Category:
    """Create a Category object without DB, setting parent relationship manually."""
    cat = Category(
        id=1,
        display_name="test",
        slug="test",
        weight=weight,
        is_hidden=is_hidden,
        parent_id=parent.id if parent else None,
    )
    # Manually set the parent relationship for weight inheritance
    cat.parent = parent  # type: ignore[assignment]
    return cat


# --- get_effective_weight ---


def test_effective_weight_explicit():
    """Explicit weight on category returns that weight."""
    cat = _make_category(weight="boost")
    assert get_effective_weight(cat) == "boost"


def test_effective_weight_inherits_parent():
    """No explicit weight, parent has weight -> returns parent weight."""
    parent = _make_category(weight="reduce")
    child = _make_category(parent=parent)
    assert get_effective_weight(child) == "reduce"


def test_effective_weight_no_parent():
    """No explicit weight, no parent -> returns 'normal'."""
    cat = _make_category()
    assert get_effective_weight(cat) == "normal"


def test_effective_weight_parent_no_weight():
    """No explicit weight, parent has no weight -> returns 'normal'."""
    parent = _make_category(weight=None)
    child = _make_category(parent=parent)
    assert get_effective_weight(child) == "normal"


# --- compute_composite_score ---


def test_composite_score_normal_weight():
    """Normal weight: interest(8) * category(1.0) * quality_mult."""
    cat = _make_category(weight="normal")
    # quality=7 -> quality_mult = 0.5 + (7/10)*0.5 = 0.85
    score = compute_composite_score(8, 7, [cat])
    assert score == 8 * 1.0 * 0.85


def test_composite_score_block_weight():
    """Block weight: returns 0.0 regardless of scores."""
    cat = _make_category(weight="block")
    score = compute_composite_score(10, 10, [cat])
    assert score == 0.0


def test_composite_score_capped_at_max():
    """Max weight: high scores capped at 20.0."""
    cat = _make_category(weight="max")
    # interest=10, quality=10 -> 10 * 2.0 * 1.0 = 20.0
    score = compute_composite_score(10, 10, [cat])
    assert score == 20.0

    # Even higher theoretical value still caps at 20.0
    cat2 = _make_category(weight="max")
    score2 = compute_composite_score(10, 10, [cat2])
    assert score2 <= 20.0


def test_composite_score_boost_weight():
    """Boost weight: interest * 1.5 * quality_mult."""
    cat = _make_category(weight="boost")
    # quality=10 -> quality_mult = 1.0
    score = compute_composite_score(8, 10, [cat])
    assert score == 8 * 1.5 * 1.0


def test_composite_score_empty_categories():
    """No categories: uses default multiplier 1.0."""
    score = compute_composite_score(8, 7, [])
    # 8 * 1.0 * 0.85 = 6.8
    assert score == 8 * 1.0 * (0.5 + 7 / 10.0 * 0.5)


def test_composite_score_multiple_categories():
    """Multiple categories: uses average weight multiplier."""
    normal = _make_category(weight="normal")
    boost = _make_category(weight="boost")
    # avg = (1.0 + 1.5) / 2 = 1.25, quality=10 -> mult=1.0
    score = compute_composite_score(8, 10, [normal, boost])
    assert score == 8 * 1.25 * 1.0


# --- is_blocked ---


def test_is_blocked_block_weight():
    """Category with weight='block' -> True."""
    cat = _make_category(weight="block")
    assert is_blocked([cat]) is True


def test_is_blocked_hidden():
    """Category with is_hidden=True -> True."""
    cat = _make_category(is_hidden=True)
    assert is_blocked([cat]) is True


def test_is_blocked_normal():
    """Category with weight='normal' -> False."""
    cat = _make_category(weight="normal")
    assert is_blocked([cat]) is False


def test_is_blocked_empty():
    """Empty category list -> False."""
    assert is_blocked([]) is False


def test_is_blocked_mixed():
    """Mixed: one blocked, one normal -> True (any blocked = blocked)."""
    normal = _make_category(weight="normal")
    blocked = _make_category(weight="block")
    assert is_blocked([normal, blocked]) is True
