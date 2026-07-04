"""Single Azure OpenAI client wrapper — the only path to an LLM (ADR-0002).

Owns all rate-limit state, keyed by deployment (ADR-0004): Azure quotas
attach to deployments, so a 429 hit by one task throttles every task
routed to the same deployment. Queue workers never see rate-limit
semantics — only the typed exceptions below.
"""

import email.utils
import logging
import time

from openai import (
    APIConnectionError,
    APIStatusError,
    AsyncAzureOpenAI,
    RateLimitError,
)
from pydantic import BaseModel

from backend.config import LLMTaskConfig, Settings, get_settings

logger = logging.getLogger(__name__)

DEFAULT_RETRY_AFTER = 60.0  # seconds, when Azure sends no Retry-After header


class LLMError(Exception):
    """Base class for wrapper errors."""


class LLMNotConfigured(LLMError):
    """Azure credentials missing or task absent from llm.tasks config."""


class LLMUnavailable(LLMError):
    """The deployment is throttled or unreachable; retry after `retry_in` seconds.

    Callers should leave work queued without counting a failure attempt.
    """

    def __init__(self, retry_in: float):
        self.retry_in = retry_in
        super().__init__(f"LLM unavailable, retry in {retry_in:.0f}s")


class LLMCallFailed(LLMError):
    """The call was made and failed deterministically (4xx, refusal)."""


def _retry_after_seconds(exc: RateLimitError) -> float:
    """Extract Retry-After from a 429 response; fall back to the default."""
    headers = exc.response.headers
    raw_ms = headers.get("retry-after-ms")
    if raw_ms:
        try:
            return max(0.0, float(raw_ms) / 1000.0)
        except ValueError:
            pass
    raw = headers.get("retry-after")
    if raw:
        try:
            return max(0.0, float(raw))
        except ValueError:
            # HTTP-date form
            parsed = email.utils.parsedate_to_datetime(raw)
            if parsed is not None:
                return max(0.0, parsed.timestamp() - time.time())
    return DEFAULT_RETRY_AFTER


class AzureLLMClient:
    """Azure OpenAI client with per-task deployment routing and structured outputs."""

    def __init__(self, settings: Settings | None = None):
        self._settings = settings
        self._client: AsyncAzureOpenAI | None = None
        # deployment name -> time.time() timestamp until which it is paused
        self._pause_until: dict[str, float] = {}

    @property
    def settings(self) -> Settings:
        return self._settings if self._settings is not None else get_settings()

    def is_configured(self) -> bool:
        s = self.settings
        return bool(s.azure_openai_endpoint and s.azure_openai_api_key)

    def task_config(self, task: str) -> LLMTaskConfig:
        cfg = self.settings.llm.tasks.get(task)
        if cfg is None:
            raise LLMNotConfigured(f"No llm.tasks entry for task '{task}'")
        return cfg

    def batch_size(self, task: str) -> int:
        return self.task_config(task).batch_size

    def pause_remaining(self, deployment: str) -> float:
        """Seconds until the deployment's pause expires, or 0."""
        return max(0.0, self._pause_until.get(deployment, 0.0) - time.time())

    def pause_remaining_for_task(self, task: str) -> float:
        """Pause remaining for the deployment a task routes to (0 for unknown tasks)."""
        cfg = self.settings.llm.tasks.get(task)
        if cfg is None:
            return 0.0
        return self.pause_remaining(cfg.deployment)

    def _pause(self, deployment: str, retry_in: float) -> None:
        self._pause_until[deployment] = time.time() + retry_in

    def _get_client(self) -> AsyncAzureOpenAI:
        if self._client is None:
            s = self.settings
            self._client = AsyncAzureOpenAI(
                azure_endpoint=s.azure_openai_endpoint,  # pyright: ignore[reportArgumentType]
                api_key=s.azure_openai_api_key,
                api_version=s.llm.api_version,
            )
        return self._client

    async def complete[T: BaseModel](
        self,
        task: str,
        system_prompt: str,
        user_message: str,
        response_schema: type[T],
    ) -> T:
        """Run a structured-output completion for a task.

        Raises:
            LLMNotConfigured: credentials missing or task not routed.
            LLMUnavailable: deployment paused, throttled (429), transient
                server error (5xx), or unreachable. Retry later.
            LLMCallFailed: deterministic failure (4xx, refusal, empty parse).
        """
        if not self.is_configured():
            raise LLMNotConfigured(
                "AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY not set"
            )

        deployment = self.task_config(task).deployment

        remaining = self.pause_remaining(deployment)
        if remaining > 0:
            raise LLMUnavailable(remaining)

        client = self._get_client()
        try:
            completion = await client.chat.completions.parse(
                model=deployment,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format=response_schema,
            )
        except RateLimitError as e:
            retry_in = _retry_after_seconds(e)
            self._pause(deployment, retry_in)
            logger.warning(
                "Deployment '%s' rate-limited; paused for %.0fs", deployment, retry_in
            )
            raise LLMUnavailable(retry_in) from e
        except APIConnectionError as e:
            self._pause(deployment, DEFAULT_RETRY_AFTER)
            logger.warning("Azure unreachable for '%s': %s", deployment, e)
            raise LLMUnavailable(DEFAULT_RETRY_AFTER) from e
        except APIStatusError as e:
            if e.response.status_code >= 500:
                self._pause(deployment, DEFAULT_RETRY_AFTER)
                logger.warning(
                    "Azure server error %s for '%s'", e.response.status_code, deployment
                )
                raise LLMUnavailable(DEFAULT_RETRY_AFTER) from e
            raise LLMCallFailed(
                f"Azure call failed ({e.response.status_code}): {e}"
            ) from e

        message = completion.choices[0].message
        if message.parsed is None:
            raise LLMCallFailed(
                f"No structured output returned (refusal: {message.refusal})"
            )
        return message.parsed

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None


# App-wide singleton; tests construct their own instances with test settings.
llm_client = AzureLLMClient()
