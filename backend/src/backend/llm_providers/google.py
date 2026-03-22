"""Google Gemini provider implementation."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import TYPE_CHECKING, TypeVar

from pydantic import BaseModel, Field

from backend.prompts import (
    ArticleCategoryResult,
    ArticleScoringResult,
    BatchCategoryResponse,
    BatchScoringResponse,
    build_batch_categorization_prompt,
    build_batch_scoring_prompt,
)
from backend.prompts.grouping import GroupingResponse, build_grouping_prompt

if TYPE_CHECKING:
    from sqlmodel import Session

    from backend.llm_providers.base import ProviderTaskConfig

logger = logging.getLogger(__name__)

_T = TypeVar("_T", bound=BaseModel)

GOOGLE_PROVIDER = "google"


def extract_google_error_message(exc: Exception) -> str:
    """Extract human-readable message from Google SDK exceptions.

    Google SDK exceptions stringify as e.g.:
      "400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid...', ...}}"
    This extracts the inner 'message' field, falling back to the full string.
    """
    import ast
    import re

    raw = str(exc)
    match = re.search(r"\{.*\}\s*$", raw, re.DOTALL)
    if match:
        try:
            parsed = ast.literal_eval(match.group())
            msg = parsed.get("error", {}).get("message")
            if msg:
                return msg
        except (ValueError, SyntaxError):  # fmt: skip
            pass
    return raw


# --- Config model ---


class GoogleProviderConfig(BaseModel):
    """Validated Google provider configuration stored in config_json."""

    api_key_encrypted: str = ""
    selected_models: list[str] = []
    batch_size: int = Field(default=5, ge=1, le=10)


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
    batch_size = body.get("batch_size")

    row = get_provider_config_row(session, GOOGLE_PROVIDER)

    # If no new key provided, preserve existing encrypted key
    encrypted_key = ""
    if api_key:
        get_or_create_key(keyfile)
        encrypted_key = encrypt_value(api_key, keyfile)
    elif row:
        try:
            existing = GoogleProviderConfig.model_validate_json(row.config_json)
            encrypted_key = existing.api_key_encrypted
            # Preserve existing fields when only updating a subset
            if not selected_models:
                selected_models = existing.selected_models
            if batch_size is None:
                batch_size = existing.batch_size
        except Exception:
            pass

    config = GoogleProviderConfig(
        api_key_encrypted=encrypted_key,
        selected_models=selected_models,
        batch_size=batch_size if batch_size is not None else 5,
    )

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
            selected_models=config.selected_models or None,
        )

    async def health(self, config: ProviderTaskConfig) -> dict:
        """Validate API key by listing a single model.

        Returns {"connected": True} on success, or
        {"connected": False, "error": "..."} on failure.
        """
        if not config.api_key:
            return {"connected": False, "error": "No API key configured"}
        try:
            from google import genai

            client = genai.Client(api_key=config.api_key)
            async for _ in await client.aio.models.list(config={"page_size": 1}):
                break
            return {"connected": True}
        except Exception as e:
            logger.warning("Google health check failed: %s", e)
            return {"connected": False, "error": extract_google_error_message(e)}

    async def list_models(self, config: ProviderTaskConfig) -> list[dict]:
        """List available Gemini models, with 120s cache.

        When config.selected_models is set, returns only those models
        (used by the aggregated /models endpoint for task route dropdowns).
        """
        global _model_cache, _model_cache_time

        if (
            _model_cache is not None
            and (time.time() - _model_cache_time) < _MODEL_CACHE_TTL
        ):
            all_models = _model_cache
        elif not config.api_key:
            return []
        else:
            try:
                from google import genai

                client = genai.Client(api_key=config.api_key)
                models = []
                async for model in await client.aio.models.list(
                    config={"page_size": 100}
                ):
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
                all_models = models
            except Exception as e:
                from google.genai.errors import ServerError

                if isinstance(e, ServerError):
                    logger.warning(
                        "Google API unavailable (%s %s), returning cached or empty model list",
                        e.code,
                        e.status,
                    )
                else:
                    logger.exception("Failed to list Google models")
                return []

        if config.selected_models is not None:
            selected = set(config.selected_models)
            return [m for m in all_models if m.get("name") in selected]
        return all_models

    async def _generate(
        self,
        config: ProviderTaskConfig,
        system_prompt: str,
        user_message: str,
        schema: type[_T],
    ) -> _T:
        """Call Gemini with structured JSON output and return a validated model."""
        from google import genai
        from google.genai import types

        from backend.llm_providers.base import LLMValidationError, validate_llm_response

        client = genai.Client(api_key=config.api_key)

        last_error: LLMValidationError | None = None
        for attempt in range(2):
            response = await client.aio.models.generate_content(
                model=config.model,  # pyright: ignore[reportArgumentType]
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=schema.model_json_schema(),
                    temperature=0,
                ),
            )

            if response.text is None:
                logger.debug(
                    "Google returned null text; candidates=%s",
                    response.candidates,
                )

            try:
                return validate_llm_response(response.text, schema)
            except LLMValidationError as e:
                last_error = e
                logger.warning(
                    "Google LLM validation failed (attempt %d/2): %s",
                    attempt + 1,
                    e,
                )
                if not e.is_retryable or attempt > 0:
                    break
                await asyncio.sleep(1)

        assert last_error is not None  # loop always runs at least once
        raise last_error

    async def categorize(
        self,
        articles: list[dict],
        existing_categories: list[str],
        config: ProviderTaskConfig,
        category_hierarchy: dict[str, list[str]] | None,
        hidden_categories: list[str] | None,
    ) -> list[ArticleCategoryResult]:
        system_prompt, user_message = build_batch_categorization_prompt(
            articles,
            existing_categories,
            category_hierarchy,
            hidden_categories=hidden_categories,
        )
        result = await self._generate(
            config, system_prompt, user_message, BatchCategoryResponse
        )
        logger.info("Google categorized %d articles", len(result.results))
        return result.results

    async def score(
        self,
        articles: list[dict],
        interests: str,
        anti_interests: str,
        config: ProviderTaskConfig,
    ) -> list[ArticleScoringResult]:
        system_prompt, user_message = build_batch_scoring_prompt(
            articles, interests, anti_interests
        )
        result = await self._generate(
            config, system_prompt, user_message, BatchScoringResponse
        )
        logger.info("Google scored %d articles", len(result.results))
        return result.results

    async def suggest_groups(
        self,
        all_categories: list[str],
        existing_groups: dict[str, list[str]],
        config: ProviderTaskConfig,
    ) -> GroupingResponse:
        prompt = build_grouping_prompt(all_categories, existing_groups)
        # Grouping uses a single prompt — pass it as user message with empty system prompt
        result = await self._generate(config, "", prompt, GroupingResponse)
        logger.info("Google suggested %d category groups", len(result.groups))
        return result

    async def close(self) -> None:
        """No persistent connection pool to close."""
