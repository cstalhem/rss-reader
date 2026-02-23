"""Shared Ollama AsyncClient singleton to prevent file descriptor leaks."""

import logging

import httpx
from ollama import AsyncClient

logger = logging.getLogger(__name__)

OLLAMA_CONNECT_TIMEOUT = 10.0
OLLAMA_READ_TIMEOUT = 120.0  # Longest timeout (scoring streaming)

_client: AsyncClient | None = None
_client_host: str | None = None


def get_ollama_client(host: str) -> AsyncClient:
    """Return a shared AsyncClient, creating one lazily on first call."""
    global _client, _client_host
    if _client is None or _client_host != host:
        timeout = httpx.Timeout(
            connect=OLLAMA_CONNECT_TIMEOUT,
            read=OLLAMA_READ_TIMEOUT,
            write=30.0,
            pool=10.0,
        )
        _client = AsyncClient(host=host, timeout=timeout)
        _client_host = host
    return _client


async def close_ollama_client() -> None:
    """Close the shared client's underlying httpx connection pool."""
    global _client, _client_host
    if _client is not None:
        try:
            await _client._client.aclose()  # noqa: SLF001
        except Exception:
            logger.debug("Error closing Ollama client", exc_info=True)
        _client = None
        _client_host = None
