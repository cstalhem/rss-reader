"""REST-seam tests for the scoring lifecycle (issue #89 acceptance criteria).

Drive the pipeline via the API and the scheduler entrypoint with the Azure
wrapper mocked (canned typed responses), assert observable state via the
REST endpoints against a real SQLite database.
"""

from datetime import datetime

import pytest

from backend.llm_client import LLMUnavailable
from backend.models import Article
from backend.scoring_queue import CategorizationWorker, ScoringWorker


def _seed_unscored_article(session, feed_id: int, idx: int) -> Article:
    article = Article(
        feed_id=feed_id,
        title=f"Lifecycle article {idx}",
        url=f"https://example.com/lifecycle-{idx}",
        published_at=datetime.now(),
        content=f"Content {idx}",
        categorization_state="queued",
        scoring_state="unscored",
    )
    session.add(article)
    session.commit()
    session.refresh(article)
    return article


async def _run_pipeline_once(session, batch_size: int = 5) -> None:
    await CategorizationWorker().process_next_batch(session, batch_size)
    await ScoringWorker().process_next_batch(session, batch_size)


@pytest.mark.asyncio
async def test_full_scoring_lifecycle_visible_via_api(
    test_client, test_session, sample_feed, fake_llm
):
    article = _seed_unscored_article(test_session, sample_feed.id, 1)

    await _run_pipeline_once(test_session)

    # Scored article appears in the default article list with scores
    response = test_client.get("/api/articles")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    item = items[0]
    assert item["id"] == article.id
    assert item["scoring_state"] == "scored"
    assert item["interest_score"] == 7
    assert item["quality_score"] == 8
    assert item["composite_score"] is not None
    assert item["categories"][0]["display_name"] == "Technology"

    # Status endpoint reflects the scored article and readiness
    status = test_client.get("/api/scoring/status").json()
    assert status["scored"] == 1
    assert status["scoring_ready"] is True
    assert status["rate_limit_retry_after"] is None


@pytest.mark.asyncio
async def test_bulk_rescore_endpoint_requeues_and_rescores(
    test_client, test_session, sample_feed, fake_llm, make_article
):
    make_article(
        sample_feed.id,
        is_read=False,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=3.0,
    )

    response = test_client.post("/api/scoring")
    assert response.status_code == 200
    assert response.json()["rescore_queued"] == 1

    await _run_pipeline_once(test_session)

    test_session.expire_all()
    articles = test_client.get("/api/articles").json()["items"]
    assert articles[0]["scoring_state"] == "scored"
    assert articles[0]["interest_score"] == 7


@pytest.mark.asyncio
async def test_single_article_rescore_endpoint(
    test_client, test_session, sample_feed, fake_llm, make_article
):
    article = make_article(
        sample_feed.id,
        scoring_state="scored",
        categorization_state="categorized",
        composite_score=3.0,
    )

    response = test_client.post(f"/api/articles/{article.id}/rescore")
    assert response.status_code == 200

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.categorization_state == "queued"
    assert updated.scoring_priority == 1


def test_status_reports_not_ready_without_azure_credentials(test_client, fake_llm):
    fake_llm.configured = False

    status = test_client.get("/api/scoring/status").json()
    assert status["scoring_ready"] is False
    assert "AZURE_OPENAI_ENDPOINT" in status["scoring_ready_reason"]
    assert status["categorization"]["ready"] is False
    assert status["scoring_worker"]["ready"] is False


@pytest.mark.asyncio
async def test_rate_limited_pipeline_surfaces_in_status_and_requeues(
    test_client, test_session, sample_feed, fake_llm
):
    _seed_unscored_article(test_session, sample_feed.id, 1)
    fake_llm.queue("categorization", LLMUnavailable(42.0))

    await CategorizationWorker().process_next_batch(test_session, batch_size=1)

    # Wrapper reports the pause; status endpoint surfaces it
    fake_llm.pauses = {"categorization": 42.0, "scoring": 0.0}
    status = test_client.get("/api/scoring/status").json()
    assert status["scoring_ready"] is False
    assert "rate limit" in status["scoring_ready_reason"].lower()
    assert status["rate_limit_retry_after"] == 42
    assert status["categorization"]["rate_limit_retry_after"] == 42

    # Article stays queued without a burned attempt
    test_session.expire_all()
    articles = test_client.get(
        "/api/articles", params={"scoring_state": "pending"}
    ).json()["items"]
    assert len(articles) == 1


@pytest.mark.asyncio
async def test_blocked_articles_appear_only_in_blocked_view(
    test_client, test_session, sample_feed, fake_llm, make_category
):
    from backend.prompts import ArticleCategoryResult, BatchCategoryResponse

    make_category(display_name="Crypto", slug="crypto", weight="block")
    article = _seed_unscored_article(test_session, sample_feed.id, 1)
    fake_llm.queue(
        "categorization",
        BatchCategoryResponse(
            results=[
                ArticleCategoryResult(
                    article_id=article.id,
                    categories=["Crypto"],
                    proposed_category=None,
                )
            ]
        ),
    )

    await _run_pipeline_once(test_session)
    test_session.expire_all()

    # Hidden from the default list
    assert test_client.get("/api/articles").json()["items"] == []

    # Inspectable in the blocked view
    blocked = test_client.get(
        "/api/articles", params={"scoring_state": "blocked"}
    ).json()["items"]
    assert len(blocked) == 1
    assert blocked[0]["id"] == article.id

    # Counted as blocked in status
    status = test_client.get("/api/scoring/status").json()
    assert status["blocked"] == 1
    assert status["scored"] == 0
