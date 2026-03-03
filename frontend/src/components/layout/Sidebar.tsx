"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Circle,
  Flex,
  Heading,
  IconButton,
  Text,
} from "@chakra-ui/react";
import {
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuFolder,
  LuFolderPlus,
  LuInbox,
  LuPlus,
  LuRss,
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
import { SidebarSettingsTheme } from "@/components/ui/sidebar-settings-theme";
import {
  ALL_FEEDS_SELECTION,
  Feed,
  FeedSelection,
  isFeedSelected,
} from "@/lib/types";
import { fetchNewCategoryCount } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  NEW_COUNT_POLL_INTERVAL,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/constants";
import { shouldShowFolderUnreadBadge } from "./feedSelection";

type RootItem =
  | { kind: "folder"; order: number; id: number }
  | { kind: "feed"; order: number; id: number };

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  selection: FeedSelection;
  onSelect: (selection: FeedSelection) => void;
  onAddFeedClick: () => void;
  onAddFolderClick: () => void;
}

export function Sidebar({
  isCollapsed,
  onToggle,
  selection,
  onSelect,
  onAddFeedClick,
  onAddFolderClick,
}: SidebarProps) {
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

  const totalUnread = feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;

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

  return (
    <Box
      as="aside"
      position="fixed"
      top="0"
      left={0}
      bottom={0}
      width={isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED}
      bg="bg.subtle"
      borderRightWidth="1px"
      borderRightColor="border.subtle"
      transition="width 0.2s ease"
      display={{ base: "none", md: "block" }}
      zIndex={5}
    >
      <Flex direction="column" height="100%">
        <Flex
          alignItems="center"
          justifyContent={isCollapsed ? "center" : "flex-start"}
          px={isCollapsed ? 0 : 4}
          py={3}
          borderBottomWidth="1px"
          borderBottomColor="border.subtle"
          minHeight="48px"
        >
          {isCollapsed ? (
            <Link href="/" title="RSS Reader">
              <Circle size="8" bg="accent.subtle" color="accent.fg">
                <LuRss size={16} />
              </Circle>
            </Link>
          ) : (
            <Link href="/">
              <Heading size="md" fontWeight="semibold">
                RSS Reader
              </Heading>
            </Link>
          )}
        </Flex>

        <Flex direction="column" flex={1} overflow="hidden">
          {isCollapsed ? (
            <Box overflowY="auto" flex={1} py={2}>
              <Flex
                justifyContent="center"
                py={2}
                cursor="pointer"
                bg={selection.kind === "all" ? "accent.subtle" : "transparent"}
                _hover={{ bg: "bg.muted" }}
                onClick={() => onSelect(ALL_FEEDS_SELECTION)}
                title="All Articles"
              >
                <LuInbox size={18} />
              </Flex>

              {rootItems.map((item) => {
                if (item.kind === "folder") {
                  const folder = orderedFolders.find((entry) => entry.id === item.id);
                  if (!folder) return null;

                  return (
                    <Flex
                      key={`folder-${folder.id}`}
                      justifyContent="center"
                      py={2}
                      cursor="pointer"
                      bg={
                        selection.kind === "folder" &&
                        selection.folderId === folder.id
                          ? "accent.subtle"
                          : "transparent"
                      }
                      _hover={{ bg: "bg.muted" }}
                      onClick={() => onSelect({ kind: "folder", folderId: folder.id })}
                      title={folder.name}
                    >
                      <LuFolder size={16} />
                    </Flex>
                  );
                }

                const feed = ungroupedFeeds.find((entry) => entry.id === item.id);
                if (!feed) return null;

                return (
                  <Flex
                    key={`feed-${feed.id}`}
                    justifyContent="center"
                    py={2}
                    cursor="pointer"
                    bg={isFeedSelected(selection, feed.id) ? "accent.subtle" : "transparent"}
                    _hover={{ bg: "bg.muted" }}
                    onClick={() => onSelect({ kind: "feed", feedId: feed.id })}
                    title={feed.title}
                  >
                    <Circle
                      size="7"
                      bg={feed.unread_count > 0 ? "accent.subtle" : "bg.muted"}
                      fontSize="xs"
                      fontWeight="semibold"
                    >
                      {feed.title.charAt(0).toUpperCase()}
                    </Circle>
                  </Flex>
                );
              })}
            </Box>
          ) : (
            <>
              <Flex
                alignItems="center"
                justifyContent="space-between"
                px={4}
                py={3}
                borderBottomWidth="1px"
                borderBottomColor="border.subtle"
              >
                <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                  Feeds
                </Text>
                <Flex alignItems="center" gap={1}>
                  <IconButton
                    aria-label="Create folder"
                    onClick={onAddFolderClick}
                    size="sm"
                    variant="ghost"
                    colorPalette="accent"
                  >
                    <LuFolderPlus />
                  </IconButton>
                  <IconButton
                    aria-label="Add feed"
                    onClick={onAddFeedClick}
                    size="sm"
                    variant="ghost"
                    colorPalette="accent"
                  >
                    <LuPlus />
                  </IconButton>
                </Flex>
              </Flex>

              {isLoading ? (
                <Box px={4} py={3}>
                  <Text fontSize="sm" color="fg.muted">
                    Loading...
                  </Text>
                </Box>
              ) : hasItems ? (
                <Box overflowY="auto" flex={1}>
                  <Flex
                    colorPalette="accent"
                    alignItems="center"
                    justifyContent="space-between"
                    px={4}
                    py={3}
                    cursor="pointer"
                    bg={selection.kind === "all" ? "colorPalette.subtle" : "transparent"}
                    _hover={{ bg: "bg.muted" }}
                    onClick={() => onSelect(ALL_FEEDS_SELECTION)}
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
                            onClick={() =>
                              onSelect({ kind: "folder", folderId: folder.id })
                            }
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
                              aria-label={
                                isExpanded ? "Collapse folder" : "Expand folder"
                              }
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
                                  onSelect={(feedId) =>
                                    onSelect({ kind: "feed", feedId })
                                  }
                                  onDelete={setFeedToDelete}
                                  onMarkAllRead={handleMarkAllRead}
                                  onRename={handleRename}
                                  onMove={setFeedToMove}
                                  isDraggable={false}
                                  showDesktopActions={true}
                                  enableSwipeActions={false}
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
                        onSelect={(feedId) => onSelect({ kind: "feed", feedId })}
                        onDelete={setFeedToDelete}
                        onMarkAllRead={handleMarkAllRead}
                        onRename={handleRename}
                        onMove={setFeedToMove}
                        isDraggable={false}
                        showDesktopActions={true}
                        enableSwipeActions={false}
                      />
                    );
                  })}
                </Box>
              ) : (
                <EmptyFeedState />
              )}
            </>
          )}
        </Flex>

        <Flex
          direction="column"
          borderTopWidth="1px"
          borderTopColor="border.subtle"
          py={2}
          gap={1}
        >
          <SidebarSettingsTheme
            isCollapsed={isCollapsed}
            showSettings={true}
            hasNewCategories={hasNewCategories}
            containerPx={isCollapsed ? 0 : 2}
            rowPx={2}
          />

          <Flex
            justifyContent={isCollapsed ? "center" : "flex-end"}
            px={isCollapsed ? 0 : 2}
          >
            <IconButton
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={onToggle}
              size="sm"
              variant="ghost"
            >
              {isCollapsed ? <LuChevronRight /> : <LuChevronLeft />}
            </IconButton>
          </Flex>
        </Flex>
      </Flex>

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
    </Box>
  );
}
