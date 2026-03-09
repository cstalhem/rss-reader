"""Tests for Google provider config, parse_config, and router endpoints."""

from sqlmodel import Session

from backend.deps import resolve_task_runtime
from backend.llm_providers.base import ProviderTaskConfig
from backend.llm_providers.google import (
    GOOGLE_PROVIDER,
    GoogleProvider,
    GoogleProviderConfig,
    invalidate_model_cache,
)
from backend.models import LLMProviderConfig, LLMTaskRoute


def _google_config_json(
    api_key_encrypted: str = "encrypted-key",
    selected_models: list[str] | None = None,
) -> str:
    return GoogleProviderConfig(
        api_key_encrypted=api_key_encrypted,
        selected_models=["gemini-2.5-flash"] if selected_models is None else selected_models,
    ).model_dump_json()


# --- parse_config ---


def test_parse_config_returns_provider_task_config(monkeypatch):
    """GoogleProvider.parse_config() returns correct ProviderTaskConfig."""
    # Mock decryption to avoid needing a real keyfile
    monkeypatch.setattr(
        "backend.llm_providers.google._decrypt_api_key",
        lambda config: "test-api-key",
    )

    provider = GoogleProvider()
    config_json = _google_config_json(selected_models=["gemini-2.5-flash"])
    result = provider.parse_config(config_json, "categorization")

    assert isinstance(result, ProviderTaskConfig)
    assert result.endpoint is None  # Cloud provider — no endpoint
    assert result.model == "gemini-2.5-flash"
    assert result.api_key == "test-api-key"
    assert result.thinking is False


def test_parse_config_no_selected_models(monkeypatch):
    """parse_config with no selected models returns model=None."""
    monkeypatch.setattr(
        "backend.llm_providers.google._decrypt_api_key",
        lambda config: "test-api-key",
    )

    provider = GoogleProvider()
    config_json = _google_config_json(selected_models=[])
    result = provider.parse_config(config_json, "scoring")

    assert result.model is None
    assert result.api_key == "test-api-key"


def test_parse_config_decryption_failure(monkeypatch):
    """parse_config with failed decryption returns api_key=None."""
    monkeypatch.setattr(
        "backend.llm_providers.google._decrypt_api_key",
        lambda config: "",
    )

    provider = GoogleProvider()
    config_json = _google_config_json()
    result = provider.parse_config(config_json, "categorization")

    assert result.api_key is None  # Empty string converts to None


# --- resolve_task_runtime with Google ---


def test_resolve_task_runtime_google_ready(test_session: Session, monkeypatch):
    """Google provider resolves as ready with api_key and model."""
    monkeypatch.setattr(
        "backend.llm_providers.google._decrypt_api_key",
        lambda config: "test-api-key",
    )

    test_session.add(
        LLMProviderConfig(
            provider=GOOGLE_PROVIDER,
            enabled=True,
            config_json=_google_config_json(),
        )
    )
    test_session.add(
        LLMTaskRoute(
            task="categorization",
            provider=GOOGLE_PROVIDER,
            model="gemini-2.5-flash",
        )
    )
    test_session.commit()

    runtime = resolve_task_runtime(test_session, "categorization")
    assert runtime.ready is True
    assert runtime.provider == "google"
    assert runtime.model == "gemini-2.5-flash"
    assert runtime.endpoint is None
    assert runtime.api_key == "test-api-key"


# --- Router tests ---


def test_google_config_empty(test_client):
    """GET /api/google/config returns empty config when not configured."""
    response = test_client.get("/api/google/config")
    assert response.status_code == 200
    data = response.json()
    assert data["api_key_set"] is False
    assert data["selected_models"] == []


def test_google_models_available_empty(test_client):
    """GET /api/google/models/available returns empty list when not configured."""
    response = test_client.get("/api/google/models/available")
    assert response.status_code == 200
    assert response.json() == []


def test_google_selected_models_404_when_not_configured(test_client):
    """PUT /api/google/models/selected returns 404 when not configured."""
    response = test_client.put(
        "/api/google/models/selected",
        json={"selected_models": ["gemini-2.5-flash"]},
    )
    assert response.status_code == 404


def test_save_google_config_and_read_back(test_client, monkeypatch, tmp_path):
    """PUT /api/providers/google/config saves encrypted config, GET reads it back masked."""
    from types import SimpleNamespace

    # Redirect settings.database.path to temp dir so keyfile goes there
    fake_settings = SimpleNamespace(database=SimpleNamespace(path=str(tmp_path / "test.db")))
    monkeypatch.setattr("backend.config.get_settings", lambda: fake_settings)

    response = test_client.put(
        "/api/providers/google/config",
        json={
            "api_key": "AIzaSyTestKey1234567890",
            "selected_models": ["gemini-2.5-flash"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["api_key_set"] is True
    assert data["api_key_preview"].endswith("7890")
    assert "AIzaSy" not in data["api_key_preview"]  # Full key never exposed
    assert data["selected_models"] == ["gemini-2.5-flash"]


def test_model_cache_invalidation():
    """invalidate_model_cache resets the cached data."""

    invalidate_model_cache()
    # After invalidation, accessing the module-level vars should show None/0
    from backend.llm_providers import google

    assert google._model_cache is None
    assert google._model_cache_time == 0
