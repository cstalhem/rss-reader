"""Ollama health, models, config, downloads, and prompts endpoints.

Also hosts provider, task-route, and aggregated models endpoints.

TODO: Extract provider, config, and task-route endpoints to dedicated routers
(e.g., routers/providers.py, routers/task_routes.py) when adding a
second provider implementation. These live here temporarily because
Ollama is the only active provider.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from backend import ollama_service
from backend.deps import (
    OLLAMA_PROVIDER,
    TASK_CATEGORIZATION,
    TASK_SCORING,
    get_ollama_provider_config,
    get_or_create_preferences,
    get_provider_config_row,
    get_session,
    sync_ollama_task_routes,
    upsert_ollama_provider_config,
    upsert_task_route,
)
from backend.llm_providers.ollama import OllamaProviderConfig
from backend.llm_providers.registry import get_provider
from backend.models import LLMProviderConfig, LLMTaskRoute
from backend.schemas import (
    AvailableModel,
    OllamaConfigResponse,
    OllamaConfigUpdate,
    OllamaHealthResponse,
    OllamaModelResponse,
    OllamaPromptsResponse,
    ProviderListItem,
    PullModelRequest,
    TaskRouteItem,
    TaskRoutesResponse,
    TaskRoutesUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["ollama"])


# --- Provider endpoints ---
# TODO: Move to routers/providers.py when adding a second provider.


@router.get("/providers", response_model=list[ProviderListItem])
def list_providers(session: Session = Depends(get_session)):
    """List all configured providers. Disconnect deletes the row, so all returned are active."""
    rows = session.exec(select(LLMProviderConfig)).all()
    return [ProviderListItem(provider=row.provider) for row in rows]


@router.delete("/providers/{provider}")
def disconnect_provider(provider: str, session: Session = Depends(get_session)):
    """Disconnect a provider: delete its config and all task routes referencing it."""
    row = get_provider_config_row(session, provider)
    if not row:
        raise HTTPException(status_code=404, detail=f"Provider not found: {provider}")

    # Delete task routes referencing this provider first (FK constraint)
    routes = session.exec(
        select(LLMTaskRoute).where(LLMTaskRoute.provider == provider)
    ).all()
    for route in routes:
        session.delete(route)
    session.flush()  # Flush child deletions before parent to satisfy FK constraint

    session.delete(row)
    session.commit()
    return {"ok": True}


@router.put("/providers/{provider}/config", response_model=OllamaConfigResponse)
def save_provider_config(
    provider: str,
    update: OllamaConfigUpdate,
    session: Session = Depends(get_session),
):
    """Save provider-specific config. Dispatches based on provider name."""
    if provider != OLLAMA_PROVIDER:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")

    config = OllamaProviderConfig(
        base_url=update.base_url,
        port=update.port,
        categorization_model=update.categorization_model,
        scoring_model=update.scoring_model,
        use_separate_models=update.use_separate_models,
        thinking=False,
    )
    upsert_ollama_provider_config(session, config)
    sync_ollama_task_routes(session, config)
    session.commit()

    return OllamaConfigResponse(
        base_url=config.base_url,
        port=config.port,
        categorization_model=config.categorization_model,
        scoring_model=config.scoring_model,
        use_separate_models=config.use_separate_models,
    )


# --- Task-route endpoints ---
# TODO: Move to routers/task_routes.py when adding a second provider.


@router.get("/task-routes", response_model=TaskRoutesResponse)
def get_task_routes(session: Session = Depends(get_session)):
    """Get current model assignments and use_separate_models preference."""
    routes = session.exec(select(LLMTaskRoute)).all()
    preferences = get_or_create_preferences(session)
    return TaskRoutesResponse(
        routes=[
            TaskRouteItem(task=r.task, provider=r.provider, model=r.model) for r in routes
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
        session, TASK_CATEGORIZATION, data.categorization.provider, data.categorization.model
    )
    upsert_task_route(
        session, TASK_SCORING, data.scoring.provider, data.scoring.model
    )

    preferences = get_or_create_preferences(session)
    preferences.use_separate_models = data.use_separate_models
    session.add(preferences)
    session.commit()
    return {"ok": True}


# --- Aggregated models endpoint ---
# TODO: Move to routers/providers.py when adding a second provider.


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
            config = get_ollama_provider_config(session) if row.provider == OLLAMA_PROVIDER else None
            endpoint = config.endpoint if config else None
            if endpoint is None:
                continue
            models = await provider.list_models(endpoint)
        except Exception:
            logger.warning("Failed to list models for provider: %s", row.provider, exc_info=True)
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


# --- Ollama-specific endpoints ---


@router.get("/ollama/health", response_model=OllamaHealthResponse)
async def ollama_health(session: Session = Depends(get_session)):
    """Check Ollama server connectivity, version, and latency."""
    config = get_ollama_provider_config(session)
    provider = get_provider("ollama")
    result = await provider.health(config.endpoint)
    return OllamaHealthResponse(**result)


@router.get("/ollama/models", response_model=list[OllamaModelResponse])
async def ollama_models(session: Session = Depends(get_session)):
    """List locally available Ollama models with loaded status."""
    config = get_ollama_provider_config(session)
    provider = get_provider("ollama")
    models = await provider.list_models(config.endpoint)
    return [OllamaModelResponse(**m) for m in models]


@router.get("/ollama/config", response_model=OllamaConfigResponse)
def get_ollama_config(
    session: Session = Depends(get_session),
):
    """Get runtime Ollama config from provider config storage."""
    config = get_ollama_provider_config(session)
    return OllamaConfigResponse(
        base_url=config.base_url,
        port=config.port,
        categorization_model=config.categorization_model,
        scoring_model=config.scoring_model,
        use_separate_models=config.use_separate_models,
    )


@router.get("/ollama/prompts", response_model=OllamaPromptsResponse)
def get_ollama_prompts():
    """Get current system prompt templates for categorization and scoring."""
    from backend.prompts import build_categorization_prompt, build_scoring_prompt

    categorization_prompt = build_categorization_prompt(
        "[Article Title]", "[Article Content]", ["example-category"]
    )
    scoring_prompt = build_scoring_prompt(
        "[Article Title]",
        "[Article Content]",
        "[User Interests]",
        "[User Anti-Interests]",
    )

    return OllamaPromptsResponse(
        categorization_prompt=categorization_prompt,
        scoring_prompt=scoring_prompt,
    )


@router.post("/ollama/downloads")
async def start_download(
    request: PullModelRequest,
    session: Session = Depends(get_session),
):
    """Start downloading a model from Ollama registry. Returns SSE stream."""
    config = get_ollama_provider_config(session)

    async def event_stream():
        try:
            async for chunk in ollama_service.pull_model_stream(
                config.endpoint, request.model
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
            yield f"data: {json.dumps({'status': 'complete'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.delete("/ollama/downloads")
async def cancel_download():
    """Cancel an active model download."""
    ollama_service.cancel_download()
    return {"status": "cancelled"}


@router.get("/ollama/downloads")
async def get_download_status():
    """Get current download state for navigate-away resilience."""
    return ollama_service.get_download_status()


@router.delete("/ollama/models/{name:path}")
async def ollama_delete_model(
    name: str,
    session: Session = Depends(get_session),
):
    """Delete a model from Ollama. Uses path type for names with colons."""
    config = get_ollama_provider_config(session)
    try:
        result = await ollama_service.delete_model(config.endpoint, name)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
