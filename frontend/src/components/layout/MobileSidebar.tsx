"use client";

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
import Link from "next/link";
import { useSidebarData } from "@/hooks/useSidebarData";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import { FeedRow } from "@/components/feed/FeedRow";
import { MoveToFolderDialog } from "@/components/feed/MoveToFolderDialog";
import { DeleteFeedDialog } from "@/components/feed/DeleteFeedDialog";
import { ThemeToggle } from "@/components/ui/color-mode";
import {
  ALL_FEEDS_SELECTION,
  FeedSelection,
  isFeedSelected,
} from "@/lib/types";

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

  const handleSelect = (nextSelection: FeedSelection) => {
    onSelect(nextSelection);
    onClose();
  };

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={({ open }) => !open && onClose()}
      placement='start'
      size={{ base: "full", sm: "xs" }}
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              <Link href='/'>
                <Heading size='md' fontWeight='semibold'>
                  RSS Reader
                </Heading>
              </Link>
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.CloseTrigger asChild>
            <CloseButton size='sm' />
          </Drawer.CloseTrigger>

          <Drawer.Body px={0}>
            {isLoading ? (
              <Box px={4} py={3}>
                <Text fontSize='sm' color='fg.muted'>
                  Loading...
                </Text>
              </Box>
            ) : hasItems ? (
              <Box>
                <Flex
                  alignItems='center'
                  justifyContent='space-between'
                  px={4}
                  py={3}
                  cursor='pointer'
                  bg={
                    selection.kind === "all"
                      ? "colorPalette.subtle"
                      : "transparent"
                  }
                  _hover={{ bg: "bg.muted" }}
                  onClick={() => handleSelect(ALL_FEEDS_SELECTION)}
                  borderLeftWidth='3px'
                  borderLeftColor={
                    selection.kind === "all"
                      ? "colorPalette.solid"
                      : "transparent"
                  }
                >
                  <Text fontSize='sm' fontWeight='medium'>
                    All Articles
                  </Text>
                  {totalUnread > 0 && (
                    <Badge colorPalette='accent' size='sm'>
                      {totalUnread}
                    </Badge>
                  )}
                </Flex>

                {rootItems.map((item) => {
                  if (item.kind === "folder") {
                    const folder = orderedFolders.find(
                      (entry) => entry.id === item.id,
                    );
                    if (!folder) return null;

                    const folderFeeds = feedsByFolder.get(folder.id) ?? [];
                    const isExpanded = expandedFolders[folder.id] ?? true;
                    const isSelected =
                      selection.kind === "folder" &&
                      selection.folderId === folder.id;

                    return (
                      <Box key={`folder-${folder.id}`}>
                        <Flex
                          alignItems='center'
                          gap={2}
                          px={4}
                          py={2.5}
                          cursor='pointer'
                          bg={isSelected ? "colorPalette.subtle" : "transparent"}
                          _hover={{
                            bg: isSelected ? "colorPalette.subtle" : "bg.muted",
                          }}
                          borderLeftWidth='3px'
                          borderLeftColor={
                            isSelected ? "colorPalette.solid" : "transparent"
                          }
                          onClick={() =>
                            handleSelect({
                              kind: "folder",
                              folderId: folder.id,
                            })
                          }
                        >
                          <LuFolder size={15} />
                          <Text
                            fontSize='sm'
                            fontWeight='medium'
                            flex={1}
                            truncate
                          >
                            {folder.name}
                          </Text>
                          {folder.unread_count > 0 ? (
                            <Badge colorPalette='accent' size='sm'>
                              {folder.unread_count}
                            </Badge>
                          ) : null}
                          <IconButton
                            aria-label={
                              isExpanded ? "Collapse folder" : "Expand folder"
                            }
                            size='xs'
                            variant='ghost'
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFolderExpanded(folder.id);
                            }}
                          >
                            {isExpanded ? (
                              <LuChevronDown />
                            ) : (
                              <LuChevronRight />
                            )}
                          </IconButton>
                        </Flex>

                        {isExpanded && (
                          <Box>
                            {folderFeeds.map((feed) => (
                              <FeedRow
                                key={feed.id}
                                feed={feed}
                                isSelected={isFeedSelected(selection, feed.id)}
                                onSelect={(feedId) =>
                                  handleSelect({ kind: "feed", feedId })
                                }
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

                  const feed = ungroupedFeeds.find(
                    (entry) => entry.id === item.id,
                  );
                  if (!feed) return null;

                  return (
                    <FeedRow
                      key={`feed-${feed.id}`}
                      feed={feed}
                      isSelected={isFeedSelected(selection, feed.id)}
                      onSelect={(feedId) =>
                        handleSelect({ kind: "feed", feedId })
                      }
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
            <Flex direction='column' width='100%' gap={2}>
              <Flex alignItems='center' justifyContent='space-between'>
                <Link href='/settings' onClick={onClose}>
                  <Flex alignItems='center' gap={2} position='relative'>
                    <IconButton aria-label='Settings' size='sm' variant='ghost'>
                      <LuSettings />
                    </IconButton>
                    <Text fontSize='sm' color='fg.muted'>
                      Settings
                    </Text>
                    {hasNewCategories && (
                      <Box
                        position='absolute'
                        top='4px'
                        left='28px'
                        width='8px'
                        height='8px'
                        borderRadius='full'
                        bg='accent.solid'
                        pointerEvents='none'
                      />
                    )}
                  </Flex>
                </Link>
                <ThemeToggle colorPalette='accent' />
              </Flex>

              <Flex direction='column' gap={2}>
                <Button
                  variant='outline'
                  width='100%'
                  onClick={onAddFolderClick}
                  colorPalette='accent'
                >
                  <LuFolderPlus /> Create folder
                </Button>
                <Button
                  width='100%'
                  onClick={onAddFeedClick}
                  colorPalette='accent'
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
