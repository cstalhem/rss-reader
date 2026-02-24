"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  CloseButton,
  Drawer,
  Flex,
  Heading,
  IconButton,
  Text,
} from "@chakra-ui/react";
import {
  LuChevronDown,
  LuChevronRight,
  LuFolder,
  LuFolderPlus,
  LuPlus,
  LuSettings,
} from "react-icons/lu";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useFeeds } from "@/hooks/useFeeds";
import {
  useDeleteFeed,
  useMarkAllRead,
  useUpdateFeed,
} from "@/hooks/useFeedMutations";
import { useCreateFeedFolder, useFeedFolders } from "@/hooks/useFeedFolders";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import { FeedRow } from "@/components/feed/FeedRow";
import { MoveToFolderDialog } from "@/components/feed/MoveToFolderDialog";
import { DeleteFeedDialog } from "@/components/feed/DeleteFeedDialog";
import { ThemeToggle } from "@/components/ui/color-mode";
import {
  ALL_FEEDS_SELECTION,
  Feed,
  FeedSelection,
  isFeedSelected,
} from "@/lib/types";
import { fetchNewCategoryCount } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { NEW_COUNT_POLL_INTERVAL } from "@/lib/constants";
import { shouldShowFolderUnreadBadge } from "./feedSelection";

type RootItem =
  | { kind: "folder"; order: number; id: number }
  | { kind: "feed"; order: number; id: number };

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selection: FeedSelection;
  onSelect: (selection: FeedSelection) => void;
  onAddFeedClick: () => void;
  onAddFolderClick: () => void;
}

export function MobileSidebar({
  isOpen,
  onClose,
  selection,
  onSelect,
  onAddFeedClick,
  onAddFolderClick,
}: MobileSidebarProps) {
  const { data: feeds, isLoading: isFeedsLoading } = useFeeds();
  const { data: folders, isLoading: isFoldersLoading } = useFeedFolders();
  const deleteFeed = useDeleteFeed();
  const markAllRead = useMarkAllRead();
  const updateFeed = useUpdateFeed();
  const createFolder = useCreateFeedFolder();

  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);
  const [feedToMove, setFeedToMove] = useState<Feed | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});

  const { data: newCatCount } = useQuery({
    queryKey: queryKeys.categories.newCount,
    queryFn: fetchNewCategoryCount,
    refetchInterval: NEW_COUNT_POLL_INTERVAL,
  });
  const hasNewCategories = (newCatCount?.count ?? 0) > 0;

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
    [feeds]
  );

  const orderedFolders = useMemo(
    () =>
      [...(folders ?? [])].sort(
        (a, b) => a.display_order - b.display_order || a.id - b.id
      ),
    [folders]
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

  const totalUnread = feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;

  const isLoading = isFeedsLoading || isFoldersLoading;
  const hasItems = (feeds?.length ?? 0) + (folders?.length ?? 0) > 0;

  const handleSelect = (nextSelection: FeedSelection) => {
    onSelect(nextSelection);
    onClose();
  };

  const handleDeleteConfirm = (feedId: number) => {
    deleteFeed.mutate(feedId);
    if (isFeedSelected(selection, feedId)) {
      onSelect(ALL_FEEDS_SELECTION);
    }
    setFeedToDelete(null);
  };

  const handleMarkAllRead = (feedId: number) => {
    markAllRead.mutate(feedId);
  };

  const handleRename = (id: number, title: string) => {
    updateFeed.mutate({ id, data: { title } });
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

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
      placement="start"
      size={{ base: "full", sm: "xs" }}
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              <Link href="/">
                <Heading size="md" fontWeight="semibold">
                  RSS Reader
                </Heading>
              </Link>
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.CloseTrigger asChild>
            <CloseButton size="sm" />
          </Drawer.CloseTrigger>

          <Drawer.Body>
            {isLoading ? (
              <Box px={4} py={3}>
                <Text fontSize="sm" color="fg.muted">
                  Loading...
                </Text>
              </Box>
            ) : hasItems ? (
              <Box>
                <Flex
                  alignItems="center"
                  justifyContent="space-between"
                  px={4}
                  py={3}
                  cursor="pointer"
                  bg={selection.kind === "all" ? "colorPalette.subtle" : "transparent"}
                  _hover={{ bg: "bg.muted" }}
                  onClick={() => handleSelect(ALL_FEEDS_SELECTION)}
                  borderLeftWidth="3px"
                  borderLeftColor={
                    selection.kind === "all" ? "colorPalette.solid" : "transparent"
                  }
                >
                  <Text fontSize="sm" fontWeight="medium">
                    All Articles
                  </Text>
                  {totalUnread > 0 && (
                    <Badge colorPalette="accent" size="sm">
                      {totalUnread}
                    </Badge>
                  )}
                </Flex>

                {rootItems.map((item) => {
                  if (item.kind === "folder") {
                    const folder = orderedFolders.find((entry) => entry.id === item.id);
                    if (!folder) return null;

                    const folderFeeds = feedsByFolder.get(folder.id) ?? [];
                    const isExpanded = expandedFolders[folder.id] ?? true;
                    const isSelected =
                      selection.kind === "folder" && selection.folderId === folder.id;

                    return (
                      <Box key={`folder-${folder.id}`}>
                        <Flex
                          alignItems="center"
                          gap={2}
                          px={4}
                          py={2.5}
                          cursor="pointer"
                          bg={isSelected ? "accent.subtle" : "transparent"}
                          _hover={{ bg: isSelected ? "accent.subtle" : "bg.muted" }}
                          borderLeftWidth="3px"
                          borderLeftColor={isSelected ? "accent.solid" : "transparent"}
                          onClick={() => handleSelect({ kind: "folder", folderId: folder.id })}
                        >
                          <LuFolder size={15} />
                          <Text fontSize="sm" fontWeight="medium" flex={1} truncate>
                            {folder.name}
                          </Text>
                          {shouldShowFolderUnreadBadge(folder.unread_count) ? (
                            <Badge colorPalette="accent" size="sm">
                              {folder.unread_count}
                            </Badge>
                          ) : null}
                          <IconButton
                            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                            size="xs"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFolderExpanded(folder.id);
                            }}
                          >
                            {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
                          </IconButton>
                        </Flex>

                        {isExpanded && (
                          <Box pl={6}>
                            {folderFeeds.map((feed) => (
                              <FeedRow
                                key={feed.id}
                                feed={feed}
                                isSelected={isFeedSelected(selection, feed.id)}
                                onSelect={(feedId) => handleSelect({ kind: "feed", feedId })}
                                onDelete={setFeedToDelete}
                                onMarkAllRead={handleMarkAllRead}
                                onRename={handleRename}
                                onMove={setFeedToMove}
                                isDraggable={false}
                                showDesktopActions={false}
                                enableSwipeActions={true}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  }

                  const feed = ungroupedFeeds.find((entry) => entry.id === item.id);
                  if (!feed) return null;

                  return (
                    <FeedRow
                      key={`feed-${feed.id}`}
                      feed={feed}
                      isSelected={isFeedSelected(selection, feed.id)}
                      onSelect={(feedId) => handleSelect({ kind: "feed", feedId })}
                      onDelete={setFeedToDelete}
                      onMarkAllRead={handleMarkAllRead}
                      onRename={handleRename}
                      onMove={setFeedToMove}
                      isDraggable={false}
                      showDesktopActions={false}
                      enableSwipeActions={true}
                    />
                  );
                })}
              </Box>
            ) : (
              <EmptyFeedState />
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Flex direction="column" width="100%" gap={2}>
              <Flex alignItems="center" justifyContent="space-between">
                <Link href="/settings" onClick={onClose}>
                  <Flex alignItems="center" gap={2} position="relative">
                    <IconButton aria-label="Settings" size="sm" variant="ghost">
                      <LuSettings />
                    </IconButton>
                    <Text fontSize="sm" color="fg.muted">
                      Settings
                    </Text>
                    {hasNewCategories && (
                      <Box
                        position="absolute"
                        top="4px"
                        left="28px"
                        width="8px"
                        height="8px"
                        borderRadius="full"
                        bg="accent.solid"
                        pointerEvents="none"
                      />
                    )}
                  </Flex>
                </Link>
                <ThemeToggle colorPalette="accent" />
              </Flex>

              <Flex gap={2}>
                <Button
                  variant="outline"
                  width="100%"
                  onClick={onAddFolderClick}
                  colorPalette="accent"
                >
                  <LuFolderPlus /> Create folder
                </Button>
                <Button
                  variant="outline"
                  width="100%"
                  onClick={onAddFeedClick}
                  colorPalette="accent"
                >
                  <LuPlus /> Add feed
                </Button>
              </Flex>
            </Flex>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>

      <DeleteFeedDialog
        feed={feedToDelete}
        onClose={() => setFeedToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
      <MoveToFolderDialog
        open={!!feedToMove}
        onOpenChange={(open) => {
          if (!open) setFeedToMove(null);
        }}
        folders={orderedFolders}
        onMove={handleMoveFeed}
        onCreateAndMove={handleCreateFolderAndMove}
      />
    </Drawer.Root>
  );
}
