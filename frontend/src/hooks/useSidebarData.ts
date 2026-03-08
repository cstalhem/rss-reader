"use client";

import { useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useQuery } from "@tanstack/react-query";
import { useFeeds } from "@/hooks/useFeeds";
import {
  useDeleteFeed,
  useMarkAllRead,
  useUpdateFeed,
} from "@/hooks/useFeedMutations";
import { useCreateFeedFolder, useFeedFolders } from "@/hooks/useFeedFolders";
import {
  ALL_FEEDS_SELECTION,
  Feed,
  FeedSelection,
  isFeedSelected,
} from "@/lib/types";
import { fetchNewCategoryCount } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { NEW_COUNT_POLL_INTERVAL } from "@/lib/constants";

export type RootItem =
  | { kind: "folder"; order: number; id: number }
  | { kind: "feed"; order: number; id: number };

export function useSidebarData(
  selection: FeedSelection,
  onSelect: (selection: FeedSelection) => void,
) {
  const { data: feeds, isLoading: isFeedsLoading } = useFeeds();
  const { data: folders, isLoading: isFoldersLoading } = useFeedFolders();
  const deleteFeed = useDeleteFeed();
  const markAllRead = useMarkAllRead();
  const updateFeed = useUpdateFeed();
  const createFolder = useCreateFeedFolder();

  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);
  const [feedToMove, setFeedToMove] = useState<Feed | null>(null);
  const [expandedFolders, setExpandedFolders] = useLocalStorage<
    Record<number, boolean>
  >("expanded-folders", {});

  const { data: newCatCount } = useQuery({
    queryKey: queryKeys.categories.newCount,
    queryFn: fetchNewCategoryCount,
    refetchInterval: NEW_COUNT_POLL_INTERVAL,
  });
  const hasNewCategories = (newCatCount?.count ?? 0) > 0;

  const totalUnread =
    feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;

  const feedsByFolder = useMemo(() => {
    const grouped = new Map<number, Feed[]>();
    for (const feed of feeds ?? []) {
      if (feed.folder_id === null) continue;
      const list = grouped.get(feed.folder_id) ?? [];
      list.push(feed);
      grouped.set(feed.folder_id, list);
    }

    for (const list of grouped.values()) {
      list.sort((a, b) => a.display_order - b.display_order || a.id - b.id);
    }

    return grouped;
  }, [feeds]);

  const ungroupedFeeds = useMemo(
    () =>
      (feeds ?? [])
        .filter((feed) => feed.folder_id === null)
        .sort((a, b) => a.display_order - b.display_order || a.id - b.id),
    [feeds],
  );

  const orderedFolders = useMemo(
    () =>
      [...(folders ?? [])].sort(
        (a, b) => a.display_order - b.display_order || a.id - b.id,
      ),
    [folders],
  );

  const rootItems = useMemo<RootItem[]>(() => {
    const items: RootItem[] = [
      ...orderedFolders.map((folder) => ({
        kind: "folder" as const,
        order: folder.display_order,
        id: folder.id,
      })),
      ...ungroupedFeeds.map((feed) => ({
        kind: "feed" as const,
        order: feed.display_order,
        id: feed.id,
      })),
    ];

    return items.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.id - b.id;
    });
  }, [orderedFolders, ungroupedFeeds]);

  const isLoading = isFeedsLoading || isFoldersLoading;
  const hasItems = (feeds?.length ?? 0) + (folders?.length ?? 0) > 0;

  const handleDeleteConfirm = (feedId: number) => {
    deleteFeed.mutate(feedId);
    if (isFeedSelected(selection, feedId)) {
      onSelect(ALL_FEEDS_SELECTION);
    }
    setFeedToDelete(null);
  };

  const handleRename = (id: number, title: string) => {
    updateFeed.mutate({ id, data: { title } });
  };

  const handleMarkAllRead = (feedId: number) => {
    markAllRead.mutate(feedId);
  };

  const handleMoveFeed = (folderId: number | null) => {
    if (!feedToMove) return;
    updateFeed.mutate({
      id: feedToMove.id,
      data: { folder_id: folderId },
    });
    setFeedToMove(null);
  };

  const handleCreateFolderAndMove = async (folderName: string) => {
    if (!feedToMove) return;

    try {
      await createFolder.mutateAsync({
        name: folderName,
        feedIds: [feedToMove.id],
      });
      setFeedToMove(null);
    } catch {
      // Global mutation error handling displays feedback.
    }
  };

  const toggleFolderExpanded = (folderId: number) => {
    setExpandedFolders((previous) => ({
      ...previous,
      [folderId]: !(previous[folderId] ?? true),
    }));
  };

  return {
    feeds,
    folders,
    feedsByFolder,
    ungroupedFeeds,
    orderedFolders,
    rootItems,
    isLoading,
    hasItems,
    totalUnread,
    hasNewCategories,
    expandedFolders,
    feedToDelete,
    setFeedToDelete,
    feedToMove,
    setFeedToMove,
    handleDeleteConfirm,
    handleRename,
    handleMarkAllRead,
    handleMoveFeed,
    handleCreateFolderAndMove,
    toggleFolderExpanded,
  };
}
