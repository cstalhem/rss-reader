"use client";

import { useState } from "react";
import { Box, Flex, Heading, IconButton, Text, Badge, Circle } from "@chakra-ui/react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuPlus,
  LuRss,
  LuInbox,
  LuSettings,
} from "react-icons/lu";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useFeeds } from "@/hooks/useFeeds";
import {
  useReorderFeeds,
  useDeleteFeed,
  useMarkAllRead,
  useUpdateFeed,
} from "@/hooks/useFeedMutations";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import { FeedRow } from "@/components/feed/FeedRow";
import { DeleteFeedDialog } from "@/components/feed/DeleteFeedDialog";
import { ThemeToggle } from "@/components/ui/color-mode";
import { Feed } from "@/lib/types";
import { fetchNewCategoryCount } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED, NEW_COUNT_POLL_INTERVAL } from "@/lib/constants";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  selectedFeedId: number | null;
  onSelectFeed: (feedId: number | null) => void;
  onAddFeedClick: () => void;
}

export function Sidebar({
  isCollapsed,
  onToggle,
  selectedFeedId,
  onSelectFeed,
  onAddFeedClick,
}: SidebarProps) {
  const { data: feeds, isLoading } = useFeeds();
  const reorderFeeds = useReorderFeeds();
  const deleteFeed = useDeleteFeed();
  const markAllRead = useMarkAllRead();
  const updateFeed = useUpdateFeed();

  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);

  // New category count for settings dot badge (moved from Header)
  const { data: newCatCount } = useQuery({
    queryKey: queryKeys.categories.newCount,
    queryFn: fetchNewCategoryCount,
    refetchInterval: NEW_COUNT_POLL_INTERVAL,
  });
  const hasNewCategories = (newCatCount?.count ?? 0) > 0;

  // Calculate aggregate unread count
  const totalUnread = feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !feeds || active.id === over.id) return;

    const oldIndex = feeds.findIndex((f) => f.id === active.id);
    const newIndex = feeds.findIndex((f) => f.id === over.id);

    const reorderedFeeds = arrayMove(feeds, oldIndex, newIndex);
    const feedIds = reorderedFeeds.map((f) => f.id);

    reorderFeeds.mutate(feedIds);
  };

  const handleDelete = (feed: Feed) => {
    setFeedToDelete(feed);
  };

  const handleDeleteConfirm = (feedId: number) => {
    deleteFeed.mutate(feedId);
    if (selectedFeedId === feedId) {
      onSelectFeed(null);
    }
    setFeedToDelete(null);
  };

  const handleMarkAllRead = (feedId: number) => {
    markAllRead.mutate(feedId);
  };

  const handleRename = (id: number, title: string) => {
    updateFeed.mutate({ id, data: { title } });
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
        {/* Top: Logo/brand */}
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

        {/* Middle: Feeds (scrollable) */}
        <Flex direction="column" flex={1} overflow="hidden">
          {isCollapsed ? (
            /* Collapsed: icon-only feed list */
            <Box overflowY="auto" flex={1} py={2}>
              {/* All Articles icon */}
              <Flex
                justifyContent="center"
                py={2}
                cursor="pointer"
                bg={selectedFeedId === null ? "accent.subtle" : "transparent"}
                _hover={{ bg: "bg.muted" }}
                onClick={() => onSelectFeed(null)}
                title="All Articles"
              >
                <LuInbox size={18} />
              </Flex>

              {/* Feed initials */}
              {feeds?.map((feed) => (
                <Flex
                  key={feed.id}
                  justifyContent="center"
                  py={2}
                  cursor="pointer"
                  bg={selectedFeedId === feed.id ? "accent.subtle" : "transparent"}
                  _hover={{ bg: "bg.muted" }}
                  onClick={() => onSelectFeed(feed.id)}
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
              ))}
            </Box>
          ) : (
            /* Expanded: full feed list */
            <>
              {/* Header with "Feeds" label and + button */}
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

              {/* Feed list */}
              {isLoading ? (
                <Box px={4} py={3}>
                  <Text fontSize="sm" color="fg.muted">
                    Loading...
                  </Text>
                </Box>
              ) : feeds && feeds.length > 0 ? (
                <Box overflowY="auto" flex={1}>
                  {/* "All Articles" row */}
                  <Flex
                    colorPalette="accent"
                    alignItems="center"
                    justifyContent="space-between"
                    px={4}
                    py={3}
                    cursor="pointer"
                    bg={selectedFeedId === null ? "colorPalette.subtle" : "transparent"}
                    _hover={{ bg: "bg.muted" }}
                    onClick={() => onSelectFeed(null)}
                    borderLeftWidth="3px"
                    borderLeftColor={
                      selectedFeedId === null ? "colorPalette.solid" : "transparent"
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

                  {/* Feed rows with drag-to-reorder */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={feeds.map((f) => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {feeds.map((feed) => (
                        <FeedRow
                          key={feed.id}
                          feed={feed}
                          isSelected={selectedFeedId === feed.id}
                          onSelect={onSelectFeed}
                          onDelete={handleDelete}
                          onMarkAllRead={handleMarkAllRead}
                          onRename={handleRename}
                          isDraggable={true}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </Box>
              ) : (
                <EmptyFeedState />
              )}
            </>
          )}
        </Flex>

        {/* Bottom: Pinned utilities */}
        <Flex
          direction="column"
          borderTopWidth="1px"
          borderTopColor="border.subtle"
          py={2}
          px={isCollapsed ? 0 : 2}
          gap={1}
        >
          {/* Settings link with dot badge */}
          <Link href="/settings">
            <Flex
              alignItems="center"
              justifyContent={isCollapsed ? "center" : "flex-start"}
              gap={3}
              px={isCollapsed ? 0 : 2}
              py={1.5}
              borderRadius="md"
              _hover={{ bg: "bg.muted" }}
              position="relative"
            >
              <Box position="relative">
                <LuSettings size={18} />
                {hasNewCategories && (
                  <Box
                    position="absolute"
                    top="-2px"
                    right="-2px"
                    width="8px"
                    height="8px"
                    borderRadius="full"
                    bg="accent.solid"
                    pointerEvents="none"
                  />
                )}
              </Box>
              {!isCollapsed && (
                <Text fontSize="sm" color="fg.muted">
                  Settings
                </Text>
              )}
            </Flex>
          </Link>

          {/* Theme toggle */}
          <Flex
            alignItems="center"
            justifyContent={isCollapsed ? "center" : "flex-start"}
            gap={3}
            px={isCollapsed ? 0 : 2}
            py={0}
          >
            <ThemeToggle colorPalette="accent" />
            {!isCollapsed && (
              <Text fontSize="sm" color="fg.muted">
                Theme
              </Text>
            )}
          </Flex>

          {/* Collapse/expand toggle */}
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

      {/* Delete confirmation dialog */}
      <DeleteFeedDialog
        feed={feedToDelete}
        onClose={() => setFeedToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </Box>
  );
}
