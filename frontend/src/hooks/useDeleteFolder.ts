"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteFolder } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deleteFeeds }: { id: number; deleteFeeds?: boolean }) =>
      deleteFolder(id, deleteFeeds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
      // With delete_feeds=true the member feeds' articles cascade server-side.
      // Invalidate unconditionally — an extra refetch on ungroup is harmless.
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.counts });
    },
    meta: { errorTitle: "Failed to delete folder" },
  });
}
