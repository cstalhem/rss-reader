"""Ollama-specific endpoints: health, models, config, downloads, prompts."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session

from backend import ollama_service
from backend.deps import get_session
from backend.llm_providers.ollama import get_ollama_provider_config
from backend.llm_providers.registry import get_provider

# --- Ollama schemas (local to this router) ---


class OllamaHealthResponse(BaseModel):
    connected: bool
    version: str | None
    latency_ms: int | None


class TestConnectionRequest(BaseModel):
    base_url: str
    port: int = Field(ge=1, le=65535)


class OllamaModelResponse(BaseModel):
    name: str
    size: int
    parameter_size: str | None
    quantization_level: str | None
    is_loaded: bool


class PullModelRequest(BaseModel):
    model: str


class OllamaConfigUpdate(BaseModel):
    base_url: str
    port: int = Field(ge=1, le=65535)
    categorization_model: str | None
    scoring_model: str | None
    use_separate_models: bool


class OllamaConfigResponse(OllamaConfigUpdate):
    pass


class OllamaPromptsResponse(BaseModel):
    categorization_prompt: str
    scoring_prompt: str


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["ollama"])


# --- Ollama-specific endpoints ---


@router.get("/ollama/health", response_model=OllamaHealthResponse)
async def ollama_health(session: Session = Depends(get_session)):
    """Check Ollama server connectivity, version, and latency."""
    from backend.llm_providers.base import ProviderTaskConfig

    config = get_ollama_provider_config(session)
    provider = get_provider("ollama")
    task_config = ProviderTaskConfig(
        endpoint=config.endpoint, model=None, thinking=False
    )
    result = await provider.health(task_config)
    return OllamaHealthResponse(**result)


@router.post("/ollama/test-connection", response_model=OllamaHealthResponse)
async def test_ollama_connection(request: TestConnectionRequest):
    """Test Ollama connectivity with arbitrary host/port (no DB dependency)."""
    endpoint = f"{request.base_url.rstrip('/')}:{request.port}"
    result = await ollama_service.check_health(endpoint)
    return OllamaHealthResponse(**result)


@router.get("/ollama/models", response_model=list[OllamaModelResponse])
async def ollama_models(session: Session = Depends(get_session)):
    """List locally available Ollama models with loaded status."""
    from backend.llm_providers.base import ProviderTaskConfig

    config = get_ollama_provider_config(session)
    provider = get_provider("ollama")
    task_config = ProviderTaskConfig(
        endpoint=config.endpoint, model=None, thinking=False
    )
    models = await provider.list_models(task_config)
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
