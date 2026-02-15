"use client";

import { Box, Flex, Heading, IconButton } from "@chakra-ui/react";
import { LuMenu, LuSettings } from "react-icons/lu";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/color-mode";
import { fetchNewCategoryCount } from "@/lib/api";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { data: newCatCount } = useQuery({
    queryKey: ["categories", "new-count"],
    queryFn: fetchNewCategoryCount,
    refetchInterval: 30000,
  });
  const hasNewCategories =
    (newCatCount?.count ?? 0) + (newCatCount?.returned_count ?? 0) > 0;

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
          <Link href="/">
            <Heading size="lg" fontWeight="semibold">
              RSS Reader
            </Heading>
          </Link>
        </Flex>
        <Flex alignItems="center" gap={1}>
          <Box position="relative">
            <Link href="/settings">
              <IconButton aria-label="Settings" size="sm" variant="ghost">
                <LuSettings />
              </IconButton>
            </Link>
            {hasNewCategories && (
              <Box
                position="absolute"
                top="4px"
                right="4px"
                width="8px"
                height="8px"
                borderRadius="full"
                bg="accent.solid"
                pointerEvents="none"
              />
            )}
          </Box>
          <ThemeToggle colorPalette="accent" />
        </Flex>
      </Flex>
    </Box>
  );
}
