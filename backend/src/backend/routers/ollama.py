"""Ollama health, models, config, downloads, and prompts endpoints."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from backend import ollama_service
from backend.config import get_settings
from backend.deps import get_session
from backend.models import UserPreferences
from backend.schemas import (
    OllamaConfigResponse,
    OllamaConfigUpdate,
    OllamaHealthResponse,
    OllamaModelResponse,
    OllamaPromptsResponse,
    PullModelRequest,
)

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/ollama", tags=["ollama"])


@router.get("/health", response_model=OllamaHealthResponse)
async def ollama_health():
    """Check Ollama server connectivity, version, and latency."""
    result = await ollama_service.check_health(settings.ollama.host)
    return OllamaHealthResponse(**result)


@router.get("/models", response_model=list[OllamaModelResponse])
async def ollama_models():
    """List locally available Ollama models with loaded status."""
    models = await ollama_service.list_models(settings.ollama.host)
    return [OllamaModelResponse(**m) for m in models]


@router.get("/config", response_model=OllamaConfigResponse)
def get_ollama_config(
    session: Session = Depends(get_session),
):
    """Get runtime Ollama model config from UserPreferences."""
    preferences = session.exec(select(UserPreferences)).first()

    if not preferences:
        return OllamaConfigResponse(
            categorization_model=None,
            scoring_model=None,
            use_separate_models=False,
            thinking=False,
        )

    return OllamaConfigResponse(
        categorization_model=preferences.ollama_categorization_model,
        scoring_model=preferences.ollama_scoring_model,
        use_separate_models=preferences.ollama_use_separate_models,
        thinking=preferences.ollama_thinking,
    )


@router.put("/config", response_model=OllamaConfigResponse)
def update_ollama_config(
    update: OllamaConfigUpdate,
    session: Session = Depends(get_session),
):
    """Save model choices to UserPreferences. Rescoring is a separate POST /api/scoring."""
    preferences = session.exec(select(UserPreferences)).first()

    if not preferences:
        preferences = UserPreferences(
            interests="",
            anti_interests="",
            updated_at=datetime.now(),
        )
        session.add(preferences)
        session.commit()
        session.refresh(preferences)

    preferences.ollama_categorization_model = update.categorization_model
    preferences.ollama_scoring_model = update.scoring_model
    preferences.ollama_use_separate_models = update.use_separate_models
    preferences.ollama_thinking = update.thinking
    preferences.updated_at = datetime.now()

    session.add(preferences)
    session.commit()
    session.refresh(preferences)

    return OllamaConfigResponse(
        categorization_model=preferences.ollama_categorization_model,
        scoring_model=preferences.ollama_scoring_model,
        use_separate_models=preferences.ollama_use_separate_models,
        thinking=preferences.ollama_thinking,
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
async def start_download(request: PullModelRequest):
    """Start downloading a model from Ollama registry. Returns SSE stream."""

    async def event_stream():
        try:
            async for chunk in ollama_service.pull_model_stream(
                settings.ollama.host, request.model
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
async def ollama_delete_model(name: str):
    """Delete a model from Ollama. Uses path type for names with colons."""
    try:
        result = await ollama_service.delete_model(settings.ollama.host, name)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
