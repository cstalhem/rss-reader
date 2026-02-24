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
import { queryKeys } from "@/lib/queryKeys";

export function useAddFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => createFeed(url),
    meta: { errorTitle: "Failed to add feed" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
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
      data: { title?: string; display_order?: number; folder_id?: number | null };
    }) => updateFeed(id, data),
    meta: { errorTitle: "Failed to update feed" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useReorderFeeds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      feedIds,
      folderId,
    }: {
      feedIds: number[];
      folderId?: number | null;
    }) => reorderFeeds(feedIds, folderId),
    meta: { errorTitle: "Failed to reorder feeds" },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
    },
  });
}
