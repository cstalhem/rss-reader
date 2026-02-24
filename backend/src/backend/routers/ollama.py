"""Ollama health, models, config, downloads, and prompts endpoints."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from backend import ollama_service
from backend.deps import (
    get_ollama_provider_config,
    get_or_create_preferences,
    get_session,
    sync_ollama_task_routes,
    upsert_ollama_provider_config,
)
from backend.llm_providers.ollama import OllamaProviderConfig
from backend.llm_providers.registry import get_provider
from backend.schemas import (
    OllamaConfigResponse,
    OllamaConfigUpdate,
    OllamaHealthResponse,
    OllamaModelResponse,
    OllamaPromptsResponse,
    PullModelRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ollama", tags=["ollama"])


@router.get("/health", response_model=OllamaHealthResponse)
async def ollama_health(session: Session = Depends(get_session)):
    """Check Ollama server connectivity, version, and latency."""
    config = get_ollama_provider_config(session)
    provider = get_provider("ollama")
    result = await provider.health(config.endpoint)
    return OllamaHealthResponse(**result)


@router.get("/models", response_model=list[OllamaModelResponse])
async def ollama_models(session: Session = Depends(get_session)):
    """List locally available Ollama models with loaded status."""
    config = get_ollama_provider_config(session)
    provider = get_provider("ollama")
    models = await provider.list_models(config.endpoint)
    return [OllamaModelResponse(**m) for m in models]


@router.get("/config", response_model=OllamaConfigResponse)
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


@router.put("/config", response_model=OllamaConfigResponse)
def update_ollama_config(
    update: OllamaConfigUpdate,
    session: Session = Depends(get_session),
):
    """Save Ollama provider config. Rescoring is a separate POST /api/scoring."""
    preferences = get_or_create_preferences(session)
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

    preferences.active_llm_provider = "ollama"
    session.add(preferences)
    session.commit()

    return OllamaConfigResponse(
        base_url=config.base_url,
        port=config.port,
        categorization_model=config.categorization_model,
        scoring_model=config.scoring_model,
        use_separate_models=config.use_separate_models,
    )


@router.get("/prompts", response_model=OllamaPromptsResponse)
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


@router.post("/downloads")
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


@router.delete("/downloads")
async def cancel_download():
    """Cancel an active model download."""
    ollama_service.cancel_download()
    return {"status": "cancelled"}


@router.get("/downloads")
async def get_download_status():
    """Get current download state for navigate-away resilience."""
    return ollama_service.get_download_status()


@router.delete("/models/{name:path}")
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
