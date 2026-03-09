"use client";

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
import Link from "next/link";
import { useSidebarData } from "@/hooks/useSidebarData";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import { FeedRow } from "@/components/feed/FeedRow";
import { MoveToFolderDialog } from "@/components/feed/MoveToFolderDialog";
import { DeleteFeedDialog } from "@/components/feed/DeleteFeedDialog";
import { SidebarSettingsTheme } from "@/components/ui/sidebar-settings-theme";
import {
  ALL_FEEDS_SELECTION,
  FeedSelection,
  isFeedSelected,
} from "@/lib/types";
import {
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/constants";

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
  const {
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
  } = useSidebarData(selection, onSelect);

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
                      <Badge colorPalette="accent" variant="solid" size="sm">
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
                            bg={isSelected ? "colorPalette.subtle" : "transparent"}
                            _hover={{ bg: isSelected ? "colorPalette.subtle" : "bg.muted" }}
                            borderLeftWidth="3px"
                            borderLeftColor={isSelected ? "colorPalette.solid" : "transparent"}
                            onClick={() =>
                              onSelect({ kind: "folder", folderId: folder.id })
                            }
                          >
                            <LuFolder size={15} />
                            <Text fontSize="sm" fontWeight="medium" flex={1} truncate>
                              {folder.name}
                            </Text>
                            {folder.unread_count > 0 ? (
                              <Badge colorPalette="accent" variant="solid" size="sm">
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
