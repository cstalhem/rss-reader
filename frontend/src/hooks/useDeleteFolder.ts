"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFolder } from "@/lib/api";
import { invalidateFeedTreeAndArticles } from "@/lib/invalidation";

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deleteFeeds }: { id: number; deleteFeeds?: boolean }) =>
      deleteFolder(id, deleteFeeds),
    onSuccess: () => {
      // With delete_feeds=true the member feeds' articles cascade server-side.
      // Invalidate unconditionally — an extra refetch on ungroup is harmless.
      invalidateFeedTreeAndArticles(queryClient);
    },
    meta: { errorTitle: "Failed to delete folder" },
  });
}
