"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createFeed,
  deleteFeed,
  updateFeed,
  reorderFeeds,
  markAllFeedRead,
} from "@/lib/api";
import { Feed } from "@/lib/types";

export function useAddFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => createFeed(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export function useDeleteFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteFeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}

export function useUpdateFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { title?: string; display_order?: number };
    }) => updateFeed(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}

export function useReorderFeeds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedIds: number[]) => reorderFeeds(feedIds),
    onMutate: async (feedIds) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["feeds"] });

      // Snapshot the previous value
      const previousFeeds = queryClient.getQueryData<Feed[]>(["feeds"]);

      // Optimistically update to the new value
      if (previousFeeds) {
        const reordered = feedIds
          .map((id) => previousFeeds.find((f) => f.id === id))
          .filter((f): f is Feed => f !== undefined);
        queryClient.setQueryData(["feeds"], reordered);
      }

      // Return a context object with the snapshotted value
      return { previousFeeds };
    },
    onError: (_err, _feedIds, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousFeeds) {
        queryClient.setQueryData(["feeds"], context.previousFeeds);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedId: number) => markAllFeedRead(feedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeds"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });
}
