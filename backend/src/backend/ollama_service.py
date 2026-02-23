"""Ollama API wrapper for health checks, model management, and downloads."""

import asyncio
import logging
import time

import httpx

from backend.ollama_client import get_ollama_client

logger = logging.getLogger(__name__)

# Module-level state for download tracking.
# Safe in single-worker asyncio -- no threading concerns.
_download_state: dict = {
    "active": False,
    "model": None,
    "completed": 0,
    "total": 0,
    "status": None,
}
_cancel_requested: bool = False


async def check_health(host: str) -> dict:
    """Check Ollama server health via the version endpoint.

    Args:
        host: Ollama server URL (e.g., "http://localhost:11434")

    Returns:
        Dict with connected, version, and latency_ms fields.
    """
    try:
        start = time.monotonic()
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{host}/api/version", timeout=5.0)
            resp.raise_for_status()
            latency_ms = int((time.monotonic() - start) * 1000)
            data = resp.json()
            return {
                "connected": True,
                "version": data.get("version"),
                "latency_ms": latency_ms,
            }
    except (httpx.HTTPError, httpx.TimeoutException, ConnectionError, OSError):
        return {"connected": False, "version": None, "latency_ms": None}


async def list_models(host: str) -> list[dict]:
    """List locally available Ollama models with loaded status.

    Args:
        host: Ollama server URL

    Returns:
        List of model dicts with name, size, parameter_size,
        quantization_level, and is_loaded fields.
    """
    client = get_ollama_client(host)
    models_resp = await client.list()
    ps_resp = await client.ps()

    loaded_names = {m.model for m in ps_resp.models}

    results = []
    for m in models_resp.models:
        results.append(
            {
                "name": m.model,
                "size": m.size,
                "parameter_size": m.details.parameter_size if m.details else None,
                "quantization_level": m.details.quantization_level
                if m.details
                else None,
                "is_loaded": m.model in loaded_names,
            }
        )

    return results


async def pull_model_stream(host: str, model: str):
    """Stream model download progress from Ollama.

    Yields dicts with status, completed, total, and digest fields.
    Updates module-level _download_state as chunks arrive.
    Checks _cancel_requested each iteration.

    Args:
        host: Ollama server URL
        model: Model name to pull (e.g., "qwen3:8b")

    Yields:
        Progress dicts from Ollama pull stream.
    """
    global _cancel_requested
    _cancel_requested = False
    _download_state.update(
        {"active": True, "model": model, "completed": 0, "total": 0, "status": None}
    )

    try:
        client = get_ollama_client(host)
        async for chunk in await client.pull(model, stream=True):
            if _cancel_requested:
                _cancel_requested = False
                raise asyncio.CancelledError("Download cancelled by user")

            # Check for error in chunk
            if "error" in chunk:
                yield {"error": chunk["error"]}
                return

            status = chunk.get("status", "")
            completed = chunk.get("completed", 0)
            total = chunk.get("total", 0)
            digest = chunk.get("digest", "")

            _download_state.update(
                {
                    "completed": completed,
                    "total": total,
                    "status": status,
                }
            )

            yield {
                "status": status,
                "completed": completed,
                "total": total,
                "digest": digest,
            }
    finally:
        _download_state.update(
            {
                "active": False,
                "model": None,
                "completed": 0,
                "total": 0,
                "status": None,
            }
        )


def cancel_download() -> None:
    """Request cancellation of the active model download."""
    global _cancel_requested
    _cancel_requested = True


def get_download_status() -> dict:
    """Get current download state.

    Returns:
        Copy of the download state dict.
    """
    return _download_state.copy()


async def delete_model(host: str, model: str) -> dict:
    """Delete a model from Ollama.

    Args:
        host: Ollama server URL
        model: Model name to delete

    Returns:
        Dict with status "success".
    """
    client = get_ollama_client(host)
    await client.delete(model)
    return {"status": "success"}
