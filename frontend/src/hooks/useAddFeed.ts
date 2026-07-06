"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addFeed } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { FeedCreatePayload } from "@/lib/types";

export function useAddFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FeedCreatePayload) => addFeed(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
      // Adding a feed saves its initial articles — refresh lists and badges.
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.counts });
    },
    meta: { errorTitle: "Failed to add feed" },
  });
}
