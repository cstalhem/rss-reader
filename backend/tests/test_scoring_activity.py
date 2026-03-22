"""Tests for per-task activity and rate-limit tracking in scoring.py."""

from backend import scoring


def _reset_state():
    """Reset all module-level activity and rate-limit state between tests."""
    scoring._categorization_activity["article_id"] = None
    scoring._categorization_activity["phase"] = "idle"
    scoring._scoring_activity["article_id"] = None
    scoring._scoring_activity["phase"] = "idle"
    scoring._categorization_rate_limited_until = 0.0
    scoring._scoring_rate_limited_until = 0.0


# --- Categorization activity ---


class TestCategorizationActivity:
    def setup_method(self):
        _reset_state()

    def test_set_categorization_context(self):
        scoring.set_categorization_context(42)
        activity = scoring.get_categorization_activity()
        assert activity["article_id"] == 42
        assert activity["phase"] == "starting"

    def test_set_categorization_context_none_resets_to_idle(self):
        scoring.set_categorization_context(42)
        scoring.set_categorization_context(None)
        activity = scoring.get_categorization_activity()
        assert activity["article_id"] is None
        assert activity["phase"] == "idle"

    def test_set_categorization_phase(self):
        scoring.set_categorization_context(10)
        scoring.set_categorization_phase("thinking")
        activity = scoring.get_categorization_activity()
        assert activity["article_id"] == 10
        assert activity["phase"] == "thinking"

    def test_get_categorization_activity_returns_copy(self):
        scoring.set_categorization_context(5)
        copy = scoring.get_categorization_activity()
        copy["phase"] = "mutated"
        assert scoring.get_categorization_activity()["phase"] == "starting"


# --- Scoring activity (existing, still works) ---


class TestScoringActivity:
    def setup_method(self):
        _reset_state()

    def test_set_scoring_context(self):
        scoring.set_scoring_context(99)
        activity = scoring.get_scoring_activity()
        assert activity["article_id"] == 99
        assert activity["phase"] == "starting"

    def test_set_scoring_phase(self):
        scoring.set_scoring_context(99)
        scoring.set_scoring_phase("scoring")
        assert scoring.get_scoring_activity()["phase"] == "scoring"

    def test_get_scoring_activity_returns_copy(self):
        scoring.set_scoring_context(1)
        copy = scoring.get_scoring_activity()
        copy["phase"] = "mutated"
        assert scoring.get_scoring_activity()["phase"] == "starting"


# --- Per-task independence ---


class TestTaskIndependence:
    def setup_method(self):
        _reset_state()

    def test_categorization_activity_independent_from_scoring(self):
        scoring.set_categorization_context(10)
        scoring.set_categorization_phase("categorizing")
        scoring.set_scoring_context(20)
        scoring.set_scoring_phase("scoring")

        cat = scoring.get_categorization_activity()
        scr = scoring.get_scoring_activity()

        assert cat["article_id"] == 10
        assert cat["phase"] == "categorizing"
        assert scr["article_id"] == 20
        assert scr["phase"] == "scoring"

    def test_categorization_rate_limit_independent_from_scoring(self):
        scoring.set_categorization_rate_limited(10.0)
        assert scoring.is_categorization_rate_limited()
        assert not scoring.is_scoring_rate_limited()

    def test_scoring_rate_limit_independent_from_categorization(self):
        scoring.set_scoring_rate_limited(10.0)
        assert scoring.is_scoring_rate_limited()
        assert not scoring.is_categorization_rate_limited()


# --- Categorization rate-limit ---


class TestCategorizationRateLimit:
    def setup_method(self):
        _reset_state()

    def test_set_and_check_rate_limited(self):
        scoring.set_categorization_rate_limited(5.0)
        assert scoring.is_categorization_rate_limited()

    def test_remaining_positive(self):
        scoring.set_categorization_rate_limited(5.0)
        remaining = scoring.get_categorization_rate_limit_remaining()
        assert 4.0 < remaining <= 5.0

    def test_not_rate_limited_initially(self):
        assert not scoring.is_categorization_rate_limited()
        assert scoring.get_categorization_rate_limit_remaining() == 0.0


# --- Scoring rate-limit ---


class TestScoringRateLimit:
    def setup_method(self):
        _reset_state()

    def test_set_and_check_rate_limited(self):
        scoring.set_scoring_rate_limited(5.0)
        assert scoring.is_scoring_rate_limited()

    def test_remaining_positive(self):
        scoring.set_scoring_rate_limited(5.0)
        remaining = scoring.get_scoring_rate_limit_remaining()
        assert 4.0 < remaining <= 5.0

    def test_not_rate_limited_initially(self):
        assert not scoring.is_scoring_rate_limited()
        assert scoring.get_scoring_rate_limit_remaining() == 0.0


# --- Backward-compatible aliases ---


class TestBackwardCompatAliases:
    def setup_method(self):
        _reset_state()

    def test_set_rate_limited_delegates_to_scoring(self):
        scoring.set_rate_limited(5.0)
        assert scoring.is_scoring_rate_limited()

    def test_is_rate_limited_delegates_to_scoring(self):
        scoring.set_scoring_rate_limited(5.0)
        assert scoring.is_rate_limited()

    def test_get_rate_limit_remaining_delegates_to_scoring(self):
        scoring.set_scoring_rate_limited(5.0)
        assert scoring.get_rate_limit_remaining() > 0.0
