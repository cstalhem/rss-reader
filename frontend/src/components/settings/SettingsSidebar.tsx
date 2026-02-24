"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useQuery } from "@tanstack/react-query";
import { LuArrowLeft, LuDownload } from "react-icons/lu";
import { ThemeToggle } from "@/components/ui/color-mode";
import { fetchDownloadStatus, fetchNewCategoryCount } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  NEW_COUNT_POLL_INTERVAL,
  SETTINGS_SECTIONS,
  SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/constants";
import { DownloadStatus } from "@/lib/types";

const SIDEBAR_DOWNLOAD_POLL_INTERVAL = 3_000;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

export function SettingsSidebar() {
  const pathname = usePathname();

  const { data: downloadStatus } = useQuery<DownloadStatus>({
    queryKey: queryKeys.ollama.downloadStatus,
    queryFn: fetchDownloadStatus,
    refetchInterval: SIDEBAR_DOWNLOAD_POLL_INTERVAL,
  });

  const { data: newCategoryCount } = useQuery({
    queryKey: queryKeys.categories.newCount,
    queryFn: fetchNewCategoryCount,
    refetchInterval: NEW_COUNT_POLL_INTERVAL,
  });

  const isDownloadActive = downloadStatus?.active ?? false;
  const downloadModel = downloadStatus?.model ?? null;
  const downloadPct =
    isDownloadActive && downloadStatus && downloadStatus.total > 0
      ? Math.round((downloadStatus.completed / downloadStatus.total) * 100)
      : null;
  const categoryBadgeCount = newCategoryCount?.count ?? 0;

  return (
    <Box
      as="aside"
      position="fixed"
      top="0"
      left={0}
      bottom={0}
      width={SIDEBAR_WIDTH_EXPANDED}
      bg="bg.subtle"
      borderRightWidth="1px"
      borderRightColor="border.subtle"
      display={{ base: "none", md: "block" }}
      zIndex={5}
    >
      <Flex direction="column" height="100%">
        {/* Top zone: brand + back link */}
        <Box>
          <Flex
            alignItems="center"
            px={4}
            py={3}
            borderBottomWidth="1px"
            borderBottomColor="border.subtle"
            minHeight="48px"
          >
            <Link href="/">
              <Heading size="md" fontWeight="semibold">
                RSS Reader
              </Heading>
            </Link>
          </Flex>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Flex
              alignItems="center"
              gap={2}
              px={4}
              py={2}
              color="fg.muted"
              fontSize="sm"
              _hover={{ color: "fg.default" }}
            >
              <LuArrowLeft size={14} />
              <Text>Back to reader</Text>
            </Flex>
          </Link>
        </Box>

        {/* Middle zone: nav items */}
        <Box flex={1} overflowY="auto" py={2} px={2}>
          <Stack as="nav" gap={1}>
            {SETTINGS_SECTIONS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const showDownloadIndicator =
                item.id === "llm-providers" && isDownloadActive;
              const showCategoryBadge =
                item.id === "categories" && categoryBadgeCount > 0;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{ textDecoration: "none" }}
                >
                  <Flex
                    alignItems="center"
                    gap={3}
                    px={4}
                    py={2.5}
                    borderRadius="md"
                    cursor="pointer"
                    bg={isActive ? "bg.muted" : "transparent"}
                    color={isActive ? "fg.default" : "fg.muted"}
                    borderLeftWidth="3px"
                    borderLeftColor={isActive ? "accent.solid" : "transparent"}
                    _hover={{ bg: isActive ? "bg.muted" : "bg.subtle" }}
                    position="relative"
                  >
                    <Icon size={18} />
                    <Box flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="medium">
                        {item.label}
                      </Text>
                      {showDownloadIndicator && downloadModel && (
                        <Text fontSize="xs" color="fg.muted" truncate>
                          {downloadModel}
                          {downloadPct != null && ` ${downloadPct}%`}
                        </Text>
                      )}
                    </Box>
                    {showCategoryBadge && (
                      <Box
                        ml="auto"
                        bg="accent.solid"
                        color="accent.contrast"
                        fontSize="xs"
                        fontWeight="bold"
                        px={1.5}
                        py={0}
                        borderRadius="full"
                        lineHeight="1.5"
                        minW="20px"
                        textAlign="center"
                      >
                        {categoryBadgeCount}
                      </Box>
                    )}
                    {showDownloadIndicator && (
                      <Box
                        ml={showCategoryBadge ? undefined : "auto"}
                        css={{
                          animation: `${pulse} 2s ease-in-out infinite`,
                        }}
                      >
                        <Box color="accent.solid" display="inline-flex">
                          <LuDownload size={16} />
                        </Box>
                      </Box>
                    )}
                  </Flex>
                </Link>
              );
            })}
          </Stack>
        </Box>

        {/* Bottom zone: theme toggle */}
        <Flex
          borderTopWidth="1px"
          borderTopColor="border.subtle"
          py={2}
          px={2}
        >
          <Flex alignItems="center" gap={3} px={2} py={0}>
            <ThemeToggle colorPalette="accent" />
            <Text fontSize="sm" color="fg.muted">
              Theme
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
}
