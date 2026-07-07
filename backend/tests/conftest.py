import os

# Isolate tests from the repo's config/app.yaml BEFORE any backend import:
# backend modules call get_settings() at import time, so a fixture is too late.
# os.devnull parses as an empty YAML document (no settings).
os.environ["CONFIG_FILE"] = os.devnull

import re  # noqa: E402
from datetime import datetime, timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from backend.config import LLMTaskConfig
from backend.deps import TASK_CATEGORIZATION, TASK_SCORING, get_session
from backend.llm_client import LLMNotConfigured
from backend.main import app
from backend.models import Article, Category, Feed
from backend.prompts.categorization import ArticleCategoryResult


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
            "categorization_state": "categorized",
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
        }
        defaults.update(overrides)
        category = Category(**defaults)
        test_session.add(category)
        test_session.commit()
        test_session.refresh(category)
        return category

    return _make


@pytest.fixture(name="cat_result")
def cat_result_fixture():
    """Builder for per-article categorization results in canned responses."""

    def _make(
        article_id: int,
        categories: list[str] | None = None,
        proposed: str | None = None,
    ) -> ArticleCategoryResult:
        return ArticleCategoryResult(
            article_id=article_id,
            categories=categories or [],
            proposed_category=proposed,
        )

    return _make


class FakeLLMClient:
    """Canned typed responses standing in for the Azure wrapper.

    The wrapper is the single test seam (issue #89): queue an object to
    return it, queue an exception to raise it. With nothing queued, one
    plausible result is generated per article id found in the user message.

    Dispatch is keyed on the ``task`` argument ("categorization" vs
    "scoring"), NOT on the response schema — the categorization schema is
    built dynamically per batch (ADR-0006), so schema identity is unstable.
    Canned default results are built by validating plain dicts through the
    per-batch ``response_schema`` the worker hands us, so every worker test
    also exercises the real enum.
    """

    def __init__(self):
        self.queued: dict[str, list] = {}
        self.calls: list[dict] = []
        self.configured = True
        self.pauses: dict[str, float] = {}
        self.batch_sizes = {"scoring": 5, "categorization": 10, "grouping": 1}

    def queue(self, task: str, item) -> None:
        """Queue a canned response (or exception) for the next call of a task."""
        self.queued.setdefault(task, []).append(item)

    def tasks_invoked(self) -> list[str]:
        """Tasks that have been called on the wrapper, in call order."""
        return [call["task"] for call in self.calls]

    # --- wrapper interface ---

    def is_configured(self) -> bool:
        return self.configured

    def task_config(self, task: str) -> LLMTaskConfig:
        if task not in self.batch_sizes:
            raise LLMNotConfigured(f"No llm.tasks entry for task '{task}'")
        return LLMTaskConfig(
            deployment=f"{task}-deploy", batch_size=self.batch_sizes[task]
        )

    def batch_size(self, task: str) -> int:
        return self.task_config(task).batch_size

    def pause_remaining_for_task(self, task: str) -> float:
        return self.pauses.get(task, 0.0)

    async def close(self) -> None:
        pass

    async def complete(self, task, system_prompt, user_message, response_schema):
        self.calls.append(
            {
                "task": task,
                "system": system_prompt,
                "user": user_message,
                "schema": response_schema,
            }
        )
        items = self.queued.get(task)
        if items:
            item = items.pop(0)
            # BaseException covers asyncio.CancelledError too
            if isinstance(item, BaseException):
                raise item
            return item

        ids = [int(m) for m in re.findall(r"<article id:(\d+)>", user_message)]

        # Built-in plausible default per task, validated through the per-batch
        # schema so the real enum is exercised. The categorization default
        # proposes "Technology" (no enum assignment) — under the closed
        # vocabulary a bare enum label the worker doesn't know would be
        # dropped, so bootstrapping flows through the proposal channel.
        if task == TASK_CATEGORIZATION:
            results = [
                {"article_id": i, "categories": [], "proposed_category": "Technology"}
                for i in ids
            ]
            return response_schema.model_validate({"results": results})
        if task == TASK_SCORING:
            results = [
                {
                    "article_id": i,
                    "interest_score": 7,
                    "quality_score": 8,
                    "reasoning": "test",
                }
                for i in ids
            ]
            return response_schema.model_validate({"results": results})
        raise AssertionError(
            f"No canned response queued for task '{task}' ({response_schema})"
        )


@pytest.fixture(name="fake_llm")
def fake_llm_fixture(monkeypatch):
    """Replace the Azure wrapper singleton with a FakeLLMClient everywhere."""
    fake = FakeLLMClient()
    monkeypatch.setattr("backend.scoring_queue.llm_client", fake)
    monkeypatch.setattr("backend.routers.scoring.llm_client", fake)
    monkeypatch.setattr("backend.routers.categories.llm_client", fake)
    monkeypatch.setattr("backend.scheduler.llm_client", fake)
    return fake


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

    monkeypatch.setattr("backend.main.llm_client.close", _noop_close)

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
            categorization_state="categorized",
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
            categorization_state="categorized",
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
            categorization_state="categorized",
            composite_score=1.0,
        ),
    ]

    for article in articles:
        test_session.add(article)

    test_session.commit()

    for article in articles:
        test_session.refresh(article)

    return articles
