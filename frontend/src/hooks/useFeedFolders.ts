"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFeedFolder,
  deleteFeedFolder,
  fetchFeedFolders,
  reorderFeedFolders,
  updateFeedFolder,
} from "@/lib/api";
import { FEED_STATE_POLL_INTERVAL } from "@/lib/constants";
import { queryKeys, invalidateFeedDependents } from "@/lib/queryKeys";

export function useFeedFolders() {
  return useQuery({
    queryKey: queryKeys.feedFolders.all,
    queryFn: fetchFeedFolders,
    refetchInterval: FEED_STATE_POLL_INTERVAL,
  });
}

export function useCreateFeedFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, feedIds }: { name: string; feedIds: number[] }) =>
      createFeedFolder({ name, feed_ids: feedIds }),
    meta: { errorTitle: "Failed to create folder" },
    onSuccess: () => invalidateFeedDependents(queryClient),
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
    onSuccess: () => invalidateFeedDependents(queryClient),
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
    onSuccess: () => invalidateFeedDependents(queryClient),
  });
}

export function useReorderFeedFolders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderIds: number[]) => reorderFeedFolders(folderIds),
    meta: { errorTitle: "Failed to reorder folders" },
    onSuccess: () => invalidateFeedDependents(queryClient),
  });
}
