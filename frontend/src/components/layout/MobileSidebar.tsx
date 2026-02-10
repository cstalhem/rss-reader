"use client";

import { Box, Flex, IconButton, Text, Badge, Drawer } from "@chakra-ui/react";
import { LuPlus, LuX } from "react-icons/lu";
import { useFeeds } from "@/hooks/useFeeds";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";

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

  // Calculate aggregate unread count
  const totalUnread = feeds?.reduce((sum, feed) => sum + feed.unread_count, 0) ?? 0;

  const handleFeedClick = (feedId: number | null) => {
    onSelectFeed(feedId);
    onClose();
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()} placement="start" size={{ base: "full", sm: "xs" }}>
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <Flex alignItems="center" justifyContent="space-between" width="100%">
              <Drawer.Title>Feeds</Drawer.Title>
              <Flex gap={2}>
                <IconButton
                  aria-label="Add feed"
                  onClick={onAddFeedClick}
                  size="sm"
                  variant="ghost"
                >
                  <LuPlus />
                </IconButton>
                <Drawer.CloseTrigger asChild>
                  <IconButton aria-label="Close sidebar" size="sm" variant="ghost">
                    <LuX />
                  </IconButton>
                </Drawer.CloseTrigger>
              </Flex>
            </Flex>
          </Drawer.Header>

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

                {/* Feed rows */}
                {feeds.map((feed) => (
                  <Flex
                    key={feed.id}
                    alignItems="center"
                    justifyContent="space-between"
                    px={4}
                    py={3}
                    cursor="pointer"
                    bg={
                      selectedFeedId === feed.id
                        ? "colorPalette.subtle"
                        : "transparent"
                    }
                    _hover={{ bg: "bg.muted" }}
                    onClick={() => handleFeedClick(feed.id)}
                    borderLeftWidth="3px"
                    borderLeftColor={
                      selectedFeedId === feed.id
                        ? "colorPalette.solid"
                        : "transparent"
                    }
                  >
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      flex={1}
                      truncate
                      mr={2}
                    >
                      {feed.title}
                    </Text>
                    {feed.unread_count > 0 && (
                      <Badge colorPalette="accent" size="sm">
                        {feed.unread_count}
                      </Badge>
                    )}
                  </Flex>
                ))}
              </Box>
            ) : (
              <EmptyFeedState />
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
