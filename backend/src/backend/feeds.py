import logging
from datetime import datetime
from time import struct_time

import feedparser
import httpx
from sqlmodel import Session, select

from backend.models import Article, Feed

logger = logging.getLogger(__name__)


def _parse_published_date(entry: dict) -> datetime | None:
    """Parse published date from feed entry, handling various formats."""
    # Try published_parsed first, then updated_parsed
    for field in ["published_parsed", "updated_parsed"]:
        if field in entry and entry[field]:
            time_struct: struct_time = entry[field]
            try:
                return datetime(*time_struct[:6])
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse {field}: {e}")
    return None


async def fetch_feed(url: str) -> feedparser.FeedParserDict:
    """
    Fetch and parse an RSS feed.

    Args:
        url: RSS feed URL

    Returns:
        Parsed feed dictionary from feedparser

    Raises:
        httpx.HTTPError: If the feed cannot be fetched
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()

    # feedparser.parse() accepts both URLs and strings
    feed = feedparser.parse(response.text)

    if feed.bozo:  # feedparser sets bozo=1 for malformed feeds
        logger.warning(f"Feed {url} has parsing issues: {feed.get('bozo_exception')}")

    return feed


def save_articles(session: Session, feed_id: int, entries: list[dict]) -> int:
    """
    Save articles from feed entries, deduplicating by URL.

    Args:
        session: Database session
        feed_id: Feed ID to associate articles with
        entries: List of feedparser entry dictionaries

    Returns:
        Number of new articles saved
    """
    new_count = 0

    for entry in entries:
        # Skip entries without a link (URL)
        url = entry.get("link")
        if not url:
            logger.warning(f"Entry missing link, skipping: {entry.get('title', 'Untitled')}")
            continue

        # Check if article already exists
        existing = session.exec(
            select(Article).where(Article.url == url)
        ).first()

        if existing:
            continue

        # Extract fields with fallbacks for missing data
        article = Article(
            feed_id=feed_id,
            title=entry.get("title", "Untitled"),
            url=url,
            author=entry.get("author"),
            published_at=_parse_published_date(entry),
            summary=entry.get("summary"),
            content=entry.get("content", [{}])[0].get("value") if entry.get("content") else None,
            is_read=False,
        )

        session.add(article)
        new_count += 1

    session.commit()
    logger.info(f"Saved {new_count} new articles from feed {feed_id}")

    return new_count


async def refresh_feed(session: Session, feed: Feed) -> int:
    """
    Refresh a single feed by fetching and saving new articles.

    Args:
        session: Database session
        feed: Feed to refresh

    Returns:
        Number of new articles saved
    """
    try:
        parsed_feed = await fetch_feed(feed.url)

        # Update feed metadata
        if parsed_feed.feed.get("title"):
            feed.title = parsed_feed.feed["title"]
        feed.last_fetched_at = datetime.now()
        session.add(feed)
        session.commit()

        # Save articles
        new_count = save_articles(session, feed.id, parsed_feed.entries)

        return new_count

    except Exception as e:
        logger.error(f"Failed to refresh feed {feed.url}: {e}")
        raise
