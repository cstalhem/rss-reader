import type { ProviderPlugin } from "../types";
import { AnthropicLogo } from "./AnthropicLogo";

export const anthropicProvider: ProviderPlugin = {
  id: "anthropic",
  label: "Anthropic",
  hint: "Requires API key",
  available: false,
  Logo: AnthropicLogo,
  Panel: null,
};
