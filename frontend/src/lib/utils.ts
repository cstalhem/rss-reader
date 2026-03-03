import { SortOption, TimeUnit } from "./types";

export function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export function parseSortOption(option: SortOption): { sort_by: string; order: string } {
  switch (option) {
    case "score_desc": return { sort_by: "composite_score", order: "desc" };
    case "score_asc": return { sort_by: "composite_score", order: "asc" };
    case "date_desc": return { sort_by: "published_at", order: "desc" };
    case "date_asc": return { sort_by: "published_at", order: "asc" };
  }
}

export function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return "Unknown date";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/** Decompose total seconds into the most natural unit. */
export function decomposeInterval(totalSeconds: number): { value: number; unit: TimeUnit } {
  if (totalSeconds % 3600 === 0) return { value: totalSeconds / 3600, unit: "hours" };
  if (totalSeconds % 60 === 0) return { value: totalSeconds / 60, unit: "minutes" };
  return { value: totalSeconds, unit: "seconds" };
}

/** Convert value + unit back to total seconds. */
export function toSeconds(value: number, unit: TimeUnit): number {
  if (unit === "hours") return value * 3600;
  if (unit === "minutes") return value * 60;
  return value;
}

/** Format seconds as a human-readable string. */
export function formatInterval(totalSeconds: number): string {
  const { value, unit } = decomposeInterval(totalSeconds);
  const label = value === 1 ? unit.slice(0, -1) : unit;
  return `${value} ${label}`;
}

/** Format remaining seconds as "Xm Ys" countdown string. */
export function formatCountdown(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "Refreshing now...";
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Normalize a category name into the canonical slug-style matching backend slugify usage. */
export function normalizeCategoryName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
