"""Tests for article display state derivation and scoring status per-worker detail."""

from unittest.mock import patch


def test_first_time_categorizing_article_shows_as_scoring(
    test_client, test_engine, make_feed, make_article
):
    """Article with categorization_state='queued', composite_score=None shows scoring_state='scoring'."""
    feed = make_feed()
    make_article(
        feed.id,
        categorization_state="queued",
        scoring_state="unscored",
        composite_score=None,
    )

    resp = test_client.get("/api/articles", params={"scoring_state": "pending"})
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["scoring_state"] == "scoring"
    assert items[0]["re_evaluating"] is False


def test_re_evaluating_article_shows_as_scored(
    test_client, test_engine, make_feed, make_article
):
    """Article with categorization_state='queued', composite_score=15.0 shows scored + re_evaluating."""
    feed = make_feed()
    make_article(
        feed.id,
        categorization_state="queued",
        scoring_state="scored",
        composite_score=15.0,
    )

    # Should show up in the default (scored) list, not pending
    resp = test_client.get("/api/articles")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["scoring_state"] == "scored"
    assert items[0]["re_evaluating"] is True


def test_categorization_failed_shows_as_failed(
    test_client, test_engine, make_feed, make_article
):
    """categorization_state='failed' maps to scoring_state='failed' in API response."""
    feed = make_feed()
    make_article(
        feed.id,
        categorization_state="failed",
        scoring_state="unscored",
        composite_score=None,
    )

    resp = test_client.get("/api/articles", params={"scoring_state": "failed"})
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["scoring_state"] == "failed"


def test_pending_filter_excludes_re_evaluating(
    test_client, test_engine, make_feed, make_article
):
    """Re-evaluating articles (have composite_score) must NOT appear in pending filter."""
    feed = make_feed()
    # First-time article — should appear in pending
    make_article(
        feed.id,
        categorization_state="queued",
        scoring_state="unscored",
        composite_score=None,
        title="First Timer",
    )
    # Re-evaluating article — should NOT appear in pending
    make_article(
        feed.id,
        categorization_state="queued",
        scoring_state="scored",
        composite_score=15.0,
        title="Re-evaluating",
    )

    resp = test_client.get("/api/articles", params={"scoring_state": "pending"})
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["title"] == "First Timer"


def test_failed_filter_shows_both_cat_and_scoring_failures(
    test_client, test_engine, make_feed, make_article
):
    """Failed filter returns articles with either categorization or scoring failure."""
    feed = make_feed()
    make_article(
        feed.id,
        categorization_state="failed",
        scoring_state="unscored",
        composite_score=None,
        title="Cat Failed",
    )
    make_article(
        feed.id,
        categorization_state="categorized",
        scoring_state="failed",
        composite_score=None,
        title="Score Failed",
    )

    resp = test_client.get("/api/articles", params={"scoring_state": "failed"})
    assert resp.status_code == 200
    items = resp.json()
    titles = {item["title"] for item in items}
    assert titles == {"Cat Failed", "Score Failed"}


def test_scoring_status_includes_categorization_counts(
    test_client, test_engine, make_feed, make_article
):
    """Scoring status endpoint includes categorization sub-object with counts."""
    feed = make_feed()
    make_article(
        feed.id,
        categorization_state="queued",
        scoring_state="unscored",
        composite_score=None,
    )
    make_article(
        feed.id,
        categorization_state="categorized",
        scoring_state="scored",
        composite_score=5.0,
    )

    with (
        patch(
            "backend.scoring.get_categorization_activity",
            return_value={"article_id": None, "phase": "idle"},
        ),
        patch(
            "backend.scoring.get_scoring_activity",
            return_value={"article_id": None, "phase": "idle"},
        ),
        patch("backend.scoring.is_categorization_rate_limited", return_value=False),
        patch("backend.scoring.is_scoring_rate_limited", return_value=False),
        patch(
            "backend.scoring.get_categorization_rate_limit_remaining", return_value=0.0
        ),
        patch("backend.scoring.get_scoring_rate_limit_remaining", return_value=0.0),
    ):
        resp = test_client.get("/api/scoring/status")

    assert resp.status_code == 200
    data = resp.json()
    assert "categorization" in data
    cat = data["categorization"]
    assert cat["queued"] == 1
    assert cat["categorized"] == 1
    assert "phase" in cat
