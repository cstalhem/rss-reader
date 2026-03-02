from pathlib import Path

import httpx
import pytest
import respx

from backend.feeds import fetch_feed

_FIXTURES_DIR = Path(__file__).parent / "fixtures"

FEED_URL = "https://example.com/feed.xml"


def _read_fixture(filename: str) -> str:
    return (_FIXTURES_DIR / filename).read_text()


# --- Valid feeds ---


@respx.mock
@pytest.mark.asyncio
async def test_fetch_rss2():
    xml = _read_fixture("rss2_sample.xml")
    respx.get(FEED_URL).mock(return_value=httpx.Response(200, text=xml))

    feed = await fetch_feed(FEED_URL)

    assert feed.bozo == 0
    assert feed.feed.title == "Test RSS Feed"
    assert len(feed.entries) == 2
    assert feed.entries[0].link == "https://example.com/article-1"
    assert feed.entries[1].link == "https://example.com/article-2"


@respx.mock
@pytest.mark.asyncio
async def test_fetch_atom():
    xml = _read_fixture("atom_sample.xml")
    respx.get(FEED_URL).mock(return_value=httpx.Response(200, text=xml))

    feed = await fetch_feed(FEED_URL)

    assert feed.bozo == 0
    assert feed.feed.title == "Test Atom Feed"
    assert len(feed.entries) == 2
    assert feed.entries[0].link == "https://example.com/atom-1"


@respx.mock
@pytest.mark.asyncio
async def test_fetch_rss2_with_dc_creator_and_cdata():
    """Real-world HN RSS: dc:creator for author, CDATA-wrapped title/description."""
    xml = _read_fixture("rss2_hn_sample.xml")
    respx.get(FEED_URL).mock(return_value=httpx.Response(200, text=xml))

    feed = await fetch_feed(FEED_URL)

    assert feed.bozo == 0
    assert feed.feed.title == "Hacker News: Front Page"
    assert len(feed.entries) == 2
    # feedparser normalizes dc:creator → entry.author
    assert feed.entries[0].author == "todsacerdoti"
    # CDATA is stripped transparently
    assert feed.entries[0].title == "Packaging a Gleam app into a single executable"
    assert feed.entries[0].link == "https://www.dhzdhd.dev/blog/gleam-executable"


@respx.mock
@pytest.mark.asyncio
async def test_fetch_atom_with_media_namespace():
    """Real-world Atlantic Atom: media: namespace, author with uri, title type=html."""
    xml = _read_fixture("atom_atlantic_sample.xml")
    respx.get(FEED_URL).mock(return_value=httpx.Response(200, text=xml))

    feed = await fetch_feed(FEED_URL)

    assert feed.bozo == 0
    assert feed.feed.title == "Technology | The Atlantic"
    assert len(feed.entries) == 2
    # Per-entry author (not feed-level)
    assert feed.entries[0].author == "Matt Schiavenza"
    # Atom link with rel=alternate and type=text/html
    assert "686200" in feed.entries[0].link
    # summary and content both present
    assert feed.entries[0].summary is not None
    assert feed.entries[0].content[0].value is not None


@respx.mock
@pytest.mark.asyncio
async def test_fetch_malformed_xml():
    xml = _read_fixture("malformed_sample.xml")
    respx.get(FEED_URL).mock(return_value=httpx.Response(200, text=xml))

    feed = await fetch_feed(FEED_URL)

    assert feed.bozo == 1


# --- HTTP error responses ---


@respx.mock
@pytest.mark.asyncio
async def test_fetch_http_404():
    respx.get(FEED_URL).mock(return_value=httpx.Response(404))

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await fetch_feed(FEED_URL)
    assert exc_info.value.response.status_code == 404


@respx.mock
@pytest.mark.asyncio
async def test_fetch_http_500():
    respx.get(FEED_URL).mock(return_value=httpx.Response(500))

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await fetch_feed(FEED_URL)
    assert exc_info.value.response.status_code == 500


# --- Network errors ---


@respx.mock
@pytest.mark.asyncio
async def test_fetch_timeout():
    respx.get(FEED_URL).mock(side_effect=httpx.ConnectTimeout("timed out"))

    with pytest.raises(httpx.ConnectTimeout):
        await fetch_feed(FEED_URL)


@respx.mock
@pytest.mark.asyncio
async def test_fetch_connection_error():
    respx.get(FEED_URL).mock(side_effect=httpx.ConnectError("connection refused"))

    with pytest.raises(httpx.ConnectError):
        await fetch_feed(FEED_URL)
