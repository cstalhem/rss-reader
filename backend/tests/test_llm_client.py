"""Unit tests for the Azure LLM client wrapper.

The wrapper is the single seam to Azure: it owns deployment-keyed pause
state (ADR-0004) and translates SDK errors into typed exceptions the
queue can handle without knowing the transport.
"""

import httpx
import pytest
from openai import APIConnectionError, APIStatusError, RateLimitError
from pydantic import BaseModel

from backend.config import LLMConfig, LLMTaskConfig, Settings
from backend.llm_client import (
    DEFAULT_RETRY_AFTER,
    AzureLLMClient,
    LLMCallFailed,
    LLMNotConfigured,
    LLMUnavailable,
)


class FakeResult(BaseModel):
    answer: str


def _settings(
    endpoint: str | None = "https://example.openai.azure.com",
    api_key: str | None = "test-key",
    llm: LLMConfig | None = None,
) -> Settings:
    if llm is None:
        llm = LLMConfig(
            api_version="2024-10-21",
            tasks={
                "scoring": LLMTaskConfig(deployment="score-deploy", batch_size=5),
                "categorization": LLMTaskConfig(deployment="cat-deploy", batch_size=10),
            },
        )
    return Settings(
        azure_openai_endpoint=endpoint,
        azure_openai_api_key=api_key,
        llm=llm,
    )


class FakeParse:
    """Stand-in for client.chat.completions.parse."""

    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls: list[dict] = []

    async def __call__(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error

        class Message:
            parsed = self.result
            refusal = None

        class Choice:
            message = Message()

        class Completion:
            choices = [Choice()]

        return Completion()


def _client_with(fake_parse: FakeParse, settings: Settings) -> AzureLLMClient:
    client = AzureLLMClient(settings=settings)

    class Completions:
        parse = fake_parse

    class Chat:
        completions = Completions()

    class FakeSDK:
        chat = Chat()

        async def close(self):
            pass

    client._client = FakeSDK()  # bypass real SDK construction
    return client


def _rate_limit_error(retry_after: str | None) -> RateLimitError:
    headers = {"retry-after": retry_after} if retry_after else {}
    response = httpx.Response(
        429,
        headers=headers,
        request=httpx.Request("POST", "https://example.openai.azure.com"),
    )
    return RateLimitError("rate limited", response=response, body=None)


def _status_error(status: int) -> APIStatusError:
    response = httpx.Response(
        status,
        request=httpx.Request("POST", "https://example.openai.azure.com"),
    )
    return APIStatusError("server error", response=response, body=None)


@pytest.mark.asyncio
async def test_complete_routes_task_to_deployment():
    fake = FakeParse(result=FakeResult(answer="ok"))
    client = _client_with(fake, _settings())

    result = await client.complete("scoring", "sys", "user", FakeResult)

    assert result.answer == "ok"
    assert fake.calls[0]["model"] == "score-deploy"
    assert fake.calls[0]["response_format"] is FakeResult


@pytest.mark.asyncio
async def test_missing_credentials_raises_not_configured():
    fake = FakeParse(result=FakeResult(answer="ok"))
    client = _client_with(fake, _settings(endpoint=None, api_key=None))

    with pytest.raises(LLMNotConfigured):
        await client.complete("scoring", "sys", "user", FakeResult)
    assert fake.calls == []


@pytest.mark.asyncio
async def test_unknown_task_raises_not_configured():
    fake = FakeParse(result=FakeResult(answer="ok"))
    client = _client_with(fake, _settings())

    with pytest.raises(LLMNotConfigured):
        await client.complete("grouping", "sys", "user", FakeResult)


@pytest.mark.asyncio
async def test_rate_limit_pauses_deployment_and_honors_retry_after():
    fake = FakeParse(error=_rate_limit_error("17"))
    client = _client_with(fake, _settings())

    with pytest.raises(LLMUnavailable) as exc_info:
        await client.complete("scoring", "sys", "user", FakeResult)
    assert exc_info.value.retry_in == pytest.approx(17.0)

    # Second call short-circuits on pause state without touching the SDK
    with pytest.raises(LLMUnavailable):
        await client.complete("scoring", "sys", "user", FakeResult)
    assert len(fake.calls) == 1


@pytest.mark.asyncio
async def test_rate_limit_without_header_uses_default_backoff():
    fake = FakeParse(error=_rate_limit_error(None))
    client = _client_with(fake, _settings())

    with pytest.raises(LLMUnavailable) as exc_info:
        await client.complete("scoring", "sys", "user", FakeResult)
    assert exc_info.value.retry_in == pytest.approx(DEFAULT_RETRY_AFTER)


@pytest.mark.asyncio
async def test_pause_is_keyed_by_deployment_not_task():
    """Tasks sharing a deployment share the pause; other deployments are free."""
    fake = FakeParse(error=_rate_limit_error("30"))
    settings = _settings(
        llm=LLMConfig(
            tasks={
                "scoring": LLMTaskConfig(deployment="shared-deploy"),
                "categorization": LLMTaskConfig(deployment="shared-deploy"),
                "grouping": LLMTaskConfig(deployment="other-deploy"),
            }
        )
    )
    client = _client_with(fake, settings)

    with pytest.raises(LLMUnavailable):
        await client.complete("scoring", "sys", "user", FakeResult)

    # categorization shares the throttled deployment → paused without an SDK call
    with pytest.raises(LLMUnavailable):
        await client.complete("categorization", "sys", "user", FakeResult)
    assert len(fake.calls) == 1

    # grouping routes to a different deployment → SDK call goes through
    fake.error = None
    fake.result = FakeResult(answer="ok")
    result = await client.complete("grouping", "sys", "user", FakeResult)
    assert result.answer == "ok"


@pytest.mark.asyncio
async def test_pause_expires(monkeypatch):
    fake = FakeParse(error=_rate_limit_error("10"))
    client = _client_with(fake, _settings())

    with pytest.raises(LLMUnavailable):
        await client.complete("scoring", "sys", "user", FakeResult)

    # Fast-forward past the pause window
    import backend.llm_client as llm_client_module

    real_time = llm_client_module.time.time()
    monkeypatch.setattr(llm_client_module.time, "time", lambda: real_time + 11.0)

    fake.error = None
    fake.result = FakeResult(answer="ok")
    result = await client.complete("scoring", "sys", "user", FakeResult)
    assert result.answer == "ok"


@pytest.mark.asyncio
async def test_server_errors_pause_with_default_backoff():
    fake = FakeParse(error=_status_error(503))
    client = _client_with(fake, _settings())

    with pytest.raises(LLMUnavailable) as exc_info:
        await client.complete("scoring", "sys", "user", FakeResult)
    assert exc_info.value.retry_in == pytest.approx(DEFAULT_RETRY_AFTER)


@pytest.mark.asyncio
async def test_connection_errors_are_unavailable():
    fake = FakeParse(
        error=APIConnectionError(
            request=httpx.Request("POST", "https://example.openai.azure.com")
        )
    )
    client = _client_with(fake, _settings())

    with pytest.raises(LLMUnavailable):
        await client.complete("scoring", "sys", "user", FakeResult)


@pytest.mark.asyncio
async def test_client_errors_fail_hard():
    fake = FakeParse(error=_status_error(400))
    client = _client_with(fake, _settings())

    with pytest.raises(LLMCallFailed):
        await client.complete("scoring", "sys", "user", FakeResult)
    # 4xx does not pause the deployment
    assert client.pause_remaining("score-deploy") == 0.0


@pytest.mark.asyncio
async def test_refusal_fails_hard():
    fake = FakeParse(result=None)  # parsed is None (refusal / empty)
    client = _client_with(fake, _settings())

    with pytest.raises(LLMCallFailed):
        await client.complete("scoring", "sys", "user", FakeResult)


@pytest.mark.asyncio
async def test_truncated_output_fails_typed():
    """LengthFinishReasonError (truncated structured output) must not escape untyped."""
    from openai import LengthFinishReasonError
    from openai.types.chat import ChatCompletion

    completion = ChatCompletion(
        id="x",
        choices=[],
        created=0,
        model="gpt-4o-mini",
        object="chat.completion",
    )
    fake = FakeParse(error=LengthFinishReasonError(completion=completion))
    client = _client_with(fake, _settings())

    with pytest.raises(LLMCallFailed):
        await client.complete("scoring", "sys", "user", FakeResult)
    assert client.pause_remaining("score-deploy") == 0.0


@pytest.mark.asyncio
async def test_other_openai_errors_fail_typed():
    """Any remaining OpenAIError translates to LLMCallFailed, never escapes raw."""
    from openai import OpenAIError

    fake = FakeParse(error=OpenAIError("unexpected SDK failure"))
    client = _client_with(fake, _settings())

    with pytest.raises(LLMCallFailed):
        await client.complete("scoring", "sys", "user", FakeResult)


def test_batch_size_comes_from_config():
    client = AzureLLMClient(settings=_settings())
    assert client.batch_size("scoring") == 5
    assert client.batch_size("categorization") == 10


def test_pause_remaining_for_task_reports_deployment_pause():
    client = AzureLLMClient(settings=_settings())
    assert client.pause_remaining_for_task("scoring") == 0.0

    import time

    client._pause_until["score-deploy"] = time.time() + 42.0
    assert client.pause_remaining_for_task("scoring") > 40.0
    # unknown task → no pause rather than an exception (status endpoint safety)
    assert client.pause_remaining_for_task("nope") == 0.0
