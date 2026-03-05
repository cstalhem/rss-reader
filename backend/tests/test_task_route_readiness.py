"""Tests for task-route runtime resolution and readiness reasons."""

import json

import pytest
from sqlmodel import Session

from backend.deps import (
    TASK_CATEGORIZATION,
    evaluate_task_readiness,
    resolve_task_runtime,
)
from backend.llm_providers.registry import get_provider
from backend.models import LLMProviderConfig, LLMTaskRoute


def _ollama_config_json(model: str = "qwen3:4b") -> str:
    return json.dumps(
        {
            "base_url": "http://localhost",
            "port": 11434,
            "categorization_model": model,
            "scoring_model": model,
            "use_separate_models": False,
            "thinking": False,
        }
    )


def test_resolve_task_runtime_no_providers(test_session: Session):
    """Fresh install: no provider rows, no task routes → reason is no_provider."""
    runtime = resolve_task_runtime(test_session, TASK_CATEGORIZATION)
    assert runtime.ready is False
    assert runtime.reason == "no_provider"
    assert runtime.provider == ""


def test_resolve_task_runtime_provider_config_missing(test_session: Session):
    test_session.add(
        LLMTaskRoute(
            task=TASK_CATEGORIZATION,
            provider="openai",
            model="gpt-4.1-mini",
        )
    )
    test_session.commit()

    runtime = resolve_task_runtime(test_session, TASK_CATEGORIZATION)
    assert runtime.ready is False
    assert runtime.reason == "provider_unconfigured"


def test_resolve_task_runtime_provider_disabled(test_session: Session):
    test_session.add(
        LLMProviderConfig(
            provider="ollama",
            enabled=False,
            config_json=_ollama_config_json(),
        )
    )
    test_session.add(
        LLMTaskRoute(
            task=TASK_CATEGORIZATION,
            provider="ollama",
            model="qwen3:4b",
        )
    )
    test_session.commit()

    runtime = resolve_task_runtime(test_session, TASK_CATEGORIZATION)
    assert runtime.ready is False
    assert runtime.reason == "provider_disabled"


def test_parse_config_returns_provider_task_config():
    """OllamaProvider.parse_config() returns correct ProviderTaskConfig."""
    from backend.llm_providers.base import ProviderTaskConfig
    from backend.llm_providers.ollama import OllamaProvider

    provider = OllamaProvider()
    config_json = json.dumps(
        {
            "base_url": "http://myhost",
            "port": 9999,
            "categorization_model": "cat-model",
            "scoring_model": "score-model",
            "use_separate_models": True,
            "thinking": False,
        }
    )

    result = provider.parse_config(config_json, "categorization")
    assert isinstance(result, ProviderTaskConfig)
    assert result.endpoint == "http://myhost:9999"
    assert result.model == "cat-model"
    assert result.thinking is False

    result_scoring = provider.parse_config(config_json, "scoring")
    assert result_scoring.model == "score-model"


@pytest.mark.asyncio
async def test_close_all_providers(monkeypatch):
    """close_all_providers() calls close() on each registered provider."""
    from backend.llm_providers.registry import PROVIDERS, close_all_providers

    closed = []

    class FakeProvider:
        name = "fake"

        async def close(self):
            closed.append(self.name)

    fake = FakeProvider()
    monkeypatch.setitem(PROVIDERS, "fake", fake)

    await close_all_providers()

    assert "fake" in closed


def test_resolve_task_runtime_ready_via_generic_path(test_session: Session):
    """Configured provider + task route resolves as ready through generic path."""
    test_session.add(
        LLMProviderConfig(
            provider="ollama",
            enabled=True,
            config_json=_ollama_config_json(model="qwen3:4b"),
        )
    )
    test_session.add(
        LLMTaskRoute(
            task=TASK_CATEGORIZATION,
            provider="ollama",
            model="qwen3:4b",
        )
    )
    test_session.commit()

    runtime = resolve_task_runtime(test_session, TASK_CATEGORIZATION)
    assert runtime.ready is True
    assert runtime.reason is None
    assert runtime.model == "qwen3:4b"
    assert runtime.endpoint == "http://localhost:11434"
    assert runtime.provider == "ollama"


@pytest.mark.asyncio
async def test_evaluate_task_readiness_model_missing(
    test_session: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    test_session.add(
        LLMProviderConfig(
            provider="ollama",
            enabled=True,
            config_json=_ollama_config_json(model="qwen3:4b"),
        )
    )
    test_session.add(
        LLMTaskRoute(
            task=TASK_CATEGORIZATION,
            provider="ollama",
            model="qwen3:4b",
        )
    )
    test_session.commit()

    provider = get_provider("ollama")

    async def fake_health(endpoint: str) -> dict:
        return {"connected": True, "version": "test", "latency_ms": 1}

    async def fake_list_models(endpoint: str) -> list[dict]:
        return [{"name": "qwen3:8b"}]

    monkeypatch.setattr(provider, "health", fake_health)
    monkeypatch.setattr(provider, "list_models", fake_list_models)

    runtime = await evaluate_task_readiness(test_session, TASK_CATEGORIZATION)
    assert runtime.ready is False
    assert runtime.reason == "model_missing"
