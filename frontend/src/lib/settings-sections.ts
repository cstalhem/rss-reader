import type { LucideIcon } from "lucide-react";
import { MessageSquare, Rss, Settings, Sparkles, Tags } from "lucide-react";

/**
 * Settings section registry (issue #98). Adding a section later is one entry
 * here plus one route folder under `app/settings/<id>/page.tsx` — the shell
 * (`components/settings-shell.tsx`) renders nav entries from this list alone.
 */
export interface SettingsSection {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "general",
    label: "General",
    href: "/settings/general",
    icon: Settings,
  },
  {
    id: "feed-management",
    label: "Feed management",
    href: "/settings/feed-management",
    icon: Rss,
  },
  {
    id: "interests",
    label: "Interests",
    href: "/settings/interests",
    icon: Sparkles,
  },
  {
    id: "categories",
    label: "Categories",
    href: "/settings/categories",
    icon: Tags,
  },
  {
    id: "feedback",
    label: "Feedback",
    href: "/settings/feedback",
    icon: MessageSquare,
  },
];

/**
 * Default landing section for desktop `/settings` (see `SettingsIndex`).
 * Pinned to Categories rather than `SETTINGS_SECTIONS[0]` (General) because
 * Categories is the only implemented page today — landing on a "Coming soon"
 * placeholder would be poor UX. Once the other sections are built out, this
 * should become `SETTINGS_SECTIONS[0]` so General (the natural first section)
 * is the default again.
 */
export const DEFAULT_SETTINGS_SECTION = SETTINGS_SECTIONS.find(
  (s) => s.id === "categories",
)!;
