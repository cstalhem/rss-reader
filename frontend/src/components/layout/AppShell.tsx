"use client";

import { useMemo, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { AddFeedDialog } from "@/components/feed/AddFeedDialog";
import { CreateFolderDialog } from "@/components/feed/CreateFolderDialog";
import { ArticleList } from "@/components/article/ArticleList";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useFeeds } from "@/hooks/useFeeds";
import { useFeedFolders } from "@/hooks/useFeedFolders";
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "@/lib/constants";
import { ALL_FEEDS_SELECTION, FeedSelection } from "@/lib/types";
import {
  FEED_SELECTION_STORAGE_KEY,
  validateFeedSelection,
} from "./feedSelection";

export default function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage(
    "sidebar-collapsed",
    false
  );
  const [storedSelection, setStoredSelection] = useLocalStorage<FeedSelection>(
    FEED_SELECTION_STORAGE_KEY,
    ALL_FEEDS_SELECTION
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const { data: feeds } = useFeeds();
  const { data: folders } = useFeedFolders();

  const selection = useMemo(
    () => validateFeedSelection(storedSelection, feeds, folders),
    [storedSelection, feeds, folders]
  );

  const handleSelect = (nextSelection: FeedSelection) => {
    setStoredSelection(nextSelection);
  };

  return (
    <Box minHeight="100vh" bg="bg">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        selection={selection}
        onSelect={handleSelect}
        onAddFeedClick={() => setIsAddDialogOpen(true)}
        onAddFolderClick={() => setIsCreateFolderDialogOpen(true)}
      />
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        selection={selection}
        onSelect={handleSelect}
        onAddFeedClick={() => {
          setIsAddDialogOpen(true);
          setIsMobileSidebarOpen(false);
        }}
        onAddFolderClick={() => {
          setIsCreateFolderDialogOpen(true);
          setIsMobileSidebarOpen(false);
        }}
      />
      <Box
        ref={mainRef}
        as="main"
        ml={{ base: 0, md: isSidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
        height="100vh"
        overflowY="auto"
        transition="margin-left 0.2s ease"
      >
        <ArticleList
          selection={selection}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          mainRef={mainRef}
        />
      </Box>
      <AddFeedDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />
      <CreateFolderDialog
        isOpen={isCreateFolderDialogOpen}
        onClose={() => setIsCreateFolderDialogOpen(false)}
      />
    </Box>
  );
}
