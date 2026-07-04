import type { QueryClient } from "@tanstack/react-query";

export const queryKeys = {
  articles: {
    all: ["articles"] as const,
    list: (filters: Record<string, unknown>) => ["articles", filters] as const,
    detail: (id: number) => ["articles", "detail", id] as const,
  },
  feeds: {
    all: ["feeds"] as const,
    refreshStatus: ["feeds", "refresh-status"] as const,
  },
  feedFolders: {
    all: ["feed-folders"] as const,
  },
  categories: {
    all: ["categories"] as const,
    newCount: ["categories", "new-count"] as const,
  },
  preferences: {
    all: ["preferences"] as const,
  },
  scoringStatus: {
    all: ["scoring-status"] as const,
  },
};

/** Invalidate caches that depend on feed state.
 *  Call after any mutation that changes feeds, folders, or article counts. */
export function invalidateFeedDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
}
