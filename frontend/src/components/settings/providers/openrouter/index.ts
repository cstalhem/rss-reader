import type { ProviderPlugin } from "../types";
import { OpenRouterLogo } from "./OpenRouterLogo";

export const openrouterProvider: ProviderPlugin = {
  id: "openrouter",
  label: "OpenRouter",
  hint: "Requires API key",
  available: false,
  Logo: OpenRouterLogo,
  Panel: null,
};
