"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addFeed } from "@/lib/api";
import { invalidateFeedTreeAndArticles } from "@/lib/invalidation";
import type { FeedCreatePayload } from "@/lib/types";

export function useAddFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FeedCreatePayload) => addFeed(payload),
    onSuccess: () => {
      // Adding a feed saves its initial articles — refresh lists and badges.
      invalidateFeedTreeAndArticles(queryClient);
    },
    meta: { errorTitle: "Failed to add feed" },
  });
}
