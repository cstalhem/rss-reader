"""Tests for Ollama config read/write through provider config storage."""

import json

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models import LLMProviderConfig, LLMTaskRoute


def test_get_ollama_config_defaults(test_client: TestClient):
    response = test_client.get("/api/ollama/config")
    assert response.status_code == 200

    data = response.json()
    assert data["base_url"] == "http://localhost"
    assert data["port"] == 11434
    assert data["categorization_model"] is None
    assert data["scoring_model"] is None
    assert data["use_separate_models"] is False
    assert data["thinking"] is False


def test_update_ollama_config_persists_provider_config_and_routes(
    test_client: TestClient,
    test_session: Session,
):
    payload = {
        "base_url": "http://192.168.1.12",
        "port": 11435,
        "categorization_model": "qwen3:4b",
        "scoring_model": "qwen3:8b",
        "use_separate_models": True,
        "thinking": True,
    }

    response = test_client.put("/api/ollama/config", json=payload)
    assert response.status_code == 200
    assert response.json() == payload

    provider_row = test_session.exec(
        select(LLMProviderConfig).where(LLMProviderConfig.provider == "ollama")
    ).first()
    assert provider_row is not None

    config_json = json.loads(provider_row.config_json)
    assert config_json == payload

    task_routes = test_session.exec(
        select(LLMTaskRoute).order_by(LLMTaskRoute.task)
    ).all()
    assert len(task_routes) == 2
    assert task_routes[0].task == "categorization"
    assert task_routes[0].provider == "ollama"
    assert task_routes[0].model == "qwen3:4b"
    assert task_routes[1].task == "scoring"
    assert task_routes[1].provider == "ollama"
    assert task_routes[1].model == "qwen3:8b"


def test_scoring_status_exposes_task_readiness_keys(test_client: TestClient):
    response = test_client.get("/api/scoring/status")
    assert response.status_code == 200

    data = response.json()
    assert "categorization_ready" in data
    assert "categorization_ready_reason" in data
    assert "score_ready" in data
    assert "score_ready_reason" in data
    assert "scoring_ready" in data
    assert "scoring_ready_reason" in data
