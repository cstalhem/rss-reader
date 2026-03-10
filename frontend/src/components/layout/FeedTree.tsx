"use client";

import { useMemo } from "react";
import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { LuChevronDown, LuChevronRight, LuFolder } from "react-icons/lu";
import { FeedRow } from "@/components/feed/FeedRow";
import { UnreadCountBadge } from "@/components/ui/unread-count-badge";
import type { RootItem } from "@/hooks/useSidebarData";
import type { Feed, FeedFolder, FeedSelection } from "@/lib/types";
import { isFeedSelected } from "@/lib/types";

interface FeedTreeProps {
  enableSwipeActions: boolean;
  expandedFolders: Record<number, boolean>;
  feedsByFolder: Map<number, Feed[]>;
  folderFeedPadding: number | string;
  onDeleteFeed: (feed: Feed) => void;
  onMarkAllRead: (feedId: number) => void;
  onMoveFeed: (feed: Feed) => void;
  onRenameFeed: (id: number, title: string) => void;
  onSelect: (selection: FeedSelection) => void;
  onToggleFolderExpanded: (folderId: number) => void;
  orderedFolders: FeedFolder[];
  rootItems: RootItem[];
  selection: FeedSelection;
  showDesktopActions: boolean;
  totalUnread: number;
  ungroupedFeeds: Feed[];
}

export function FeedTree({
  enableSwipeActions,
  expandedFolders,
  feedsByFolder,
  folderFeedPadding,
  onDeleteFeed,
  onMarkAllRead,
  onMoveFeed,
  onRenameFeed,
  onSelect,
  onToggleFolderExpanded,
  orderedFolders,
  rootItems,
  selection,
  showDesktopActions,
  totalUnread,
  ungroupedFeeds,
}: FeedTreeProps) {
  const foldersById = useMemo(
    () => new Map(orderedFolders.map((folder) => [folder.id, folder])),
    [orderedFolders],
  );
  const ungroupedFeedsById = useMemo(
    () => new Map(ungroupedFeeds.map((feed) => [feed.id, feed])),
    [ungroupedFeeds],
  );

  return (
    <Box>
      <Flex
        alignItems="center"
        justifyContent="space-between"
        px={4}
        py={3}
        cursor="pointer"
        bg={selection.kind === "all" ? "colorPalette.subtle" : "transparent"}
        _hover={{ bg: "bg.muted" }}
        onClick={() => onSelect({ kind: "all" })}
        borderLeftWidth="3px"
        borderLeftColor={
          selection.kind === "all" ? "colorPalette.solid" : "transparent"
        }
      >
        <Text fontSize="sm" fontWeight="medium">
          All Articles
        </Text>
        <UnreadCountBadge count={totalUnread} />
      </Flex>

      {rootItems.map((item) => {
        if (item.kind === "folder") {
          const folder = foldersById.get(item.id);
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
                borderLeftColor={
                  isSelected ? "colorPalette.solid" : "transparent"
                }
                onClick={() => onSelect({ kind: "folder", folderId: folder.id })}
              >
                <LuFolder size={15} />
                <Text fontSize="sm" fontWeight="medium" flex={1} truncate>
                  {folder.name}
                </Text>
                <UnreadCountBadge count={folder.unread_count} />
                <IconButton
                  aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                  size="xs"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleFolderExpanded(folder.id);
                  }}
                >
                  {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
                </IconButton>
              </Flex>

              {isExpanded && (
                <Box pl={folderFeedPadding}>
                  {folderFeeds.map((feed) => (
                    <FeedRow
                      key={feed.id}
                      feed={feed}
                      isSelected={isFeedSelected(selection, feed.id)}
                      onSelect={(feedId) => onSelect({ kind: "feed", feedId })}
                      onDelete={onDeleteFeed}
                      onMarkAllRead={onMarkAllRead}
                      onRename={onRenameFeed}
                      onMove={onMoveFeed}
                      isDraggable={false}
                      showDesktopActions={showDesktopActions}
                      enableSwipeActions={enableSwipeActions}
                    />
                  ))}
                </Box>
              )}
            </Box>
          );
        }

        const feed = ungroupedFeedsById.get(item.id);
        if (!feed) return null;

        return (
          <FeedRow
            key={`feed-${feed.id}`}
            feed={feed}
            isSelected={isFeedSelected(selection, feed.id)}
            onSelect={(feedId) => onSelect({ kind: "feed", feedId })}
            onDelete={onDeleteFeed}
            onMarkAllRead={onMarkAllRead}
            onRename={onRenameFeed}
            onMove={onMoveFeed}
            isDraggable={false}
            showDesktopActions={showDesktopActions}
            enableSwipeActions={enableSwipeActions}
          />
        );
      })}
    </Box>
  );
}
