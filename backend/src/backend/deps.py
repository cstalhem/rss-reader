"""Shared FastAPI dependencies and helper functions."""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlmodel import Session, func, select

from backend.database import engine
from backend.llm_providers.registry import get_provider
from backend.models import LLMProviderConfig, LLMTaskRoute, UserPreferences

logger = logging.getLogger(__name__)

TASK_CATEGORIZATION = "categorization"
TASK_SCORING = "scoring"

TaskName = Literal["categorization", "scoring"]
ReadinessReason = Literal[
    "no_provider",
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


def get_provider_config_row(
    session: Session, provider: str
) -> LLMProviderConfig | None:
    """Load provider config row by provider name."""
    return session.exec(
        select(LLMProviderConfig).where(LLMProviderConfig.provider == provider)
    ).first()


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


def resolve_task_runtime(session: Session, task: TaskName) -> TaskRuntimeResolution:
    """Resolve provider/model/endpoint for a task without network calls."""
    route = get_task_route(session, task)

    if route is None:
        provider_count = session.exec(select(func.count(LLMProviderConfig.id))).one()  # pyright: ignore[reportArgumentType]
        if provider_count == 0:
            return TaskRuntimeResolution(
                task=task,
                provider="",
                model=None,
                endpoint=None,
                thinking=False,
                ready=False,
                reason="no_provider",
            )
        return TaskRuntimeResolution(
            task=task,
            provider="",
            model=None,
            endpoint=None,
            thinking=False,
            ready=False,
            reason="model_unconfigured",
        )

    provider_name = route.provider
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

    try:
        provider = get_provider(provider_name)
    except KeyError:
        return TaskRuntimeResolution(
            task=task,
            provider=provider_name,
            model=route.model,
            endpoint=None,
            thinking=False,
            ready=False,
            reason="provider_unknown",
        )

    parsed = provider.parse_config(provider_row.config_json, task)
    model = route.model or parsed.model
    if model is None:
        return TaskRuntimeResolution(
            task=task,
            provider=provider_name,
            model=None,
            endpoint=parsed.endpoint,
            thinking=parsed.thinking,
            ready=False,
            reason="model_unconfigured",
        )

    return TaskRuntimeResolution(
        task=task,
        provider=provider_name,
        model=model,
        endpoint=parsed.endpoint,
        thinking=parsed.thinking,
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

    if runtime.reason == "no_provider":
        return "No LLM provider configured \u2014 set one up in LLM Providers"
    if runtime.reason == "provider_unconfigured":
        return "Scoring paused \u2014 provider is not configured"
    if runtime.reason == "provider_disabled":
        return "Scoring paused — provider is disabled"
    if runtime.reason == "provider_unknown":
        return "Scoring paused — configured provider is unsupported"
    if runtime.reason == "provider_unreachable":
        return "Scoring paused — provider is unreachable"
    if runtime.reason == "model_unconfigured":
        return "No model selected — configure one in LLM Providers"
    if runtime.reason == "model_missing":
        return "Scoring paused — configured model no longer available"

    return "Scoring paused — provider readiness check failed"
