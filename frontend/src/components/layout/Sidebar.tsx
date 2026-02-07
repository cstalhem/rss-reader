"use client"

import { Box, Flex, IconButton, Text } from "@chakra-ui/react"
import { LuChevronLeft, LuChevronRight } from "react-icons/lu"

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <Box
      as="aside"
      position="fixed"
      top="64px"
      left={0}
      bottom={0}
      width={isCollapsed ? "48px" : "240px"}
      bg="bg.subtle"
      borderRightWidth="1px"
      borderRightColor="border.subtle"
      transition="width 0.2s ease"
      display={{ base: "none", md: "block" }}
      zIndex={5}
    >
      <Flex direction="column" height="100%">
        {/* Collapse/Expand Toggle */}
        <Flex
          justifyContent={isCollapsed ? "center" : "flex-end"}
          p={2}
          borderBottomWidth="1px"
          borderBottomColor="border.subtle"
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

        {/* Sidebar Content */}
        {!isCollapsed && (
          <Box p={4}>
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted" mb={2}>
              Feeds
            </Text>
            <Text fontSize="sm" color="fg.muted">
              All Articles
            </Text>
          </Box>
        )}
      </Flex>
    </Box>
  )
}
