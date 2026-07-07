"""Worker-level integration tests for aggregator fetch-through (issue #100).

Exercises CategorizationWorker/ScoringWorker with a real fetch-through call
(respx-mocked HTTP) alongside the fake_llm seam for the LLM call — the two
mocks don't conflict since fetch-through uses httpx directly while the LLM
wrapper is a whole-object monkeypatch.
"""

from datetime import datetime

import httpx
import pytest
import pytest_asyncio
import respx

from backend import fetch_through
from backend.fetch_through import close_client
from backend.models import Article, Feed
from backend.scoring_queue import CategorizationWorker, ScoringWorker

ARTICLE_URL = "https://example.com/aggregator-article-1"

_ARTICLE_HTML = """<html><head><title>Test Article</title></head>
<body>
<nav>Home About Contact</nav>
<article>
<h1>Understanding Distributed Systems</h1>
<p>Distributed systems are a fascinating area of computer science that deals
with multiple computers working together to achieve a common goal. When
designing such systems, engineers must carefully consider tradeoffs around
consistency, availability, and partition tolerance.</p>
<p>In this article, we will explore the CAP theorem and how it shapes the
way we build resilient, scalable software architectures for the modern web.
We will also discuss practical examples from real-world systems.</p>
</article>
<footer>Copyright 2024</footer>
</body></html>"""


@pytest_asyncio.fixture(autouse=True)
async def _reset_fetch_through_state():
    """Prevent module-level singleton/limiter state leaking across tests."""
    await close_client()
    fetch_through._host_last_request.clear()
    yield
    await close_client()
    fetch_through._host_last_request.clear()


@pytest.fixture(name="aggregator_feed")
def aggregator_feed_fixture(make_feed) -> Feed:
    return make_feed(is_aggregator=True)


@pytest.fixture(name="aggregator_article")
def aggregator_article_fixture(make_article, aggregator_feed: Feed) -> Article:
    return make_article(
        feed_id=aggregator_feed.id,
        url=ARTICLE_URL,
        categorization_state="queued",
        scoring_state="unscored",
    )


@respx.mock
@pytest.mark.asyncio
async def test_categorization_worker_fetches_through_aggregator_article(
    test_session, aggregator_article, fake_llm
):
    respx.get(ARTICLE_URL).mock(
        return_value=httpx.Response(
            200, headers={"content-type": "text/html"}, text=_ARTICLE_HTML
        )
    )

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=5)
    assert processed == 1

    test_session.expire_all()
    updated = test_session.get(Article, aggregator_article.id)
    assert updated.linked_content_markdown is not None
    assert "Understanding Distributed Systems" in updated.linked_content_markdown
    assert updated.categorization_state == "categorized"
    assert updated.scoring_state == "queued"


@respx.mock
@pytest.mark.asyncio
async def test_categorization_worker_survives_fetch_through_failure(
    test_session, aggregator_article, fake_llm
):
    respx.get(ARTICLE_URL).mock(return_value=httpx.Response(404))

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=5)
    assert processed == 1

    test_session.expire_all()
    updated = test_session.get(Article, aggregator_article.id)
    assert updated.linked_content_markdown is None
    assert updated.categorization_state == "categorized"
    assert updated.scoring_state == "queued"


@respx.mock
@pytest.mark.asyncio
async def test_categorization_worker_survives_fetch_through_timeout(
    test_session, aggregator_article, fake_llm
):
    respx.get(ARTICLE_URL).mock(side_effect=httpx.TimeoutException("timed out"))

    worker = CategorizationWorker()
    processed = await worker.process_next_batch(test_session, batch_size=5)
    assert processed == 1

    test_session.expire_all()
    updated = test_session.get(Article, aggregator_article.id)
    assert updated.linked_content_markdown is None
    assert updated.categorization_state == "categorized"
    assert updated.scoring_state != "failed"


@respx.mock
@pytest.mark.asyncio
async def test_score_only_rescore_fetches_through_when_uncached(
    test_session, aggregator_article, fake_llm
):
    """score_only rescore reaches only the scoring worker; it must still fetch."""
    route = respx.get(ARTICLE_URL).mock(
        return_value=httpx.Response(
            200, headers={"content-type": "text/html"}, text=_ARTICLE_HTML
        )
    )

    aggregator_article.categorization_state = "categorized"
    aggregator_article.scoring_state = "queued"
    aggregator_article.rescore_mode = "score_only"
    test_session.add(aggregator_article)
    test_session.commit()

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=5)
    assert processed == 1
    assert route.called

    test_session.expire_all()
    updated = test_session.get(Article, aggregator_article.id)
    assert updated.linked_content_markdown is not None
    assert updated.scoring_state == "scored"


@respx.mock
@pytest.mark.asyncio
async def test_score_only_rescore_skips_fetch_when_content_cached(
    test_session, aggregator_article, fake_llm
):
    """Cache-hit path: stored content means no re-fetch, ever."""
    route = respx.get(ARTICLE_URL).mock(return_value=httpx.Response(200))

    aggregator_article.categorization_state = "categorized"
    aggregator_article.scoring_state = "queued"
    aggregator_article.rescore_mode = "score_only"
    aggregator_article.linked_content_markdown = "cached content"
    test_session.add(aggregator_article)
    test_session.commit()

    worker = ScoringWorker()
    processed = await worker.process_next_batch(test_session, batch_size=5)
    assert processed == 1
    assert route.called is False

    test_session.expire_all()
    updated = test_session.get(Article, aggregator_article.id)
    assert updated.linked_content_markdown == "cached content"
    assert updated.scoring_state == "scored"


def test_enqueue_single_for_rescoring_clears_linked_fetched_at(
    test_session, aggregator_article
):
    aggregator_article.linked_fetched_at = datetime.now()
    aggregator_article.scoring_state = "blocked"
    test_session.add(aggregator_article)
    test_session.commit()

    worker = CategorizationWorker()
    worker.enqueue_single_for_rescoring(
        test_session, aggregator_article, score_only=True
    )

    test_session.expire_all()
    updated = test_session.get(Article, aggregator_article.id)
    assert updated.linked_fetched_at is None


def test_rescue_endpoint_clears_linked_fetched_at(test_client, test_session, make_feed):
    feed = make_feed(is_aggregator=True)
    article = Article(
        feed_id=feed.id,
        title="Blocked aggregator article",
        url=ARTICLE_URL,
        categorization_state="categorized",
        scoring_state="blocked",
        linked_fetched_at=datetime.now(),
    )
    test_session.add(article)
    test_session.commit()
    test_session.refresh(article)

    response = test_client.post(f"/api/articles/{article.id}/rescue")
    assert response.status_code == 200

    test_session.expire_all()
    updated = test_session.get(Article, article.id)
    assert updated.linked_fetched_at is None
