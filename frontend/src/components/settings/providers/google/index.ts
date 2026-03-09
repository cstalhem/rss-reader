import type { ProviderPlugin } from "../types";
import { GoogleLogo } from "./GoogleLogo";
import { GoogleProviderPanel } from "./GoogleProviderPanel";

export const googleProvider: ProviderPlugin = {
  id: "google",
  label: "Google",
  hint: "Requires API key",
  available: true,
  Logo: GoogleLogo,
  Panel: GoogleProviderPanel,
};
