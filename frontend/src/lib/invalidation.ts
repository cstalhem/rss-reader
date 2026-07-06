import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

/** Refetch the sidebar tree (feeds + folders) — for changes that only reshape the tree, like creating or renaming a folder. */
export function invalidateFeedTree(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
}

/** Feed tree plus every article query (lists, details, counts all share the ["articles"] prefix) — for changes that add/remove article rows or alter their feed/folder scoping. */
export function invalidateFeedTreeAndArticles(queryClient: QueryClient) {
  invalidateFeedTree(queryClient);
  queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
}
