"use client";

import { useState } from "react";
import { Box } from "@chakra-ui/react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { AddFeedDialog } from "@/components/feed/AddFeedDialog";
import { ArticleList } from "@/components/article/ArticleList";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { HEADER_HEIGHT, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "@/lib/constants";

export default function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage(
    "sidebar-collapsed",
    false
  );
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  return (
    <Box minHeight="100vh" bg="bg">
      <Header onMenuToggle={() => setIsMobileSidebarOpen(true)} />
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        selectedFeedId={selectedFeedId}
        onSelectFeed={setSelectedFeedId}
        onAddFeedClick={() => setIsAddDialogOpen(true)}
      />
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        selectedFeedId={selectedFeedId}
        onSelectFeed={setSelectedFeedId}
        onAddFeedClick={() => {
          setIsAddDialogOpen(true);
          setIsMobileSidebarOpen(false);
        }}
      />
      <Box
        as="main"
        ml={{ base: 0, md: isSidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
        pt={HEADER_HEIGHT}
        minHeight="100vh"
        overflowY="auto"
        transition="margin-left 0.2s ease"
      >
        <ArticleList selectedFeedId={selectedFeedId} />
      </Box>
      <AddFeedDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />
    </Box>
  );
}
