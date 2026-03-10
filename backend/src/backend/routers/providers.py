"""Provider-agnostic endpoints: list, disconnect, config dispatch, models, task routes."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlmodel import Session, select

from backend.deps import (
    TASK_CATEGORIZATION,
    TASK_SCORING,
    get_or_create_preferences,
    get_provider_config_row,
    get_session,
    upsert_task_route,
)
from backend.llm_providers.ollama import (
    OLLAMA_PROVIDER,
    OllamaProviderConfig,
)
from backend.llm_providers.registry import get_provider
from backend.models import LLMProviderConfig, LLMTaskRoute
from backend.schemas import (
    AvailableModel,
    ProviderListItem,
    TaskRouteItem,
    TaskRoutesResponse,
    TaskRoutesUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["providers"])


# --- Provider config save handlers ---
# Each provider registers a handler that validates and persists its config.


def _save_ollama_config(
    session: Session,
    body: dict,
) -> dict:
    """Validate and save Ollama provider config."""
    try:
        config = OllamaProviderConfig(
            base_url=body.get("base_url", ""),
            port=body.get("port", 11434),
            categorization_model=body.get("categorization_model"),
            scoring_model=body.get("scoring_model"),
            use_separate_models=body.get("use_separate_models", False),
            thinking=False,
            batch_size=body.get("batch_size", 1),
        )
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    row = get_provider_config_row(session, OLLAMA_PROVIDER)
    if not row:
        row = LLMProviderConfig(
            provider=OLLAMA_PROVIDER, enabled=True, config_json="{}"
        )
    row.config_json = config.model_dump_json()
    row.updated_at = datetime.now()
    session.add(row)

    # Sync task route defaults
    upsert_task_route(
        session,
        TASK_CATEGORIZATION,
        OLLAMA_PROVIDER,
        config.default_model_for_task(TASK_CATEGORIZATION),
    )
    upsert_task_route(
        session,
        TASK_SCORING,
        OLLAMA_PROVIDER,
        config.default_model_for_task(TASK_SCORING),
    )

    session.commit()

    return {
        "base_url": config.base_url,
        "port": config.port,
        "categorization_model": config.categorization_model,
        "scoring_model": config.scoring_model,
        "use_separate_models": config.use_separate_models,
        "batch_size": config.batch_size,
    }


def _save_google_config(
    session: Session,
    body: dict,
) -> dict:
    """Validate and save Google provider config (encrypts API key)."""
    from backend.llm_providers.google import save_google_provider_config

    return save_google_provider_config(session, body)


# --- Provider endpoints ---


@router.get("/providers", response_model=list[ProviderListItem])
def list_providers(session: Session = Depends(get_session)):
    """List all configured providers."""
    rows = session.exec(select(LLMProviderConfig)).all()
    return [ProviderListItem(provider=row.provider) for row in rows]


@router.delete("/providers/{provider}")
def disconnect_provider(provider: str, session: Session = Depends(get_session)):
    """Disconnect a provider: delete its config and all task routes referencing it."""
    row = get_provider_config_row(session, provider)
    if not row:
        raise HTTPException(status_code=404, detail=f"Provider not found: {provider}")

    routes = session.exec(
        select(LLMTaskRoute).where(LLMTaskRoute.provider == provider)
    ).all()
    for route in routes:
        session.delete(route)
    session.flush()

    session.delete(row)
    session.commit()
    return {"ok": True}


@router.put("/providers/{provider}/config")
def save_provider_config(
    provider: str,
    body: dict,
    session: Session = Depends(get_session),
):
    """Save provider-specific config. Dispatches based on provider name."""
    handlers = {
        "ollama": _save_ollama_config,
        "google": _save_google_config,
    }
    handler = handlers.get(provider)
    if not handler:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")

    return handler(session, body)


# --- Task-route endpoints ---


@router.get("/task-routes", response_model=TaskRoutesResponse)
def get_task_routes(session: Session = Depends(get_session)):
    """Get current model assignments and use_separate_models preference."""
    routes = session.exec(select(LLMTaskRoute)).all()
    preferences = get_or_create_preferences(session)
    return TaskRoutesResponse(
        routes=[
            TaskRouteItem(task=r.task, provider=r.provider, model=r.model)
            for r in routes
        ],
        use_separate_models=preferences.use_separate_models,
    )


@router.put("/task-routes")
def save_task_routes(
    data: TaskRoutesUpdate,
    session: Session = Depends(get_session),
):
    """Save model assignments and use_separate_models preference."""
    upsert_task_route(
        session,
        TASK_CATEGORIZATION,
        data.categorization.provider,
        data.categorization.model,
    )
    upsert_task_route(session, TASK_SCORING, data.scoring.provider, data.scoring.model)

    preferences = get_or_create_preferences(session)
    preferences.use_separate_models = data.use_separate_models
    session.add(preferences)
    session.commit()
    return {"ok": True}


# --- Aggregated models endpoint ---


@router.get("/models", response_model=list[AvailableModel])
async def list_available_models(session: Session = Depends(get_session)):
    """Aggregate available models from all configured providers."""
    provider_rows = session.exec(select(LLMProviderConfig)).all()
    all_models: list[AvailableModel] = []

    for row in provider_rows:
        try:
            provider = get_provider(row.provider)
        except KeyError:
            logger.warning("Unknown provider in config: %s", row.provider)
            continue

        try:
            parsed_config = provider.parse_config(row.config_json, "categorization")
            if parsed_config.endpoint is None and parsed_config.api_key is None:
                continue
            models = await provider.list_models(parsed_config)
        except Exception:
            logger.warning(
                "Failed to list models for provider: %s", row.provider, exc_info=True
            )
            continue

        for m in models:
            all_models.append(
                AvailableModel(
                    provider=row.provider,
                    name=m.get("name", ""),
                    size=m.get("size"),
                    parameter_size=m.get("parameter_size"),
                    quantization_level=m.get("quantization_level"),
                    is_loaded=m.get("is_loaded"),
                )
            )

    return all_models
