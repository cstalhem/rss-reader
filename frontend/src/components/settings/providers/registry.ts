import { ollamaProvider } from "./ollama";
import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { googleProvider } from "./google";
import { openrouterProvider } from "./openrouter";
import type { ProviderPlugin } from "./types";

export const PROVIDER_REGISTRY: ProviderPlugin[] = [
  ollamaProvider,
  openaiProvider,
  anthropicProvider,
  googleProvider,
  openrouterProvider,
];
