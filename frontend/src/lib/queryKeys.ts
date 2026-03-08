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
  providers: {
    all: ["providers"] as const,
  },
  models: {
    available: ["models", "available"] as const,
  },
  taskRoutes: {
    all: ["task-routes"] as const,
  },
  ollama: {
    health: ["ollama-health"] as const,
    models: ["ollama-models"] as const,
    config: ["ollama-config"] as const,
    prompts: ["ollama-prompts"] as const,
    downloadStatus: ["download-status"] as const,
  },
};

/** Invalidate caches that depend on which models are available.
 *  Call after any mutation that changes provider config, model list, or task routes. */
export function invalidateModelDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.models.available });
  queryClient.invalidateQueries({ queryKey: queryKeys.taskRoutes.all });
}

/** Invalidate caches that depend on feed state.
 *  Call after any mutation that changes feeds, folders, or article counts. */
export function invalidateFeedDependents(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
}
