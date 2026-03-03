from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from backend.deps import get_session
from backend.main import app
from backend.models import Article, Category, Feed


@pytest.fixture(name="test_engine")
def test_engine_fixture():
    """Create an in-memory test database engine."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(name="test_session")
def test_session_fixture(test_engine):
    """Create a test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture(name="make_feed")
def make_feed_fixture(test_session: Session):
    """Factory fixture for creating feeds with sensible defaults."""
    _counter = 0

    def _make(**overrides) -> Feed:
        nonlocal _counter
        _counter += 1
        defaults = {
            "url": f"https://example.com/feed-{_counter}.xml",
            "title": f"Test Feed {_counter}",
            "last_fetched_at": datetime.now(),
        }
        defaults.update(overrides)
        feed = Feed(**defaults)
        test_session.add(feed)
        test_session.commit()
        test_session.refresh(feed)
        return feed

    return _make


@pytest.fixture(name="make_article")
def make_article_fixture(test_session: Session):
    """Factory fixture for creating articles with sensible defaults."""
    _counter = 0

    def _make(feed_id: int, **overrides) -> Article:
        nonlocal _counter
        _counter += 1
        defaults = {
            "feed_id": feed_id,
            "title": f"Test Article {_counter}",
            "url": f"https://example.com/article-{_counter}",
            "published_at": datetime.now(),
            "is_read": False,
            "scoring_state": "scored",
            "composite_score": 1.0,
        }
        defaults.update(overrides)
        article = Article(**defaults)
        test_session.add(article)
        test_session.commit()
        test_session.refresh(article)
        return article

    return _make


@pytest.fixture(name="make_category")
def make_category_fixture(test_session: Session):
    """Factory fixture for creating categories with sensible defaults."""
    _counter = 0

    def _make(**overrides) -> Category:
        nonlocal _counter
        _counter += 1
        defaults = {
            "display_name": f"Category {_counter}",
            "slug": f"category-{_counter}",
            "is_seen": True,
        }
        defaults.update(overrides)
        category = Category(**defaults)
        test_session.add(category)
        test_session.commit()
        test_session.refresh(category)
        return category

    return _make


@pytest.fixture(name="test_client")
def test_client_fixture(test_engine, monkeypatch):
    """Create a TestClient with dependency override for database session.

    Patches lifespan side-effects (production DB, scheduler, Ollama client)
    to no-ops so TestClient startup doesn't touch real resources.
    """
    monkeypatch.setattr("backend.main.create_db_and_tables", lambda: None)
    monkeypatch.setattr("backend.main.start_scheduler", lambda: None)
    monkeypatch.setattr("backend.main.shutdown_scheduler", lambda: None)

    async def _noop_close():
        pass

    monkeypatch.setattr("backend.main.close_ollama_client", _noop_close)

    def get_test_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(name="sample_feed")
def sample_feed_fixture(test_session: Session):
    """Insert a sample feed into the test database."""
    feed = Feed(
        url="https://example.com/feed.xml",
        title="Test Feed",
        last_fetched_at=datetime.now(),
    )
    test_session.add(feed)
    test_session.commit()
    test_session.refresh(feed)

    return feed


@pytest.fixture(name="sample_articles")
def sample_articles_fixture(test_session: Session, sample_feed: Feed):
    """Insert sample articles into the test database."""
    now = datetime.now()

    articles = [
        Article(
            feed_id=sample_feed.id,
            title="Recent Article",
            url="https://example.com/recent",
            author="Test Author",
            published_at=now - timedelta(hours=1),
            summary="A recent article summary",
            content="Full content of recent article",
            is_read=False,
            scoring_state="scored",
            composite_score=1.0,
        ),
        Article(
            feed_id=sample_feed.id,
            title="Older Article",
            url="https://example.com/older",
            author="Test Author",
            published_at=now - timedelta(days=1),
            summary="An older article summary",
            content="Full content of older article",
            is_read=False,
            scoring_state="scored",
            composite_score=1.0,
        ),
        Article(
            feed_id=sample_feed.id,
            title="Read Article",
            url="https://example.com/read",
            author="Another Author",
            published_at=now - timedelta(days=2),
            summary="A read article summary",
            content="Full content of read article",
            is_read=True,
            scoring_state="scored",
            composite_score=1.0,
        ),
    ]

    for article in articles:
        test_session.add(article)

    test_session.commit()

    for article in articles:
        test_session.refresh(article)

    return articles
