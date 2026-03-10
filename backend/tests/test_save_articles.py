from collections.abc import Callable
from datetime import datetime
from time import struct_time

from sqlmodel import Session, select

from backend.feeds import _parse_published_date, save_articles
from backend.models import Article, Feed

# --- _parse_published_date tests (pure function, no fixtures) ---


def test_parse_date_published_parsed():
    # struct_time: (year, month, day, hour, minute, second, weekday, julian_day, dst)
    entry = {"published_parsed": struct_time((2024, 1, 15, 10, 30, 0, 0, 15, 0))}

    result = _parse_published_date(entry)

    assert result == datetime(2024, 1, 15, 10, 30, 0)


def test_parse_date_updated_fallback():
    entry = {"updated_parsed": struct_time((2024, 6, 1, 8, 0, 0, 5, 153, 0))}

    result = _parse_published_date(entry)

    assert result == datetime(2024, 6, 1, 8, 0, 0)


def test_parse_date_none():
    result = _parse_published_date({})

    assert result is None


# --- save_articles tests (sync, use test_session + make_feed) ---


def test_save_basic(test_session: Session, make_feed: Callable[..., Feed]):
    feed = make_feed()
    entries = [
        {"link": "https://example.com/a1", "title": "Article One"},
        {"link": "https://example.com/a2", "title": "Article Two"},
    ]

    new_count, new_ids = save_articles(test_session, feed.id, entries)

    assert new_count == 2
    assert len(new_ids) == 2
    articles = test_session.exec(select(Article)).all()
    assert len(articles) == 2


def test_save_deduplication(
    test_session: Session,
    make_feed: Callable[..., Feed],
    make_article: Callable[..., Article],
):
    feed = make_feed()
    make_article(feed.id, url="https://example.com/existing")
    entries = [{"link": "https://example.com/existing", "title": "Duplicate"}]

    new_count, new_ids = save_articles(test_session, feed.id, entries)

    assert new_count == 0
    assert new_ids == []


def test_save_mixed_new_and_existing(
    test_session: Session,
    make_feed: Callable[..., Feed],
    make_article: Callable[..., Article],
):
    feed = make_feed()
    make_article(feed.id, url="https://example.com/old")
    entries = [
        {"link": "https://example.com/old", "title": "Existing"},
        {"link": "https://example.com/new-1", "title": "New One"},
        {"link": "https://example.com/new-2", "title": "New Two"},
    ]

    new_count, new_ids = save_articles(test_session, feed.id, entries)

    assert new_count == 2
    assert len(new_ids) == 2


def test_save_skips_no_link(test_session: Session, make_feed: Callable[..., Feed]):
    feed = make_feed()
    entries = [{"title": "No Link Entry"}]

    new_count, new_ids = save_articles(test_session, feed.id, entries)

    assert new_count == 0
    assert new_ids == []


def test_save_field_fallbacks(test_session: Session, make_feed: Callable[..., Feed]):
    feed = make_feed()
    entries = [{"link": "https://example.com/minimal"}]

    save_articles(test_session, feed.id, entries)

    article = test_session.exec(
        select(Article).where(Article.url == "https://example.com/minimal")
    ).one()
    assert article.title == "Untitled"
    assert article.author is None
    assert article.published_at is None
    assert article.summary is None
    assert article.content is None
    assert article.is_read is False


def test_save_content_extraction(test_session: Session, make_feed: Callable[..., Feed]):
    feed = make_feed()
    entries = [
        {
            "link": "https://example.com/with-content",
            "title": "Has Content",
            "content": [{"value": "<p>Full body here.</p>"}],
        }
    ]

    save_articles(test_session, feed.id, entries)

    article = test_session.exec(
        select(Article).where(Article.url == "https://example.com/with-content")
    ).one()
    assert article.content == "<p>Full body here.</p>"


def test_save_empty_entries(test_session: Session, make_feed: Callable[..., Feed]):
    feed = make_feed()

    new_count, new_ids = save_articles(test_session, feed.id, [])

    assert new_count == 0
    assert new_ids == []


# --- content_markdown population tests ---


def test_save_populates_content_markdown(
    test_session: Session, make_feed: Callable[..., Feed]
):
    feed = make_feed()
    entries = [
        {
            "link": "https://example.com/md-test",
            "title": "Markdown Test",
            "content": [{"value": "<h2>Hello</h2><p>World</p>"}],
        }
    ]

    save_articles(test_session, feed.id, entries)

    article = test_session.exec(
        select(Article).where(Article.url == "https://example.com/md-test")
    ).one()
    assert article.content_markdown is not None
    assert "## Hello" in article.content_markdown
    assert "World" in article.content_markdown


def test_save_no_content_no_markdown(
    test_session: Session, make_feed: Callable[..., Feed]
):
    feed = make_feed()
    entries = [{"link": "https://example.com/no-content", "title": "No Content"}]

    save_articles(test_session, feed.id, entries)

    article = test_session.exec(
        select(Article).where(Article.url == "https://example.com/no-content")
    ).one()
    assert article.content_markdown is None
