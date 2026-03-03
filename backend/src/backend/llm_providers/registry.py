"""Static provider registry for this release."""

from backend.llm_providers.base import LLMProvider
from backend.llm_providers.ollama import OllamaProvider

PROVIDERS: dict[str, LLMProvider] = {
    "ollama": OllamaProvider(),
}


def get_provider(name: str) -> LLMProvider:
    """Resolve a provider by name."""
    provider = PROVIDERS.get(name)
    if provider is None:
        raise KeyError(f"Unknown provider: {name}")
    return provider
