"use client";

import { useState, ReactNode } from "react";
import { Box } from "@chakra-ui/react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { AddFeedDialog } from "@/components/feed/AddFeedDialog";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface AppShellProps {
  children: ((selectedFeedId: number | null) => ReactNode) | ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
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
        ml={{ base: 0, md: isSidebarCollapsed ? "48px" : "240px" }}
        pt="64px"
        minHeight="100vh"
        overflowY="auto"
        transition="margin-left 0.2s ease"
      >
        {typeof children === "function" ? children(selectedFeedId) : children}
      </Box>
      <AddFeedDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      />
    </Box>
  );
}
