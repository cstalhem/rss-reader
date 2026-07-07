"""Unit tests for scoring pure functions (no DB needed)."""

import pytest

from backend.config import get_settings
from backend.models import Category
from backend.scoring import compute_composite_score, is_blocked


def _make_category(weight: str = "normal") -> Category:
    """Create a Category object without DB."""
    return Category(
        id=1,
        display_name="test",
        slug="test",
        weight=weight,
    )


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


def test_composite_score_boost_weight():
    """Boost weight: interest * 1.5 * quality_mult."""
    cat = _make_category(weight="boost")
    # quality=10 -> quality_mult = 1.0
    score = compute_composite_score(8, 10, [cat])
    assert score == 8 * 1.5 * 1.0


def test_composite_score_reduce_weight():
    """Reduce weight: interest * 0.5 * quality_mult (default multiplier)."""
    cat = _make_category(weight="reduce")
    # quality=10 -> quality_mult = 1.0
    score = compute_composite_score(8, 10, [cat])
    assert score == 8 * 0.5 * 1.0


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


def test_composite_score_parent_weight_never_inherited():
    """Groups are display-only (ADR-0001): a child's own weight is what counts."""
    parent = _make_category(weight="block")
    child = Category(
        id=2, display_name="child", slug="child", weight="normal", parent_id=1
    )
    child.parent = parent  # type: ignore[assignment]
    score = compute_composite_score(8, 10, [child])
    assert score == 8 * 1.0 * 1.0


# --- config-driven multipliers ---


@pytest.fixture
def custom_boost_multiplier(monkeypatch: pytest.MonkeyPatch):
    """Override scoring.weight_multipliers.boost via env, clearing the
    settings cache so the override is visible and reverted afterwards."""
    monkeypatch.setenv("SCORING__WEIGHT_MULTIPLIERS__BOOST", "3.0")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_composite_score_uses_config_boost(custom_boost_multiplier):
    """Boost multiplier comes from config, not a hardcoded table."""
    cat = _make_category(weight="boost")
    # quality=10 -> quality_mult = 1.0; boost overridden to 3.0
    score = compute_composite_score(4, 10, [cat])
    assert score == 4 * 3.0 * 1.0


# --- is_blocked ---


def test_is_blocked_block_weight():
    """Category with weight='block' -> True."""
    cat = _make_category(weight="block")
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


def test_is_blocked_ignores_parent_weight():
    """A blocked parent never blocks its children (display-only groups)."""
    parent = _make_category(weight="block")
    child = Category(
        id=2, display_name="child", slug="child", weight="normal", parent_id=1
    )
    child.parent = parent  # type: ignore[assignment]
    assert is_blocked([child]) is False
