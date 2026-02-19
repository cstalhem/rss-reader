"use client";

import { useState } from "react";
import { Box, Flex, IconButton, Text, Badge } from "@chakra-ui/react";
import { LuChevronLeft, LuChevronRight, LuPlus } from "react-icons/lu";
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
import { Feed } from "@/lib/types";
import { HEADER_HEIGHT, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "@/lib/constants";

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

  // Calculate aggregate unread count
  const totalUnread = feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Prevent accidental drags on click
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
      top={HEADER_HEIGHT}
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
        {/* Collapse/Expand Toggle */}
        <Flex
          justifyContent={isCollapsed ? "center" : "flex-end"}
          p={2}
          borderBottomWidth="1px"
          borderBottomColor="border.subtle"
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

        {/* Sidebar Content */}
        {!isCollapsed && (
          <Flex direction="column" height="100%" overflow="hidden">
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
          </Flex>
        )}
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
