"use client";

import { Box, Flex, Heading, IconButton } from "@chakra-ui/react";
import { LuMenu } from "react-icons/lu";
import { ThemeToggle } from "@/components/ui/color-mode";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <Box
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      height="64px"
      bg="bg.panel"
      borderBottomWidth="1px"
      borderBottomColor="border.subtle"
      zIndex={10}
    >
      <Flex
        height="100%"
        alignItems="center"
        justifyContent="space-between"
        px={6}
      >
        <Flex alignItems="center" gap={3}>
          {onMenuToggle && (
            <IconButton
              aria-label="Open menu"
              onClick={onMenuToggle}
              size="sm"
              variant="ghost"
              display={{ base: "flex", md: "none" }}
            >
              <LuMenu />
            </IconButton>
          )}
          <Heading size="lg" fontWeight="semibold">
            RSS Reader
          </Heading>
        </Flex>
        <ThemeToggle colorPalette="accent" />
      </Flex>
    </Box>
  );
}
