import type { ElementType } from "react";
import { LuSettings, LuRss, LuHeart, LuTag, LuBot, LuMessageSquare } from "react-icons/lu";

/** Sidebar width when collapsed (icons only) */
export const SIDEBAR_WIDTH_COLLAPSED = "48px";
/** Sidebar width when expanded (full navigation) */
export const SIDEBAR_WIDTH_EXPANDED = "240px";
/** Polling interval for new category count badge (used in Header, SettingsSidebar, useCategories) */
export const NEW_COUNT_POLL_INTERVAL = 30_000;
/** Score threshold for accent-colored score badge */
export const HIGH_SCORE_THRESHOLD = 15;
/** Default page size for article list pagination */
export const ARTICLE_LIST_PAGE_SIZE = 50;

export type SettingsSection = "general" | "feeds" | "interests" | "categories" | "ollama" | "feedback";

export interface SettingsSectionItem {
  id: SettingsSection;
  href: string;
  icon: ElementType;
  label: string;
}

export const SETTINGS_SECTIONS: SettingsSectionItem[] = [
  { id: "general", href: "/settings/general", icon: LuSettings, label: "General" },
  { id: "feeds", href: "/settings/feeds", icon: LuRss, label: "Feeds" },
  { id: "interests", href: "/settings/interests", icon: LuHeart, label: "Interests" },
  { id: "categories", href: "/settings/categories", icon: LuTag, label: "Categories" },
  { id: "ollama", href: "/settings/ollama", icon: LuBot, label: "Ollama" },
  { id: "feedback", href: "/settings/feedback", icon: LuMessageSquare, label: "Feedback" },
];
