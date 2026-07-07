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
