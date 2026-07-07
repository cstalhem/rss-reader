"""Tests for scoring cancellation handling and stuck-state recovery."""

import asyncio
from datetime import datetime

import pytest
from sqlmodel import create_engine

import backend.database as database_module
import backend.scheduler as scheduler_module
from backend.deps import TASK_CATEGORIZATION
from backend.models import Article, Feed
from backend.scoring_queue import CategorizationWorker, get_activity


@pytest.mark.asyncio
async def test_categorization_requeues_cancelled_article(
    test_session,
    sample_feed: Feed,
    fake_llm,
):
    """Cancellation during categorization re-queues the article."""
    article = Article(
        feed_id=sample_feed.id,
        title="Cancellation test article",
        url="https://example.com/cancelled-article",
        published_at=datetime.now(),
        summary="summary",
        content="content",
        categorization_state="queued",
        scoring_state="unscored",
    )
    test_session.add(article)
    test_session.commit()
    test_session.refresh(article)

    fake_llm.queue("categorization", asyncio.CancelledError())

    worker = CategorizationWorker()
    with pytest.raises(asyncio.CancelledError):
        await worker.process_next_batch(test_session, batch_size=1)

    updated = test_session.get(Article, article.id)
    assert updated is not None
    assert updated.categorization_state == "queued"
    assert get_activity(TASK_CATEGORIZATION).article_id is None


@pytest.mark.asyncio
async def test_scheduler_handles_cancelled_pipeline_job(
    test_engine,
    fake_llm,
    monkeypatch: pytest.MonkeyPatch,
):
    """CancelledError during pipeline doesn't propagate."""

    async def fake_cat_batch(*_args, **_kwargs):
        raise asyncio.CancelledError()

    async def fake_score_batch(*_args, **_kwargs):
        raise asyncio.CancelledError()

    monkeypatch.setattr(scheduler_module, "engine", test_engine)
    monkeypatch.setattr(
        scheduler_module.categorization_worker,
        "process_next_batch",
        fake_cat_batch,
    )
    monkeypatch.setattr(
        scheduler_module.scoring_worker,
        "process_next_batch",
        fake_score_batch,
    )

    await scheduler_module.process_pipeline()


def test_create_db_and_tables_recovers_stuck_scoring_every_start(
    monkeypatch: pytest.MonkeyPatch,
):
    recover_calls: list[object] = []

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    monkeypatch.setattr(database_module, "engine", engine)
    monkeypatch.setattr(
        database_module,
        "_recover_stuck_scoring",
        lambda conn: recover_calls.append(conn),
    )
    monkeypatch.setattr(
        database_module,
        "_seed_default_categories",
        lambda conn: None,
    )
    monkeypatch.setattr(database_module, "_run_alembic_migrations", lambda: None)

    database_module.create_db_and_tables()

    assert len(recover_calls) == 1
