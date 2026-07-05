"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rescueArticle } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useRescueArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => rescueArticle(id),
    onSuccess: () => {
      // The article moves from the blocked view into the normal unread list —
      // invalidate both (articles.all prefix-matches the blocked key too) plus
      // the badges (server-computed) rather than surgically patching caches
      // across two disjoint views.
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.counts });
    },
    meta: { errorTitle: "Failed to rescue article" },
  });
}
