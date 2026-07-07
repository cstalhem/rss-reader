import type { FeedSelection, ReadFilter } from "./types";

/**
 * Serialize a `FeedSelection` into a stable, plain-value key segment so the
 * same scope always produces the same query key regardless of object identity.
 */
function selectionKey(selection: FeedSelection): string {
  switch (selection.type) {
    case "all":
      return "all";
    case "feed":
      return `feed:${selection.id}`;
    case "folder":
      return `folder:${selection.id}`;
    case "blocked":
      return "blocked";
  }
}

/**
 * Centralized query key factory. Every query key lives here — no inline
 * literals elsewhere. `as const` gives exact tuple types and enables prefix
 * invalidation (`invalidateQueries({ queryKey: queryKeys.feeds.all })` matches
 * `["feeds"]` and any key prefixed by it).
 */
export const queryKeys = {
  feeds: {
    all: ["feeds"] as const,
  },
  feedFolders: {
    all: ["feed-folders"] as const,
  },
  articles: {
    all: ["articles"] as const,
    list: (selection: FeedSelection, filter: ReadFilter) =>
      ["articles", "list", selectionKey(selection), filter] as const,
    detail: (id: number) => ["articles", "detail", id] as const,
    counts: ["articles", "counts"] as const,
    blocked: ["articles", "blocked"] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: (needsTriage?: boolean) =>
      ["categories", "list", needsTriage ?? "any"] as const,
    triageCount: ["categories", "triage-count"] as const,
  },
  preferences: {
    detail: ["preferences"] as const,
  },
  scoring: {
    status: ["scoring", "status"] as const,
  },
};
