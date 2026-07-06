"""Tests for synchronous weight-change recompute (ADR-0010).

Changing a category's weight (single or bulk PATCH) recomputes
composite_score + scoring_state for already-scored linked articles, over
STORED interest/quality (no LLM). interest/quality are preserved, not zeroed.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import Article, ArticleCategoryLink, Category


def _link(session: Session, article_id: int, category_id: int) -> None:
    session.add(ArticleCategoryLink(article_id=article_id, category_id=category_id))
    session.commit()


# Defaults from config (CONFIG_FILE=devnull → WeightMultipliers defaults):
#   reduce=0.5, normal=1.0, boost=1.5, max=2.0, block=0.0
# quality_multiplier = 0.5 + quality/10 * 0.5
# composite = interest * category_multiplier * quality_multiplier
#
# For interest=6, quality=8 → quality_multiplier=0.9:
#   normal → 6*1.0*0.9 = 5.4
#   boost  → 6*1.5*0.9 = 8.1
#   reduce → 6*0.5*0.9 = 2.7


def _scored_article(make_article, feed_id, interest=6, quality=8) -> Article:
    return make_article(
        feed_id,
        scoring_state="scored",
        interest_score=interest,
        quality_score=quality,
        composite_score=6 * 1.0 * 0.9,  # normal weight baseline
    )


# ---------------------------------------------------------------------------
# Block retroactively → blocked view; interest/quality preserved
# ---------------------------------------------------------------------------


def test_block_retroactively_moves_scored_article_to_blocked(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    feed = make_feed()
    cat = make_category(display_name="Crypto", slug="crypto", weight="normal")
    article = _scored_article(make_article, feed.id)
    _link(test_session, article.id, cat.id)

    resp = test_client.patch(
        f"/api/categories/{cat.id}",
        json={"weight": "block"},
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a = test_session.get(Article, article.id)
    assert a.scoring_state == "blocked"
    # Preserved, NOT zeroed
    assert a.interest_score == 6
    assert a.quality_score == 8


def test_block_via_bulk_patch_moves_scored_article_to_blocked(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    feed = make_feed()
    cat = make_category(display_name="Crypto", slug="crypto", weight="normal")
    article = _scored_article(make_article, feed.id)
    _link(test_session, article.id, cat.id)

    resp = test_client.patch(
        "/api/categories",
        json={"category_ids": [cat.id], "weight": "block"},
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a = test_session.get(Article, article.id)
    assert a.scoring_state == "blocked"
    assert a.interest_score == 6
    assert a.quality_score == 8


# ---------------------------------------------------------------------------
# Boost/reduce → composite recompute
# ---------------------------------------------------------------------------


def test_boost_recomputes_composite(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    feed = make_feed()
    cat = make_category(display_name="AI", slug="ai", weight="normal")
    article = _scored_article(make_article, feed.id)
    _link(test_session, article.id, cat.id)

    resp = test_client.patch(f"/api/categories/{cat.id}", json={"weight": "boost"})
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a = test_session.get(Article, article.id)
    assert a.scoring_state == "scored"
    assert a.composite_score == pytest.approx(8.1)


def test_reduce_recomputes_composite(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    feed = make_feed()
    cat = make_category(display_name="AI", slug="ai", weight="normal")
    article = _scored_article(make_article, feed.id)
    _link(test_session, article.id, cat.id)

    resp = test_client.patch(f"/api/categories/{cat.id}", json={"weight": "reduce"})
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a = test_session.get(Article, article.id)
    assert a.scoring_state == "scored"
    assert a.composite_score == pytest.approx(2.7)


# ---------------------------------------------------------------------------
# Un-block: real-scored article gets cheap recompute
# ---------------------------------------------------------------------------


def test_unblock_real_scored_article_recomputes_not_requeue(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    """A retroactively-blocked article (real preserved scores) un-blocks cheaply."""
    feed = make_feed()
    cat = make_category(display_name="Crypto", slug="crypto", weight="block")
    # Blocked but carries REAL preserved scores (interest/quality != 0)
    article = make_article(
        feed.id,
        scoring_state="blocked",
        interest_score=6,
        quality_score=8,
        composite_score=0.0,
    )
    _link(test_session, article.id, cat.id)

    resp = test_client.patch(f"/api/categories/{cat.id}", json={"weight": "normal"})
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a = test_session.get(Article, article.id)
    assert a.scoring_state == "scored"
    assert a.composite_score == pytest.approx(5.4)


# ---------------------------------------------------------------------------
# Un-block: worker-blocked (0/0) article gets re-queued
# ---------------------------------------------------------------------------


def test_unblock_worker_blocked_zero_zero_requeues(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    """A worker-blocked article (interest==quality==0) has nothing to recompute
    from — it re-enters the normal pipeline."""
    feed = make_feed()
    cat = make_category(display_name="Crypto", slug="crypto", weight="block")
    article = make_article(
        feed.id,
        scoring_state="blocked",
        interest_score=0,
        quality_score=0,
        composite_score=0.0,
    )
    _link(test_session, article.id, cat.id)

    resp = test_client.patch(f"/api/categories/{cat.id}", json={"weight": "normal"})
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a = test_session.get(Article, article.id)
    # Re-queued through the normal pipeline
    assert a.scoring_state == "queued"


# ---------------------------------------------------------------------------
# Atomicity: bulk block mixing a scored + a worker-blocked article is one txn
# ---------------------------------------------------------------------------


def test_bulk_block_mixed_scored_and_worker_blocked_is_atomic(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    """A bulk weight=block PATCH over one normally-scored and one worker-blocked
    (0/0) article must handle both in a single transaction: the scored one
    blocks, the worker-blocked one re-queues, and the response succeeds."""
    feed = make_feed()
    cat = make_category(display_name="Crypto", slug="crypto", weight="normal")

    scored = _scored_article(make_article, feed.id)
    worker_blocked = make_article(
        feed.id,
        scoring_state="blocked",
        interest_score=0,
        quality_score=0,
        composite_score=0.0,
    )
    _link(test_session, scored.id, cat.id)
    _link(test_session, worker_blocked.id, cat.id)

    resp = test_client.patch(
        "/api/categories",
        json={"category_ids": [cat.id], "weight": "block"},
    )
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a_scored = test_session.get(Article, scored.id)
    assert a_scored.scoring_state == "blocked"
    # Preserved, NOT zeroed
    assert a_scored.interest_score == 6
    assert a_scored.quality_score == 8

    a_worker = test_session.get(Article, worker_blocked.id)
    # Worker-blocked (0/0) has nothing to recompute — re-queued via score-only
    assert a_worker.scoring_state == "queued"
    assert a_worker.rescore_mode == "score_only"


# ---------------------------------------------------------------------------
# Rescue-aware: rescued article never retroactively re-blocked
# ---------------------------------------------------------------------------


def test_rescued_article_not_reblocked_on_block(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    from datetime import datetime

    feed = make_feed()
    cat = make_category(display_name="Crypto", slug="crypto", weight="normal")
    article = make_article(
        feed.id,
        scoring_state="scored",
        interest_score=6,
        quality_score=8,
        composite_score=5.4,
        rescued_at=datetime.now(),
    )
    _link(test_session, article.id, cat.id)

    resp = test_client.patch(f"/api/categories/{cat.id}", json={"weight": "block"})
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a = test_session.get(Article, article.id)
    # Rescue verdict outranks the block — stays visible/scored, block dropped
    assert a.scoring_state == "scored"
    # Sole blocked category dropped → no-categories multiplier 1.0 → 6*1.0*0.9
    assert a.composite_score == pytest.approx(5.4)


# ---------------------------------------------------------------------------
# Non-weight PATCH does not recompute (only rename / triage)
# ---------------------------------------------------------------------------


def test_triage_only_patch_leaves_scoring_untouched(
    test_client: TestClient,
    test_session: Session,
    make_category: Callable[..., Category],
    make_article,
    make_feed,
):
    feed = make_feed()
    cat = make_category(
        display_name="AI", slug="ai", weight="normal", needs_triage=True
    )
    article = _scored_article(make_article, feed.id)
    _link(test_session, article.id, cat.id)
    before = (article.scoring_state, article.composite_score)

    resp = test_client.patch(f"/api/categories/{cat.id}", json={"needs_triage": False})
    assert resp.status_code == 200, resp.text
    test_session.expire_all()

    a = test_session.get(Article, article.id)
    assert (a.scoring_state, a.composite_score) == before
