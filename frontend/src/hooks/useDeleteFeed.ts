"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFeed } from "@/lib/api";
import { invalidateFeedTreeAndArticles } from "@/lib/invalidation";

export function useDeleteFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteFeed(id),
    onSuccess: () => {
      // The feed's articles cascade server-side — refresh lists and badges.
      invalidateFeedTreeAndArticles(queryClient);
    },
    meta: { errorTitle: "Failed to delete feed" },
  });
}
