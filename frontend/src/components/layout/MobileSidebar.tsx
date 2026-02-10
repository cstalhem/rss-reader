"use client";

import { useState } from "react";
import { Box, Flex, Button, Text, Badge, CloseButton, Drawer } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import { useFeeds } from "@/hooks/useFeeds";
import {
  useDeleteFeed,
  useMarkAllRead,
  useUpdateFeed,
} from "@/hooks/useFeedMutations";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import { FeedRow } from "@/components/feed/FeedRow";
import { DeleteFeedDialog } from "@/components/feed/DeleteFeedDialog";
import { Feed } from "@/lib/types";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFeedId: number | null;
  onSelectFeed: (feedId: number | null) => void;
  onAddFeedClick: () => void;
}

export function MobileSidebar({
  isOpen,
  onClose,
  selectedFeedId,
  onSelectFeed,
  onAddFeedClick,
}: MobileSidebarProps) {
  const { data: feeds, isLoading } = useFeeds();
  const deleteFeed = useDeleteFeed();
  const markAllRead = useMarkAllRead();
  const updateFeed = useUpdateFeed();

  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);

  // Calculate aggregate unread count
  const totalUnread = feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;

  const handleFeedClick = (feedId: number | null) => {
    onSelectFeed(feedId);
    onClose();
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
    <Drawer.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()} placement="start" size={{ base: "full", sm: "xs" }}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Feeds</Drawer.Title>
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
            ) : feeds && feeds.length > 0 ? (
              <Box>
                {/* "All Articles" row */}
                <Flex
                  alignItems="center"
                  justifyContent="space-between"
                  px={4}
                  py={3}
                  cursor="pointer"
                  bg={selectedFeedId === null ? "colorPalette.subtle" : "transparent"}
                  _hover={{ bg: "bg.muted" }}
                  onClick={() => handleFeedClick(null)}
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

                {/* Feed rows with swipe actions */}
                {feeds.map((feed) => (
                  <FeedRow
                    key={feed.id}
                    feed={feed}
                    isSelected={selectedFeedId === feed.id}
                    onSelect={handleFeedClick}
                    onDelete={handleDelete}
                    onMarkAllRead={handleMarkAllRead}
                    onRename={handleRename}
                    isDraggable={false}
                  />
                ))}
              </Box>
            ) : (
              <EmptyFeedState />
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="outline" width="100%" onClick={onAddFeedClick}>
              <LuPlus /> Add feed
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>

      {/* Delete confirmation dialog */}
      <DeleteFeedDialog
        feed={feedToDelete}
        onClose={() => setFeedToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </Drawer.Root>
  );
}
