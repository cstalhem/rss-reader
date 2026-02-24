"""Shared FastAPI dependencies and helper functions."""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlmodel import Session, select

from backend.config import get_settings
from backend.database import engine
from backend.llm_providers.ollama import OllamaProviderConfig, split_ollama_host
from backend.llm_providers.registry import get_provider
from backend.models import LLMProviderConfig, LLMTaskRoute, UserPreferences

logger = logging.getLogger(__name__)

OLLAMA_PROVIDER = "ollama"
TASK_CATEGORIZATION = "categorization"
TASK_SCORING = "scoring"

TaskName = Literal["categorization", "scoring"]
ReadinessReason = Literal[
    "provider_unconfigured",
    "provider_disabled",
    "provider_unknown",
    "provider_unreachable",
    "model_unconfigured",
    "model_missing",
]


@dataclass(frozen=True)
class TaskRuntimeResolution:
    """Resolved provider/runtime details for a single task."""

    task: TaskName
    provider: str
    model: str | None
    endpoint: str | None
    thinking: bool
    ready: bool
    reason: ReadinessReason | None


def get_session():
    """FastAPI dependency for database sessions."""
    with Session(engine) as session:
        yield session


def get_or_create_preferences(session: Session) -> UserPreferences:
    """Get existing preferences or create defaults. Used by multiple routers."""
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
    return preferences


def resolve_ollama_models(
    preferences: UserPreferences,
) -> tuple[str | None, str | None]:
    """Resolve categorization and scoring model names from preferences."""
    categorization_model = preferences.ollama_categorization_model
    if preferences.ollama_use_separate_models:
        scoring_model = preferences.ollama_scoring_model
    else:
        scoring_model = categorization_model
    return categorization_model, scoring_model


def _build_legacy_ollama_config(session: Session) -> OllamaProviderConfig:
    """Build an Ollama config from legacy preferences + static settings."""
    settings = get_settings()
    preferences = session.exec(select(UserPreferences)).first()
    base_url, port = split_ollama_host(settings.ollama.host)

    if not preferences:
        return OllamaProviderConfig(
            base_url=base_url,
            port=port,
            categorization_model=None,
            scoring_model=None,
            use_separate_models=False,
            thinking=False,
        )

    return OllamaProviderConfig(
        base_url=base_url,
        port=port,
        categorization_model=preferences.ollama_categorization_model,
        scoring_model=preferences.ollama_scoring_model,
        use_separate_models=preferences.ollama_use_separate_models,
        thinking=preferences.ollama_thinking,
    )


def get_provider_config_row(
    session: Session, provider: str
) -> LLMProviderConfig | None:
    """Load provider config row by provider name."""
    return session.exec(
        select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
    ).first()


def get_ollama_provider_config(session: Session) -> OllamaProviderConfig:
    """Get validated Ollama config with legacy fallback."""
    row = get_provider_config_row(session, OLLAMA_PROVIDER)
    if row:
        try:
            return OllamaProviderConfig.model_validate_json(row.config_json)
        except Exception:
            logger.exception("Invalid Ollama provider config JSON")

    return _build_legacy_ollama_config(session)


def upsert_ollama_provider_config(
    session: Session,
    config: OllamaProviderConfig,
) -> LLMProviderConfig:
    """Create or update Ollama provider config row."""
    row = get_provider_config_row(session, OLLAMA_PROVIDER)
    if not row:
        row = LLMProviderConfig(
            provider=OLLAMA_PROVIDER, enabled=True, config_json="{}"
        )

    row.config_json = config.model_dump_json()
    row.updated_at = datetime.now()
    session.add(row)
    return row


def get_task_route(session: Session, task: TaskName) -> LLMTaskRoute | None:
    """Load routing row for a specific LLM task."""
    return session.exec(select(LLMTaskRoute).where(LLMTaskRoute.task == task)).first()


def upsert_task_route(
    session: Session,
    task: TaskName,
    provider: str,
    model: str | None,
) -> LLMTaskRoute:
    """Create or update a task route row."""
    route = get_task_route(session, task)
    if not route:
        route = LLMTaskRoute(task=task, provider=provider, model=model)

    route.provider = provider
    route.model = model
    route.updated_at = datetime.now()
    session.add(route)
    return route


def sync_ollama_task_routes(
    session: Session,
    config: OllamaProviderConfig,
) -> None:
    """Keep Ollama task-route defaults aligned with saved config."""
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


def resolve_task_runtime(session: Session, task: TaskName) -> TaskRuntimeResolution:
    """Resolve provider/model/endpoint for a task without network calls."""
    route = get_task_route(session, task)

    # Compatibility fallback while legacy prefs columns still exist.
    if route is None:
        legacy_config = get_ollama_provider_config(session)
        fallback_model = legacy_config.default_model_for_task(task)
        return TaskRuntimeResolution(
            task=task,
            provider=OLLAMA_PROVIDER,
            model=fallback_model,
            endpoint=legacy_config.endpoint,
            thinking=legacy_config.thinking,
            ready=fallback_model is not None,
            reason=None if fallback_model else "model_unconfigured",
        )

    provider_name = route.provider
    if provider_name != OLLAMA_PROVIDER:
        provider_row = get_provider_config_row(session, provider_name)
        if provider_row is None:
            return TaskRuntimeResolution(
                task=task,
                provider=provider_name,
                model=route.model,
                endpoint=None,
                thinking=False,
                ready=False,
                reason="provider_unconfigured",
            )
        if not provider_row.enabled:
            return TaskRuntimeResolution(
                task=task,
                provider=provider_name,
                model=route.model,
                endpoint=None,
                thinking=False,
                ready=False,
                reason="provider_disabled",
            )
        return TaskRuntimeResolution(
            task=task,
            provider=provider_name,
            model=route.model,
            endpoint=None,
            thinking=False,
            ready=False,
            reason="provider_unknown",
        )

    provider_row = get_provider_config_row(session, OLLAMA_PROVIDER)
    if provider_row and not provider_row.enabled:
        return TaskRuntimeResolution(
            task=task,
            provider=OLLAMA_PROVIDER,
            model=route.model,
            endpoint=None,
            thinking=False,
            ready=False,
            reason="provider_disabled",
        )

    ollama_config = get_ollama_provider_config(session)
    model = route.model or ollama_config.default_model_for_task(task)

    if model is None:
        return TaskRuntimeResolution(
            task=task,
            provider=OLLAMA_PROVIDER,
            model=None,
            endpoint=ollama_config.endpoint,
            thinking=ollama_config.thinking,
            ready=False,
            reason="model_unconfigured",
        )

    return TaskRuntimeResolution(
        task=task,
        provider=OLLAMA_PROVIDER,
        model=model,
        endpoint=ollama_config.endpoint,
        thinking=ollama_config.thinking,
        ready=True,
        reason=None,
    )


async def evaluate_task_readiness(
    session: Session,
    task: TaskName,
) -> TaskRuntimeResolution:
    """Resolve runtime and validate provider health/model availability."""
    runtime = resolve_task_runtime(session, task)
    if not runtime.ready:
        return runtime

    if runtime.endpoint is None or runtime.model is None:
        return TaskRuntimeResolution(
            task=runtime.task,
            provider=runtime.provider,
            model=runtime.model,
            endpoint=runtime.endpoint,
            thinking=runtime.thinking,
            ready=False,
            reason="provider_unconfigured",
        )

    try:
        provider = get_provider(runtime.provider)
    except KeyError:
        return TaskRuntimeResolution(
            task=runtime.task,
            provider=runtime.provider,
            model=runtime.model,
            endpoint=runtime.endpoint,
            thinking=runtime.thinking,
            ready=False,
            reason="provider_unknown",
        )

    try:
        health = await provider.health(runtime.endpoint)
    except Exception:
        logger.exception("Provider health check failed: task=%s", task)
        health = {"connected": False}

    if not health.get("connected"):
        return TaskRuntimeResolution(
            task=runtime.task,
            provider=runtime.provider,
            model=runtime.model,
            endpoint=runtime.endpoint,
            thinking=runtime.thinking,
            ready=False,
            reason="provider_unreachable",
        )

    try:
        models = await provider.list_models(runtime.endpoint)
        installed_names = {m.get("name") for m in models if m.get("name")}
    except Exception:
        logger.exception("Provider model listing failed: task=%s", task)
        installed_names = set()

    if not installed_names or runtime.model not in installed_names:
        return TaskRuntimeResolution(
            task=runtime.task,
            provider=runtime.provider,
            model=runtime.model,
            endpoint=runtime.endpoint,
            thinking=runtime.thinking,
            ready=False,
            reason="model_missing",
        )

    return runtime


def format_readiness_reason(runtime: TaskRuntimeResolution) -> str | None:
    """Convert typed readiness reason into user-facing text."""
    if runtime.reason is None:
        return None

    if runtime.reason == "provider_unconfigured":
        return "Scoring paused — provider is not configured"
    if runtime.reason == "provider_disabled":
        return "Scoring paused — provider is disabled"
    if runtime.reason == "provider_unknown":
        return "Scoring paused — configured provider is unsupported"
    if runtime.reason == "provider_unreachable":
        if runtime.provider == OLLAMA_PROVIDER:
            return "Scoring paused — Ollama is not running"
        return "Scoring paused — provider is unreachable"
    if runtime.reason == "model_unconfigured":
        return "No model selected — configure one in LLM Providers"
    if runtime.reason == "model_missing":
        return "Scoring paused — configured model no longer available"

    return "Scoring paused — provider readiness check failed"
