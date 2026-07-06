"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFeed } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useDeleteFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteFeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
      // The feed's articles cascade server-side — refresh lists and badges.
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.counts });
    },
    meta: { errorTitle: "Failed to delete feed" },
  });
}
