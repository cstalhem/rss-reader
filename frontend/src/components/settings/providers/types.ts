import type { ComponentType, SVGProps } from "react";

export interface ProviderPanelProps {
  onDisconnect: () => void;
  isNew?: boolean;
  onCancelSetup?: () => void;
}

export interface ProviderPlugin {
  id: string;
  label: string;
  hint: string;
  available: boolean;
  Logo: ComponentType<SVGProps<SVGSVGElement>>;
  Panel: ComponentType<ProviderPanelProps> | null;
}
