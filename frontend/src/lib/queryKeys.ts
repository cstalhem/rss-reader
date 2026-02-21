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
  ollama: {
    health: ["ollama-health"] as const,
    models: ["ollama-models"] as const,
    config: ["ollama-config"] as const,
    prompts: ["ollama-prompts"] as const,
    downloadStatus: ["download-status"] as const,
  },
};
