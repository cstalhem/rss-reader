import type { ProviderPlugin } from "../types";
import { OllamaLogo } from "./OllamaLogo";

export const ollamaProvider: ProviderPlugin = {
  id: "ollama",
  label: "Ollama",
  hint: "Local -- no API key",
  available: true,
  Logo: OllamaLogo,
  Panel: null, // Created in Plan 02
};
