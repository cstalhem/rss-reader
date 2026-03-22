"use client";

import {
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
  LuFolderPlus,
  LuPlus,
  LuSettings,
} from "react-icons/lu";
import Link from "next/link";
import { useSidebarData } from "@/hooks/useSidebarData";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import { ThemeToggle } from "@/components/ui/color-mode";
import {
  FeedSelection,
} from "@/lib/types";
import { FeedTree } from "./FeedTree";
import { SidebarDialogs } from "./SidebarDialogs";

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
              <FeedTree
                selection={selection}
                totalUnread={totalUnread}
                rootItems={rootItems}
                orderedFolders={orderedFolders}
                feedsByFolder={feedsByFolder}
                ungroupedFeeds={ungroupedFeeds}
                expandedFolders={expandedFolders}
                onSelect={handleSelect}
                onToggleFolderExpanded={toggleFolderExpanded}
                onDeleteFeed={setFeedToDelete}
                onMarkAllRead={handleMarkAllRead}
                onRenameFeed={handleRename}
                onMoveFeed={setFeedToMove}
                folderFeedPadding={4}
                showDesktopActions={false}
                enableSwipeActions={true}
              />
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

      <SidebarDialogs
        feedToDelete={feedToDelete}
        feedToMove={feedToMove}
        folders={orderedFolders}
        onCloseDelete={() => setFeedToDelete(null)}
        onConfirmDelete={handleDeleteConfirm}
        onOpenMoveChange={(open) => {
          if (!open) setFeedToMove(null);
        }}
        onMove={handleMoveFeed}
        onCreateAndMove={handleCreateFolderAndMove}
      />
    </Drawer.Root>
  );
}
