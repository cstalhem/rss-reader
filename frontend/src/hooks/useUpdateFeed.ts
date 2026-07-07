"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFeed } from "@/lib/api";
import { invalidateFeedTreeAndArticles } from "@/lib/invalidation";
import type { FeedUpdatePayload } from "@/lib/types";

export function useUpdateFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FeedUpdatePayload }) =>
      updateFeed(id, data),
    onSuccess: () => {
      // A rename changes feed_title on article rows; a folder move changes
      // folder-scoped lists and counts — refresh articles alongside the tree.
      invalidateFeedTreeAndArticles(queryClient);
    },
    meta: { errorTitle: "Failed to update feed" },
  });
}
