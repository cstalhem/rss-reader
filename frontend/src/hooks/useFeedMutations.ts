"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createFeed,
  deleteFeed,
  updateFeed,
  reorderFeeds,
  markAllFeedRead,
  markAllArticlesRead,
} from "@/lib/api";
import { Feed } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";

export function useAddFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => createFeed(url),
    meta: { errorTitle: "Failed to add feed" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useDeleteFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteFeed(id),
    meta: { errorTitle: "Failed to delete feed" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
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
    meta: { errorTitle: "Failed to update feed" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
    },
  });
}

export function useReorderFeeds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedIds: number[]) => reorderFeeds(feedIds),
    meta: { handlesOwnErrors: true },
    onMutate: async (feedIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feeds.all });

      const previousFeeds = queryClient.getQueryData<Feed[]>(queryKeys.feeds.all);

      if (previousFeeds) {
        const reordered = feedIds
          .map((id) => previousFeeds.find((f) => f.id === id))
          .filter((f): f is Feed => f !== undefined);
        queryClient.setQueryData(queryKeys.feeds.all, reordered);
      }

      return { previousFeeds };
    },
    onError: (_err, _feedIds, context) => {
      if (context?.previousFeeds) {
        queryClient.setQueryData(queryKeys.feeds.all, context.previousFeeds);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feedId: number) => markAllFeedRead(feedId),
    meta: { errorTitle: "Failed to mark feed as read" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useMarkAllArticlesRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllArticlesRead(),
    meta: { errorTitle: "Failed to mark all articles read" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
    },
  });
}
