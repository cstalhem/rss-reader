"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Stack, Flex, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useQuery } from "@tanstack/react-query";
import { LuDownload } from "react-icons/lu";
import { fetchDownloadStatus, fetchNewCategoryCount } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { NEW_COUNT_POLL_INTERVAL, SETTINGS_SECTIONS } from "@/lib/constants";
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
    <Stack as="nav" gap={1}>
      {SETTINGS_SECTIONS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        const showDownloadIndicator = item.id === "ollama" && isDownloadActive;
        const showCategoryBadge = item.id === "categories" && categoryBadgeCount > 0;

        return (
          <Link key={item.id} href={item.href} style={{ textDecoration: "none" }}>
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
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    truncate
                  >
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
                  css={{ animation: `${pulse} 2s ease-in-out infinite` }}
                >
                  <Box color="accent.solid" display="inline-flex"><LuDownload size={16} /></Box>
                </Box>
              )}
            </Flex>
          </Link>
        );
      })}
    </Stack>
  );
}
