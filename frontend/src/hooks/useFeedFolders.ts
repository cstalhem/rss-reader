"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFeedFolder,
  deleteFeedFolder,
  fetchFeedFolders,
  reorderFeedFolders,
  updateFeedFolder,
} from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useFeedFolders() {
  return useQuery({
    queryKey: queryKeys.feedFolders.all,
    queryFn: fetchFeedFolders,
  });
}

function invalidateFeedFolderRelated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
}

export function useCreateFeedFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, feedIds }: { name: string; feedIds: number[] }) =>
      createFeedFolder({ name, feed_ids: feedIds }),
    meta: { errorTitle: "Failed to create folder" },
    onSuccess: () => invalidateFeedFolderRelated(queryClient),
  });
}

export function useUpdateFeedFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; display_order?: number };
    }) => updateFeedFolder(id, data),
    meta: { errorTitle: "Failed to update folder" },
    onSuccess: () => invalidateFeedFolderRelated(queryClient),
  });
}

export function useDeleteFeedFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      deleteFeeds,
    }: {
      id: number;
      deleteFeeds: boolean;
    }) => deleteFeedFolder(id, deleteFeeds),
    meta: { errorTitle: "Failed to delete folder" },
    onSuccess: () => invalidateFeedFolderRelated(queryClient),
  });
}

export function useReorderFeedFolders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderIds: number[]) => reorderFeedFolders(folderIds),
    meta: { errorTitle: "Failed to reorder folders" },
    onSuccess: () => invalidateFeedFolderRelated(queryClient),
  });
}
