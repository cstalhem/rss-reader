import type { ProviderPlugin } from "../types";
import { GoogleLogo } from "./GoogleLogo";

export const googleProvider: ProviderPlugin = {
  id: "google",
  label: "Google",
  hint: "Requires API key",
  available: false,
  Logo: GoogleLogo,
  Panel: null,
};
