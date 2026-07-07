import httpx
import pytest
import pytest_asyncio
import respx

from backend import fetch_through
from backend.fetch_through import (
    close_client,
    ensure_linked_content,
    load_linked_content_for_batch,
)
from backend.models import Article, Feed

ARTICLE_URL = "https://example.com/article-1"

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

_SHORT_HTML = """<html><head><title>Empty</title></head>
<body>
<nav>Home About Contact</nav>
<article><p>Hi.</p></article>
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
    return make_article(feed_id=aggregator_feed.id, url=ARTICLE_URL)


@respx.mock
@pytest.mark.asyncio
async def test_ensure_linked_content_success(
    test_session, aggregator_article, aggregator_feed
):
    respx.get(ARTICLE_URL).mock(
        return_value=httpx.Response(
            200, headers={"content-type": "text/html"}, text=_ARTICLE_HTML
        )
    )

    content = await ensure_linked_content(
        test_session, aggregator_article, aggregator_feed
    )

    assert content is not None
    assert "Understanding Distributed Systems" in content
    assert aggregator_article.linked_content_markdown == content
    assert aggregator_article.linked_fetched_at is not None


@respx.mock
@pytest.mark.asyncio
async def test_ensure_linked_content_timeout(
    test_session, aggregator_article, aggregator_feed
):
    respx.get(ARTICLE_URL).mock(side_effect=httpx.TimeoutException("timed out"))

    content = await ensure_linked_content(
        test_session, aggregator_article, aggregator_feed
    )

    assert content is None
    assert aggregator_article.linked_fetched_at is not None
    assert aggregator_article.linked_content_markdown is None


@respx.mock
@pytest.mark.asyncio
async def test_ensure_linked_content_error_status(
    test_session, aggregator_article, aggregator_feed
):
    respx.get(ARTICLE_URL).mock(return_value=httpx.Response(404))

    content = await ensure_linked_content(
        test_session, aggregator_article, aggregator_feed
    )

    assert content is None
    assert aggregator_article.linked_content_markdown is None
    assert aggregator_article.linked_fetched_at is not None


@respx.mock
@pytest.mark.asyncio
async def test_ensure_linked_content_non_html_fallback(
    test_session, aggregator_article, aggregator_feed
):
    route = respx.get(ARTICLE_URL).mock(
        return_value=httpx.Response(
            200, headers={"content-type": "application/pdf"}, content=b"%PDF-1.4"
        )
    )

    content = await ensure_linked_content(
        test_session, aggregator_article, aggregator_feed
    )

    assert content is None
    assert route.called
    assert aggregator_article.linked_content_markdown is None
    assert aggregator_article.linked_fetched_at is not None


@respx.mock
@pytest.mark.asyncio
async def test_ensure_linked_content_short_extraction_fallback(
    test_session, aggregator_article, aggregator_feed
):
    respx.get(ARTICLE_URL).mock(
        return_value=httpx.Response(
            200, headers={"content-type": "text/html"}, text=_SHORT_HTML
        )
    )

    content = await ensure_linked_content(
        test_session, aggregator_article, aggregator_feed
    )

    assert content is None
    assert aggregator_article.linked_content_markdown is None
    assert aggregator_article.linked_fetched_at is not None


@respx.mock
@pytest.mark.asyncio
async def test_ensure_linked_content_cache_hit(
    test_session, aggregator_article, aggregator_feed
):
    aggregator_article.linked_content_markdown = "cached"
    test_session.add(aggregator_article)
    test_session.commit()
    route = respx.get(ARTICLE_URL).mock(return_value=httpx.Response(200))

    content = await ensure_linked_content(
        test_session, aggregator_article, aggregator_feed
    )

    assert content == "cached"
    assert route.called is False


@respx.mock
@pytest.mark.asyncio
async def test_load_linked_content_for_batch_skips_missing_feed(
    test_session, aggregator_article
):
    """A feed_id with no matching row (e.g. concurrent feed deletion) must be
    skipped, never raised — a fetch-through miss must not strand the batch."""
    aggregator_article.feed_id = 999_999
    test_session.add(aggregator_article)
    test_session.commit()
    route = respx.get(ARTICLE_URL).mock(return_value=httpx.Response(200))

    await load_linked_content_for_batch(test_session, [aggregator_article])

    assert route.called is False
    assert aggregator_article.linked_content_markdown is None


@respx.mock
@pytest.mark.asyncio
async def test_ensure_linked_content_not_aggregator(
    test_session, make_feed, make_article
):
    feed = make_feed(is_aggregator=False)
    article = make_article(feed_id=feed.id, url=ARTICLE_URL)
    route = respx.get(ARTICLE_URL).mock(return_value=httpx.Response(200))

    content = await ensure_linked_content(test_session, article, feed)

    assert content is None
    assert route.called is False
    assert article.linked_fetched_at is None


@respx.mock
@pytest.mark.asyncio
async def test_ensure_linked_content_already_attempted(
    test_session, aggregator_article, aggregator_feed
):
    from datetime import datetime

    aggregator_article.linked_fetched_at = datetime.now()
    test_session.add(aggregator_article)
    test_session.commit()
    route = respx.get(ARTICLE_URL).mock(return_value=httpx.Response(200))

    content = await ensure_linked_content(
        test_session, aggregator_article, aggregator_feed
    )

    assert content is None
    assert route.called is False
