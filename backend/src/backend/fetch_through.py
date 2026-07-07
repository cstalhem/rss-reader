"""Aggregator fetch-through: pull the linked article's own content (ADR-0011).

Exception-safe by design — every failure (network, HTTP status, wrong
content-type, oversized body, thin extraction) degrades to ``None`` so a bad
link never blocks scoring. Not shared with feed refresh: the per-host
limiter and client here are scoped to this module only.
"""

import asyncio
import logging
import time
from collections.abc import Sequence
from datetime import datetime

import httpx
import trafilatura
from sqlmodel import Session, select

from backend.config import get_settings
from backend.markdown import html_to_markdown
from backend.models import Article, Feed

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None

# host -> time.monotonic() of the last request made to it.
_host_last_request: dict[str, float] = {}


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        cfg = get_settings().fetch_through
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(cfg.timeout),
            follow_redirects=True,
            max_redirects=cfg.max_redirects,
            headers={"User-Agent": cfg.user_agent},
        )
    return _client


async def close_client() -> None:
    """Close the shared client and reset the singleton (lifespan shutdown, tests)."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def _respect_host_interval(host: str, interval: float) -> None:
    last = _host_last_request.get(host)
    now = time.monotonic()
    if last is not None:
        elapsed = now - last
        if elapsed < interval:
            await asyncio.sleep(interval - elapsed)
    _host_last_request[host] = time.monotonic()


async def _fetch_and_extract(url: str) -> str | None:
    cfg = get_settings().fetch_through
    host = httpx.URL(url).host
    await _respect_host_interval(host, cfg.per_host_interval)

    client = _get_client()
    async with client.stream("GET", url) as resp:
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "text/html" not in content_type.lower():
            return None

        body = bytearray()
        async for chunk in resp.aiter_bytes():
            body.extend(chunk)
            if len(body) > cfg.max_bytes:
                return None

    extracted = trafilatura.extract(bytes(body), output_format="html")
    if not extracted:
        return None

    markdown = html_to_markdown(extracted)
    if len(markdown) < cfg.min_extract_chars:
        return None
    return markdown


async def ensure_linked_content(
    session: Session, article: Article, feed: Feed
) -> str | None:
    """Fetch and cache the linked article's own content for an aggregator feed.

    Returns the cached/extracted markdown, or None on any cache-miss failure.
    Never raises — all fetch/extract errors are logged and swallowed.
    """
    if not feed.is_aggregator:
        return None
    if article.linked_content_markdown:
        return article.linked_content_markdown
    if article.linked_fetched_at is not None:
        return None

    article.linked_fetched_at = datetime.now()
    try:
        content = await _fetch_and_extract(article.url)
    except Exception as e:
        logger.warning("fetch-through failed for %s: %s", article.url, e)
        content = None

    if content:
        article.linked_content_markdown = content
    session.add(article)
    session.commit()
    return content


async def load_linked_content_for_batch(
    session: Session, articles: Sequence[Article]
) -> None:
    """Best-effort fetch-through for every aggregator article in the batch.

    Loads feeds in one query (no N+1) and populates linked_content_markdown
    where applicable. Missing feeds (e.g. concurrent deletion) are skipped,
    never raised — a fetch-through miss must not strand the batch.
    """
    feed_ids = {a.feed_id for a in articles}
    if not feed_ids:
        return
    feeds_by_id = {
        f.id: f
        for f in session.exec(select(Feed).where(Feed.id.in_(feed_ids))).all()  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
    }
    for art in articles:
        feed = feeds_by_id.get(art.feed_id)
        if feed is not None:
            await ensure_linked_content(session, art, feed)


def reset_fetch_through(article: Article) -> None:
    """Clear the fetch-through attempt marker so a rescore re-attempts a prior
    failure. Safe unconditionally: ensure_linked_content checks
    linked_content_markdown (cache hit) BEFORE linked_fetched_at, so a prior
    SUCCESS is never re-fetched."""
    article.linked_fetched_at = None
