"use client"

import { useState } from "react"
import { Box } from "@chakra-ui/react"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <Box minHeight="100vh" bg="bg">
      <Header />
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <Box
        as="main"
        ml={{ base: 0, md: isSidebarCollapsed ? "48px" : "240px" }}
        pt="64px"
        minHeight="100vh"
        overflowY="auto"
        transition="margin-left 0.2s ease"
      >
        {children}
      </Box>
    </Box>
  )
}
