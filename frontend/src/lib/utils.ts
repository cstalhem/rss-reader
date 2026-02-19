import { SortOption } from "./types";

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
