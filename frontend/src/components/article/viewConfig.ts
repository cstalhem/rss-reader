import { createListCollection } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { LuBan, LuCheckCheck, LuClock, LuInbox, LuTriangleAlert } from "react-icons/lu";
import type { FilterTab, SortOption } from "@/lib/types";

export interface ArticleFilterCounts {
  unreadCount: number;
  scoringCount: number;
  blockedCount: number;
  failedCount: number;
}

export const ARTICLE_FILTER_LABELS: Record<FilterTab, string> = {
  unread: "Unread",
  all: "All",
  scoring: "Scoring",
  blocked: "Blocked",
  failed: "Failed",
};

export const ARTICLE_SORT_LABELS: Record<SortOption, string> = {
  score_desc: "Highest score",
  score_asc: "Lowest score",
  date_desc: "Newest first",
  date_asc: "Oldest first",
};

export const ARTICLE_SORT_OPTIONS = createListCollection({
  items: [
    { label: ARTICLE_SORT_LABELS.score_desc, value: "score_desc" },
    { label: ARTICLE_SORT_LABELS.score_asc, value: "score_asc" },
    { label: ARTICLE_SORT_LABELS.date_desc, value: "date_desc" },
    { label: ARTICLE_SORT_LABELS.date_asc, value: "date_asc" },
  ],
});

export const ARTICLE_EMPTY_STATES: Record<
  FilterTab,
  { icon: IconType; message: string }
> = {
  unread: {
    icon: LuCheckCheck,
    message: "No unread articles. You're all caught up!",
  },
  all: {
    icon: LuInbox,
    message: "No articles yet",
  },
  scoring: {
    icon: LuClock,
    message: "No articles awaiting scoring.",
  },
  blocked: {
    icon: LuBan,
    message: "No blocked articles.",
  },
  failed: {
    icon: LuTriangleAlert,
    message: "No failed articles.",
  },
};

function formatLabelWithCount(label: string, count: number) {
  return count > 0 ? `${label} (${count})` : label;
}

export function createArticleFilterCollection({
  unreadCount,
  scoringCount,
  blockedCount,
  failedCount,
}: ArticleFilterCounts) {
  return createListCollection({
    items: [
      {
        label: formatLabelWithCount(ARTICLE_FILTER_LABELS.unread, unreadCount),
        value: "unread" as const,
      },
      {
        label: ARTICLE_FILTER_LABELS.all,
        value: "all" as const,
      },
      {
        label: formatLabelWithCount(ARTICLE_FILTER_LABELS.scoring, scoringCount),
        value: "scoring" as const,
        disabled: scoringCount === 0,
      },
      {
        label: formatLabelWithCount(ARTICLE_FILTER_LABELS.blocked, blockedCount),
        value: "blocked" as const,
        disabled: blockedCount === 0,
      },
      {
        label: formatLabelWithCount(ARTICLE_FILTER_LABELS.failed, failedCount),
        value: "failed" as const,
        disabled: failedCount === 0,
      },
    ],
  });
}

export function getArticleFilterActionLabel(
  filter: FilterTab,
  counts: ArticleFilterCounts,
) {
  if (filter === "scoring") {
    return formatLabelWithCount(ARTICLE_FILTER_LABELS.scoring, counts.scoringCount);
  }

  if (filter === "blocked") {
    return formatLabelWithCount(ARTICLE_FILTER_LABELS.blocked, counts.blockedCount);
  }

  if (filter === "failed") {
    return formatLabelWithCount(ARTICLE_FILTER_LABELS.failed, counts.failedCount);
  }

  return ARTICLE_FILTER_LABELS[filter];
}

export function getArticleScoringPhaseLabel(phase?: string) {
  switch (phase) {
    case "thinking":
      return "Thinking\u2026";
    case "categorizing":
      return "Categorizing\u2026";
    case "scoring":
      return "Scoring\u2026";
    case "starting":
      return "Starting\u2026";
    default:
      return "Stalled";
  }
}

export function getArticleScoringPhaseColorPalette(phase?: string) {
  if (phase === "thinking") return "blue";
  if (phase === "categorizing" || phase === "scoring") return "accent";
  return "gray";
}
