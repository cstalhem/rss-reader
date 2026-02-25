import type { ProviderPlugin } from "../types";
import { OllamaLogo } from "./OllamaLogo";
import { OllamaProviderPanel } from "./OllamaProviderPanel";

export const ollamaProvider: ProviderPlugin = {
  id: "ollama",
  label: "Ollama",
  hint: "Local -- no API key",
  available: true,
  Logo: OllamaLogo,
  Panel: OllamaProviderPanel,
};
