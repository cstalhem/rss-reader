"""Tests for scoring cancellation handling and stuck-state recovery."""

import asyncio
from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlmodel import create_engine

import backend.database as database_module
import backend.scheduler as scheduler_module
import backend.scoring_queue as scoring_queue_module
from backend.models import Article, Feed
from backend.prompts import CategoryResponse
from backend.scoring import get_scoring_activity
from backend.scoring_queue import ScoringQueue


@pytest.mark.asyncio
async def test_process_next_batch_requeues_cancelled_article(
    test_session,
    sample_feed: Feed,
    monkeypatch: pytest.MonkeyPatch,
):
    article = Article(
        feed_id=sample_feed.id,
        title="Cancellation test article",
        url="https://example.com/cancelled-article",
        published_at=datetime.now(),
        summary="summary",
        content="content",
        scoring_state="queued",
    )
    test_session.add(article)
    test_session.commit()
    test_session.refresh(article)

    runtime = SimpleNamespace(
        ready=True,
        provider="ollama",
        model="test-model",
        endpoint="http://localhost:11434",
        thinking=False,
    )

    async def fake_readiness(*_args, **_kwargs):
        return runtime

    class FakeProvider:
        async def categorize(self, *_args, **_kwargs):
            return CategoryResponse(categories=[], suggested_new=[])

        async def score(self, *_args, **_kwargs):
            raise asyncio.CancelledError()

    monkeypatch.setattr(scoring_queue_module, "evaluate_task_readiness", fake_readiness)
    monkeypatch.setattr(
        scoring_queue_module, "get_provider", lambda _name: FakeProvider()
    )

    queue = ScoringQueue()
    with pytest.raises(asyncio.CancelledError):
        await queue.process_next_batch(test_session, batch_size=1)

    updated = test_session.get(Article, article.id)
    assert updated is not None
    assert updated.scoring_state == "queued"
    assert get_scoring_activity()["article_id"] is None


@pytest.mark.asyncio
async def test_scheduler_handles_cancelled_scoring_job(
    test_engine,
    monkeypatch: pytest.MonkeyPatch,
):
    async def fake_process_next_batch(*_args, **_kwargs):
        raise asyncio.CancelledError()

    monkeypatch.setattr(scheduler_module, "engine", test_engine)
    monkeypatch.setattr(
        scheduler_module.scoring_queue,
        "process_next_batch",
        fake_process_next_batch,
    )

    await scheduler_module.process_scoring_queue()


def test_create_db_and_tables_recovers_stuck_scoring_every_start(
    monkeypatch: pytest.MonkeyPatch,
):
    recover_calls: list[object] = []

    monkeypatch.setattr(
        database_module,
        "engine",
        create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        ),
    )
    monkeypatch.setattr(
        database_module,
        "_get_schema_version",
        lambda _conn: database_module.CURRENT_SCHEMA_VERSION,
    )
    monkeypatch.setattr(
        database_module,
        "_recover_stuck_scoring",
        lambda conn: recover_calls.append(conn),
    )
    monkeypatch.setattr(database_module, "_run_alembic_migrations", lambda: None)

    database_module.create_db_and_tables()

    assert len(recover_calls) == 1
