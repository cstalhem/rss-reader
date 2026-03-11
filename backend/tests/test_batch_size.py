"""Tests for per-task batch size resolution and upsert_task_route sentinel."""

import json

from sqlmodel import Session

from backend.deps import (
    _DEFAULT_BATCH_SIZE,
    TASK_CATEGORIZATION,
    TASK_SCORING,
    get_task_batch_size,
    upsert_task_route,
)
from backend.models import LLMProviderConfig, LLMTaskRoute


def _add_provider(
    session: Session, provider: str = "ollama", batch_size: int | None = None
) -> LLMProviderConfig:
    """Helper: insert an LLMProviderConfig row."""
    config = {"batch_size": batch_size} if batch_size is not None else {}
    row = LLMProviderConfig(
        provider=provider,
        config_json=json.dumps(config),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def _add_route(
    session: Session,
    task: str = "scoring",
    provider: str = "ollama",
    model: str | None = "llama3",
    batch_size: int | None = None,
) -> LLMTaskRoute:
    """Helper: insert an LLMTaskRoute row."""
    route = LLMTaskRoute(
        task=task, provider=provider, model=model, batch_size=batch_size
    )
    session.add(route)
    session.commit()
    session.refresh(route)
    return route


# --- get_task_batch_size tests ---


def test_returns_provider_default_when_no_route_override(test_session: Session):
    """Route exists but batch_size is None -> fall back to provider config."""
    _add_provider(test_session, batch_size=8)
    _add_route(test_session, task="scoring", batch_size=None)

    assert get_task_batch_size(test_session, TASK_SCORING) == 8


def test_returns_route_override_when_set(test_session: Session):
    """Route has explicit batch_size -> use it over provider config."""
    _add_provider(test_session, batch_size=8)
    _add_route(test_session, task="scoring", batch_size=3)

    assert get_task_batch_size(test_session, TASK_SCORING) == 3


def test_categorization_works_independently(test_session: Session):
    """Categorization task resolves its own batch_size independently."""
    _add_provider(test_session, provider="ollama", batch_size=12)
    _add_route(test_session, task="categorization", provider="ollama", batch_size=7)

    assert get_task_batch_size(test_session, TASK_CATEGORIZATION) == 7


def test_returns_default_when_no_route_exists(test_session: Session):
    """No route row at all -> _DEFAULT_BATCH_SIZE."""
    assert get_task_batch_size(test_session, TASK_SCORING) == _DEFAULT_BATCH_SIZE


def test_returns_default_when_no_provider_config(test_session: Session):
    """Route exists but provider config row is missing -> _DEFAULT_BATCH_SIZE."""
    # Insert route without a matching provider config
    route = LLMTaskRoute(task="scoring", provider="nonexistent", model="m")
    test_session.add(route)
    test_session.commit()

    assert get_task_batch_size(test_session, TASK_SCORING) == _DEFAULT_BATCH_SIZE


# --- upsert_task_route sentinel tests ---


def test_upsert_without_batch_size_preserves_existing(test_session: Session):
    """Calling upsert without batch_size must NOT overwrite existing value."""
    _add_provider(test_session)
    _add_route(test_session, task="scoring", batch_size=7)

    # Upsert the same route without passing batch_size
    upsert_task_route(test_session, TASK_SCORING, "ollama", "llama3")
    test_session.commit()

    route = test_session.get(LLMTaskRoute, 1)
    assert route is not None
    assert route.batch_size == 7


def test_upsert_with_explicit_batch_size_sets_it(test_session: Session):
    """Passing batch_size explicitly sets it on the route."""
    _add_provider(test_session)

    upsert_task_route(test_session, TASK_SCORING, "ollama", "llama3", batch_size=10)
    test_session.commit()

    route = test_session.get(LLMTaskRoute, 1)
    assert route is not None
    assert route.batch_size == 10


def test_upsert_with_batch_size_none_clears_override(test_session: Session):
    """Passing batch_size=None explicitly clears an existing override."""
    _add_provider(test_session)
    _add_route(test_session, task="scoring", batch_size=7)

    upsert_task_route(test_session, TASK_SCORING, "ollama", "llama3", batch_size=None)
    test_session.commit()

    route = test_session.get(LLMTaskRoute, 1)
    assert route is not None
    assert route.batch_size is None
