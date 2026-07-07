"""API-seam tests for issue #96: blocked view + rescue.

Covers the rescue transition (POST /api/articles/{id}/rescue), the visibility
OR-clause (scored OR rescued), and the rescue guards. Worker-level yield and
scoring-exclusion invariants live in test_scoring_queue_batch.py-adjacent
coverage below, using the same FakeLLMClient/fake_llm fixtures as the rest
of the pipeline tests.
"""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import Article
from backend.scoring import compute_composite_score
from backend.scoring_queue import CategorizationWorker, ScoringWorker

# ---------------------------------------------------------------------------
# Blocked listing (already-working behavior, pinned as a baseline)
# ---------------------------------------------------------------------------


def test_blocked_listing_returns_blocked_articles_with_categories(
    test_client: TestClient, make_feed, make_article, make_category, test_session
):
    feed = make_feed()
    blocked_cat = make_category(display_name="Crypto", slug="crypto", weight="block")
    blocked = make_article(
        feed.id,
        scoring_state="blocked",
        categorization_state="categorized",
        composite_score=0.0,
    )
    blocked.categories_rel.append(blocked_cat)
    test_session.add(blocked)
    test_session.commit()

    normal = make_article(feed.id, scoring_state="scored", composite_score=5.0)  # noqa: F841

    blocked_response = test_client.get(
        "/api/articles", params={"scoring_state": "blocked"}
    ).json()
    assert [item["id"] for item in blocked_response["items"]] == [blocked.id]
    assert blocked_response["items"][0]["categories"][0]["slug"] == "crypto"

    normal_list = test_client.get("/api/articles").json()
    assert blocked.id not in [item["id"] for item in normal_list["items"]]


# ---------------------------------------------------------------------------
# Rescue transition
# ---------------------------------------------------------------------------


def test_rescue_sets_fields_and_returns_ok(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(
        feed.id,
        scoring_state="blocked",
        categorization_state="categorized",
        composite_score=0.0,
        interest_score=0,
        quality_score=0,
        score_reasoning="Blocked: Crypto",
        scoring_attempts=2,
        scoring_priority=0,
    )

    response = test_client.post(f"/api/articles/{article.id}/rescue")

    assert response.status_code == 200
    assert response.json() == {"ok": True}

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.rescued_at is not None
    assert updated.scoring_state == "queued"
    assert updated.scoring_attempts == 0
    assert updated.rescore_mode == "score_only"
    assert updated.scoring_priority == 1
    # Numeric scores are nulled so the article satisfies
    # scoring_pending_condition() and shows no stale 0.0 in the list.
    assert updated.interest_score is None
    assert updated.quality_score is None
    assert updated.composite_score is None
    # score_reasoning is kept as the audit trail until the re-score overwrites it.
    assert updated.score_reasoning == "Blocked: Crypto"


def test_rescued_article_appears_in_normal_list_and_not_blocked(
    test_client: TestClient, make_feed, make_article
):
    feed = make_feed()
    article = make_article(
        feed.id, scoring_state="blocked", composite_score=0.0, is_read=False
    )

    test_client.post(f"/api/articles/{article.id}/rescue")

    normal_ids = [
        item["id"] for item in test_client.get("/api/articles").json()["items"]
    ]
    assert article.id in normal_ids

    blocked_ids = [
        item["id"]
        for item in test_client.get(
            "/api/articles", params={"scoring_state": "blocked"}
        ).json()["items"]
    ]
    assert article.id not in blocked_ids


def test_rescued_article_counted_as_unread_and_not_blocked(
    test_client: TestClient, make_feed, make_article
):
    feed = make_feed()
    article = make_article(
        feed.id, scoring_state="blocked", composite_score=0.0, is_read=False
    )

    before = test_client.get("/api/articles/counts").json()
    assert before["blocked"] == 1

    test_client.post(f"/api/articles/{article.id}/rescue")

    after = test_client.get("/api/articles/counts").json()
    assert after["blocked"] == 0
    assert after["unread"] == 1


# ---------------------------------------------------------------------------
# Rescue guards
# ---------------------------------------------------------------------------


def test_rescue_unknown_article_404(test_client: TestClient):
    response = test_client.post("/api/articles/999999/rescue")
    assert response.status_code == 404


def test_rescue_non_blocked_article_409(
    test_client: TestClient, make_feed, make_article
):
    feed = make_feed()
    article = make_article(feed.id, scoring_state="scored", composite_score=5.0)

    response = test_client.post(f"/api/articles/{article.id}/rescue")
    assert response.status_code == 409


def test_double_rescue_is_idempotent_no_op(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    feed = make_feed()
    article = make_article(
        feed.id,
        scoring_state="blocked",
        categorization_state="categorized",
        composite_score=0.0,
    )

    first = test_client.post(f"/api/articles/{article.id}/rescue")
    assert first.status_code == 200
    assert first.json() == {"ok": True}

    test_session.expire_all()
    after_first = test_session.get(Article, article.id)
    rescued_at = after_first.rescued_at
    assert after_first.scoring_state == "queued"

    second = test_client.post(f"/api/articles/{article.id}/rescue")
    assert second.status_code == 200
    assert second.json() == {"ok": True}

    test_session.expire_all()
    after_second = test_session.get(Article, article.id)
    assert after_second.scoring_state == "queued"
    assert after_second.rescued_at == rescued_at


def test_rescue_of_failed_rescored_article_requeues(
    test_client: TestClient, make_feed, make_article, test_session: Session
):
    """A rescued article whose re-score exhausted retries: rescue doubles as retry."""
    feed = make_feed()
    rescued_at = datetime.now()
    article = make_article(
        feed.id,
        scoring_state="failed",
        categorization_state="categorized",
        rescued_at=rescued_at,
        scoring_attempts=3,
        interest_score=None,
        quality_score=None,
        composite_score=None,
    )

    response = test_client.post(f"/api/articles/{article.id}/rescue")

    assert response.status_code == 200
    assert response.json() == {"ok": True}

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.scoring_state == "queued"
    assert updated.scoring_attempts == 0
    assert updated.rescore_mode == "score_only"
    assert updated.rescued_at == rescued_at


def test_rescued_article_counted_in_scoring_progress(
    test_client: TestClient, make_feed, make_article
):
    feed = make_feed()
    article = make_article(
        feed.id, scoring_state="blocked", composite_score=0.0, is_read=False
    )

    test_client.post(f"/api/articles/{article.id}/rescue")

    counts = test_client.get("/api/articles/counts").json()
    assert counts["scoring"] == 1


# ---------------------------------------------------------------------------
# Yield invariant: a rescued article is never re-blocked (worker-level)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rescued_article_not_reblocked_by_categorization_worker(
    test_session, sample_feed, fake_llm, make_article, make_category, cat_result
):
    from backend.prompts import BatchCategoryResponse

    make_category(display_name="Crypto", slug="crypto", weight="block")
    article = make_article(
        sample_feed.id,
        scoring_state="queued",
        categorization_state="queued",
        rescued_at=__import__("datetime").datetime.now(),
        scoring_attempts=0,
        rescore_mode="score_only",
        scoring_priority=1,
    )

    # Re-categorization returns the same block-weight category again.
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(results=[cat_result(article.id, ["Crypto"])]),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    # Must NOT be re-blocked — the rescue verdict outranks the classifier.
    assert updated.scoring_state != "blocked"
    assert updated.scoring_state == "queued"


# ---------------------------------------------------------------------------
# Scoring exclusion invariant: rescued article's block category is filtered
# out of the composite-score category multiplier.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rescued_article_scoring_excludes_block_category_from_multiplier(
    test_session, sample_feed, fake_llm, make_article, make_category
):
    from datetime import datetime

    blocked_cat = make_category(display_name="Crypto", slug="crypto", weight="block")
    article = make_article(
        sample_feed.id,
        scoring_state="queued",
        categorization_state="categorized",
        rescued_at=datetime.now(),
    )
    article.categories_rel.append(blocked_cat)
    test_session.add(article)
    test_session.commit()

    await ScoringWorker().process_next_batch(test_session, batch_size=5)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.scoring_state == "scored"
    # multiplier 1.0 (no-categories branch), not 0.0 — the sole block
    # category is filtered out for a rescued article.
    expected = compute_composite_score(
        updated.interest_score, updated.quality_score, []
    )
    assert updated.composite_score == expected
    assert updated.composite_score > 0


@pytest.mark.asyncio
async def test_non_rescued_article_scoring_still_blocked_by_multiplier(
    test_session, sample_feed, fake_llm, make_article, make_category
):
    blocked_cat = make_category(display_name="Crypto2", slug="crypto2", weight="block")
    article = make_article(
        sample_feed.id,
        scoring_state="queued",
        categorization_state="categorized",
    )
    article.categories_rel.append(blocked_cat)
    test_session.add(article)
    test_session.commit()

    await ScoringWorker().process_next_batch(test_session, batch_size=5)

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    # Non-rescued path is unaffected — block category still zeroes the score.
    assert updated.composite_score == 0.0
