"""Google Gemini provider implementation."""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel

from backend.prompts import (
    CategoryResponse,
    ScoringResponse,
    build_categorization_prompt,
    build_scoring_prompt,
)
from backend.prompts.grouping import GroupingResponse, build_grouping_prompt

if TYPE_CHECKING:
    from sqlmodel import Session

    from backend.llm_providers.base import ProviderTaskConfig

logger = logging.getLogger(__name__)

GOOGLE_PROVIDER = "google"

# --- Config model ---


class GoogleProviderConfig(BaseModel):
    """Validated Google provider configuration stored in config_json."""

    api_key_encrypted: str = ""
    selected_models: list[str] = []


# --- In-memory model catalog cache ---

_model_cache: list[dict] | None = None
_model_cache_time: float = 0
_MODEL_CACHE_TTL = 120.0  # seconds


def invalidate_model_cache() -> None:
    """Clear the cached model list."""
    global _model_cache, _model_cache_time
    _model_cache = None
    _model_cache_time = 0


# --- Config helpers ---


def get_google_provider_config(session: Session) -> GoogleProviderConfig:
    """Load and parse Google config from DB."""
    from backend.deps import get_provider_config_row

    row = get_provider_config_row(session, GOOGLE_PROVIDER)
    if row:
        try:
            return GoogleProviderConfig.model_validate_json(row.config_json)
        except Exception:
            logger.exception("Invalid Google provider config JSON")

    return GoogleProviderConfig()


def _decrypt_api_key(config: GoogleProviderConfig) -> str:
    """Decrypt the stored API key. Returns empty string on failure."""
    if not config.api_key_encrypted:
        return ""
    try:
        import os

        from backend.config import get_settings
        from backend.encryption import decrypt_value

        settings = get_settings()
        keyfile = os.path.join(os.path.dirname(settings.database.path), ".keyfile")
        return decrypt_value(config.api_key_encrypted, keyfile)
    except Exception:
        logger.warning("Failed to decrypt Google API key — treating as unconfigured")
        return ""


def save_google_provider_config(session: Session, body: dict) -> dict:
    """Validate and persist Google config. Encrypts API key before storage."""
    import os

    from backend.config import get_settings
    from backend.deps import get_provider_config_row
    from backend.encryption import encrypt_value, get_or_create_key
    from backend.models import LLMProviderConfig

    settings = get_settings()
    keyfile = os.path.join(os.path.dirname(settings.database.path), ".keyfile")

    api_key = body.get("api_key", "")
    selected_models = body.get("selected_models", [])

    # If no new key provided, preserve existing encrypted key
    encrypted_key = ""
    if api_key:
        get_or_create_key(keyfile)
        encrypted_key = encrypt_value(api_key, keyfile)
    else:
        row = get_provider_config_row(session, GOOGLE_PROVIDER)
        if row:
            try:
                existing = GoogleProviderConfig.model_validate_json(row.config_json)
                encrypted_key = existing.api_key_encrypted
            except Exception:
                pass

    config = GoogleProviderConfig(
        api_key_encrypted=encrypted_key,
        selected_models=selected_models,
    )

    row = get_provider_config_row(session, GOOGLE_PROVIDER)
    if not row:
        row = LLMProviderConfig(
            provider=GOOGLE_PROVIDER, enabled=True, config_json="{}"
        )
    row.config_json = config.model_dump_json()
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()

    invalidate_model_cache()

    # Return masked response
    key_preview = f"...{api_key[-4:]}" if api_key and len(api_key) >= 4 else ""
    if not api_key and encrypted_key:
        # Decrypt to get preview
        decrypted = _decrypt_api_key(config)
        key_preview = (
            f"...{decrypted[-4:]}" if decrypted and len(decrypted) >= 4 else ""
        )

    return {
        "api_key_set": bool(encrypted_key),
        "api_key_preview": key_preview,
        "selected_models": selected_models,
    }


# --- Provider class ---


class GoogleProvider:
    """Provider implementation for Google Gemini API."""

    name = "google"

    def parse_config(self, config_json: str, task: str) -> ProviderTaskConfig:
        from backend.llm_providers.base import ProviderTaskConfig

        config = GoogleProviderConfig.model_validate_json(config_json)
        api_key = _decrypt_api_key(config)

        model = config.selected_models[0] if config.selected_models else None

        return ProviderTaskConfig(
            endpoint=None,
            model=model,
            thinking=False,
            api_key=api_key or None,
        )

    async def health(self, config: ProviderTaskConfig) -> dict:
        """Validate API key by listing a single model."""
        if not config.api_key:
            return {"connected": False}
        try:
            from google import genai

            client = genai.Client(api_key=config.api_key)
            # Small request to validate the key
            result = await client.aio.models.list(config={"page_size": 1})
            async for _ in result:
                break
            return {"connected": True}
        except Exception as e:
            logger.warning("Google health check failed: %s", e)
            return {"connected": False}

    async def list_models(self, config: ProviderTaskConfig) -> list[dict]:
        """List available Gemini models, with 120s cache."""
        global _model_cache, _model_cache_time

        if (
            _model_cache is not None
            and (time.time() - _model_cache_time) < _MODEL_CACHE_TTL
        ):
            return _model_cache

        if not config.api_key:
            return []

        try:
            from google import genai

            client = genai.Client(api_key=config.api_key)
            models = []
            async for model in await client.aio.models.list(config={"page_size": 100}):
                # Only include models that support generateContent
                methods = model.supported_actions or []
                if "generateContent" not in methods:
                    continue
                models.append(
                    {
                        "name": model.name or "",
                        "display_name": model.display_name or model.name or "",
                        "description": model.description or "",
                    }
                )

            _model_cache = models
            _model_cache_time = time.time()
            return models
        except Exception:
            logger.exception("Failed to list Google models")
            return []

    async def categorize(
        self,
        article_title: str,
        article_text: str,
        existing_categories: list[str],
        config: ProviderTaskConfig,
        category_hierarchy: dict[str, list[str]] | None,
        hidden_categories: list[str] | None,
    ) -> CategoryResponse:
        from google import genai
        from google.genai import types

        prompt = build_categorization_prompt(
            article_title,
            article_text,
            existing_categories,
            category_hierarchy,
            hidden_categories=hidden_categories,
        )

        client = genai.Client(api_key=config.api_key)
        response = await client.aio.models.generate_content(
            model=config.model,  # pyright: ignore[reportArgumentType]
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CategoryResponse.model_json_schema(),
                temperature=0,
            ),
        )

        result = CategoryResponse.model_validate_json(response.text)  # pyright: ignore[reportArgumentType]
        logger.info(
            "Google categorized: %d categories, %d suggestions",
            len(result.categories),
            len(result.suggested_new),
        )
        return result

    async def score(
        self,
        article_title: str,
        article_text: str,
        interests: str,
        anti_interests: str,
        config: ProviderTaskConfig,
    ) -> ScoringResponse:
        from google import genai
        from google.genai import types

        prompt = build_scoring_prompt(
            article_title, article_text, interests, anti_interests
        )

        client = genai.Client(api_key=config.api_key)
        response = await client.aio.models.generate_content(
            model=config.model,  # pyright: ignore[reportArgumentType]
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ScoringResponse.model_json_schema(),
                temperature=0,
            ),
        )

        result = ScoringResponse.model_validate_json(response.text)  # pyright: ignore[reportArgumentType]
        logger.info(
            "Google scored: interest=%d, quality=%d",
            result.interest_score,
            result.quality_score,
        )
        return result

    async def suggest_groups(
        self,
        all_categories: list[str],
        existing_groups: dict[str, list[str]],
        config: ProviderTaskConfig,
    ) -> GroupingResponse:
        from google import genai
        from google.genai import types

        prompt = build_grouping_prompt(all_categories, existing_groups)

        client = genai.Client(api_key=config.api_key)
        response = await client.aio.models.generate_content(
            model=config.model,  # pyright: ignore[reportArgumentType]
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GroupingResponse.model_json_schema(),
                temperature=0,
            ),
        )

        result = GroupingResponse.model_validate_json(response.text)  # pyright: ignore[reportArgumentType]
        logger.info("Google suggested %d category groups", len(result.groups))
        return result

    async def close(self) -> None:
        """No persistent connection pool to close."""
