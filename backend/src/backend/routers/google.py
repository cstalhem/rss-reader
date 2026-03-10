"""Google-specific endpoints: test key, config, available models."""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from backend.deps import get_provider_config_row, get_session
from backend.llm_providers.google import (
    GOOGLE_PROVIDER,
    GoogleProviderConfig,
    _decrypt_api_key,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["google"])


# --- Schemas ---


class TestKeyRequest(BaseModel):
    api_key: str


class TestKeyResponse(BaseModel):
    valid: bool
    error: str | None = None


class GoogleConfigResponse(BaseModel):
    api_key_set: bool
    api_key_preview: str
    selected_models: list[str]
    batch_size: int


class GoogleModelItem(BaseModel):
    name: str
    display_name: str
    description: str


# --- Endpoints ---


@router.post("/google/test-key", response_model=TestKeyResponse)
async def test_google_key(request: TestKeyRequest):
    """Validate an API key without saving it."""
    from backend.llm_providers.base import ProviderTaskConfig
    from backend.llm_providers.registry import get_provider

    provider = get_provider(GOOGLE_PROVIDER)
    config = ProviderTaskConfig(
        endpoint=None, model=None, thinking=False, api_key=request.api_key
    )
    result = await provider.health(config)
    if result.get("connected"):
        return TestKeyResponse(valid=True)
    return TestKeyResponse(valid=False, error=result.get("error"))


@router.get("/google/config", response_model=GoogleConfigResponse)
def get_google_config(session: Session = Depends(get_session)):
    """Return saved config with API key masked (never plaintext)."""
    row = get_provider_config_row(session, GOOGLE_PROVIDER)
    if not row:
        return GoogleConfigResponse(
            api_key_set=False, api_key_preview="", selected_models=[], batch_size=5
        )

    try:
        config = GoogleProviderConfig.model_validate_json(row.config_json)
    except Exception:
        return GoogleConfigResponse(
            api_key_set=False, api_key_preview="", selected_models=[], batch_size=5
        )

    key_preview = ""
    if config.api_key_encrypted:
        decrypted = _decrypt_api_key(config)
        if decrypted and len(decrypted) >= 4:
            key_preview = f"...{decrypted[-4:]}"

    return GoogleConfigResponse(
        api_key_set=bool(config.api_key_encrypted),
        api_key_preview=key_preview,
        selected_models=config.selected_models,
        batch_size=config.batch_size,
    )


@router.get("/google/models/available", response_model=list[GoogleModelItem])
async def list_google_available_models(session: Session = Depends(get_session)):
    """List full Gemini model catalog (for panel search/browse)."""
    from backend.llm_providers.base import ProviderTaskConfig
    from backend.llm_providers.registry import get_provider

    row = get_provider_config_row(session, GOOGLE_PROVIDER)
    if not row:
        return []

    try:
        config = GoogleProviderConfig.model_validate_json(row.config_json)
    except Exception:
        return []

    api_key = _decrypt_api_key(config)
    if not api_key:
        return []

    provider = get_provider(GOOGLE_PROVIDER)
    task_config = ProviderTaskConfig(
        endpoint=None, model=None, thinking=False, api_key=api_key
    )
    models = await provider.list_models(task_config)

    return [
        GoogleModelItem(
            name=m.get("name", ""),
            display_name=m.get("display_name", ""),
            description=m.get("description", ""),
        )
        for m in models
    ]


