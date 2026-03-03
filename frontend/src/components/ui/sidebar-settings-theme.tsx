"use client";

import type { FlexProps } from "@chakra-ui/react";
import { Box, Flex, Text } from "@chakra-ui/react";
import Link from "next/link";
import { LuSettings } from "react-icons/lu";
import { ThemeModeSwitch } from "@/components/ui/theme-mode-switch";

interface SidebarSettingsThemeProps {
  isCollapsed?: boolean;
  showSettings?: boolean;
  hasNewCategories?: boolean;
  settingsHref?: string;
  containerPx?: FlexProps["px"];
  rowPx?: FlexProps["px"];
}

export function SidebarSettingsTheme({
  isCollapsed = false,
  showSettings = true,
  hasNewCategories = false,
  settingsHref = "/settings",
  containerPx = 2,
  rowPx = 2,
}: SidebarSettingsThemeProps) {
  return (
    <Flex direction="column" px={containerPx} gap={1}>
      {showSettings && (
        <Link href={settingsHref}>
          <Flex
            alignItems="center"
            justifyContent={isCollapsed ? "center" : "flex-start"}
            gap={3}
            px={isCollapsed ? 0 : rowPx}
            py={1.5}
            borderRadius="md"
            _hover={{ bg: "bg.muted" }}
            position="relative"
          >
            <Box position="relative">
              <LuSettings size={18} />
              {hasNewCategories && (
                <Box
                  position="absolute"
                  top="-2px"
                  right="-2px"
                  width="8px"
                  height="8px"
                  borderRadius="full"
                  bg="accent.solid"
                  pointerEvents="none"
                />
              )}
            </Box>
            {!isCollapsed && (
              <Text fontSize="sm" color="fg.muted">
                Settings
              </Text>
            )}
          </Flex>
        </Link>
      )}

      <Flex
        alignItems="center"
        justifyContent={isCollapsed ? "center" : "flex-start"}
        gap={3}
        px={isCollapsed ? 0 : rowPx}
        py={1.5}
      >
        <ThemeModeSwitch
          checked={true}
          disabled={true}
          showIcons={!isCollapsed}
          ariaLabel="Theme toggle (disabled)"
        />
      </Flex>
    </Flex>
  );
}
