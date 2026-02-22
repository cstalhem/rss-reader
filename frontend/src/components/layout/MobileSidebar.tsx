"use client";

import { useState } from "react";
import { Box, Flex, Heading, Button, Text, Badge, CloseButton, Drawer, IconButton } from "@chakra-ui/react";
import { LuPlus, LuSettings } from "react-icons/lu";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useFeeds } from "@/hooks/useFeeds";
import {
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
import { NEW_COUNT_POLL_INTERVAL } from "@/lib/constants";

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

  // New category count for settings dot badge
  const { data: newCatCount } = useQuery({
    queryKey: queryKeys.categories.newCount,
    queryFn: fetchNewCategoryCount,
    refetchInterval: NEW_COUNT_POLL_INTERVAL,
  });
  const hasNewCategories = (newCatCount?.count ?? 0) > 0;

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
            <Flex direction="column" width="100%" gap={2}>
              {/* Settings and Theme row */}
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
              {/* Add feed button */}
              <Button variant="outline" width="100%" onClick={onAddFeedClick} colorPalette="accent">
                <LuPlus /> Add feed
              </Button>
            </Flex>
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
