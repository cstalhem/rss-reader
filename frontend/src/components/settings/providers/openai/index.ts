import type { ProviderPlugin } from "../types";
import { OpenAILogo } from "./OpenAILogo";

export const openaiProvider: ProviderPlugin = {
  id: "openai",
  label: "OpenAI",
  hint: "Requires API key",
  available: false,
  Logo: OpenAILogo,
  Panel: null,
};
