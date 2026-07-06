"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFeed } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { FeedUpdatePayload } from "@/lib/types";

export function useUpdateFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FeedUpdatePayload }) =>
      updateFeed(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
    },
    meta: { errorTitle: "Failed to update feed" },
  });
}
