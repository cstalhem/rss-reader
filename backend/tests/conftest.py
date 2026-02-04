import tempfile
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from backend.database import get_session
from backend.main import app
from backend.models import Article, Feed


@pytest.fixture(name="test_engine")
def test_engine_fixture():
    """Create a test database engine using a temporary SQLite file."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        database_url = f"sqlite:///{tmp.name}"

    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
    )

    SQLModel.metadata.create_all(engine)

    yield engine

    engine.dispose()


@pytest.fixture(name="test_session")
def test_session_fixture(test_engine):
    """Create a test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture(name="test_client")
def test_client_fixture(test_engine):
    """Create a TestClient with dependency override for database session."""
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
        ),
    ]

    for article in articles:
        test_session.add(article)

    test_session.commit()

    for article in articles:
        test_session.refresh(article)

    return articles
