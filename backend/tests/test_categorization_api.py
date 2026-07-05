"""API-seam tests for issue #90: proposal surfacing and the blocked view.

Drive categorization via the worker, then observe results through the REST
API against a real SQLite database.
"""

import pytest

from backend.prompts import BatchCategoryResponse
from backend.scoring_queue import CategorizationWorker, ScoringWorker

# ---------------------------------------------------------------------------
# Case 12: a created proposal surfaces via GET /api/categories with triage flag
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_proposal_surfaces_in_categories_api(
    test_client, test_session, sample_feed, fake_llm, make_article, cat_result
):
    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(
            results=[cat_result(article.id, [], proposed="Retro Computing")]
        ),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)
    test_session.expire_all()

    categories = test_client.get("/api/categories").json()
    by_slug = {c["slug"]: c for c in categories}
    assert "retro-computing" in by_slug
    created = by_slug["retro-computing"]
    assert created["needs_triage"] is True
    assert created["display_name"] == "Retro Computing"
    assert created["article_count"] == 1


# ---------------------------------------------------------------------------
# Case 13: a blocked article shows in the blocked view with score 0 + reasoning
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_blocked_article_in_blocked_view_with_reasoning(
    test_client,
    test_session,
    sample_feed,
    fake_llm,
    make_article,
    make_category,
    cat_result,
):
    make_category(display_name="Crypto", slug="crypto", weight="block")
    article = make_article(
        sample_feed.id, categorization_state="queued", scoring_state="unscored"
    )
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(results=[cat_result(article.id, ["Crypto"])]),
    )

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)
    await ScoringWorker().process_next_batch(test_session, batch_size=5)
    test_session.expire_all()

    # Hidden from the default list.
    assert test_client.get("/api/articles").json() == []

    blocked = test_client.get(
        "/api/articles", params={"scoring_state": "blocked"}
    ).json()
    assert len(blocked) == 1
    item = blocked[0]
    assert item["id"] == article.id
    assert item["composite_score"] == 0.0
    assert "Crypto" in (item["score_reasoning"] or "")
