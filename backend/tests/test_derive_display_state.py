"""Tests for _derive_display_state helper."""

from backend.models import Article
from backend.routers.articles import _derive_display_state


def _make_article(**overrides) -> Article:
    """Create an Article with pipeline-relevant defaults."""
    defaults = {
        "feed_id": 1,
        "title": "Test",
        "url": "https://example.com/test",
        "scoring_state": "unscored",
        "categorization_state": "uncategorized",
        "composite_score": None,
    }
    defaults.update(overrides)
    return Article(**defaults)


class TestDeriveDisplayState:
    def test_categorizing_returns_categorizing(self):
        article = _make_article(categorization_state="categorizing")
        state, re_eval = _derive_display_state(article)
        assert state == "categorizing"
        assert re_eval is False

    def test_categorization_queued_returns_queued(self):
        article = _make_article(categorization_state="queued")
        state, re_eval = _derive_display_state(article)
        assert state == "queued"
        assert re_eval is False

    def test_scoring_state_scoring_returns_scoring(self):
        article = _make_article(
            categorization_state="categorized", scoring_state="scoring"
        )
        state, re_eval = _derive_display_state(article)
        assert state == "scoring"
        assert re_eval is False

    def test_categorization_failed_returns_failed(self):
        article = _make_article(categorization_state="failed")
        state, re_eval = _derive_display_state(article)
        assert state == "failed"
        assert re_eval is False

    def test_re_evaluating_categorizing_with_existing_score(self):
        article = _make_article(
            categorization_state="categorizing",
            composite_score=0.8,
        )
        state, re_eval = _derive_display_state(article)
        assert state == "scored"
        assert re_eval is True

    def test_re_evaluating_scoring_with_existing_score(self):
        article = _make_article(
            categorization_state="categorized",
            scoring_state="scoring",
            composite_score=0.8,
        )
        state, re_eval = _derive_display_state(article)
        assert state == "scored"
        assert re_eval is True

    def test_fully_scored_article(self):
        article = _make_article(
            categorization_state="categorized",
            scoring_state="scored",
            composite_score=0.8,
        )
        state, re_eval = _derive_display_state(article)
        assert state == "scored"
        assert re_eval is False
