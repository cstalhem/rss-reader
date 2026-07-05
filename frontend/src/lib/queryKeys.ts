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
};
