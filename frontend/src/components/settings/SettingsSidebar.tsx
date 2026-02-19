"use client";

import { Box, Stack, Flex, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useQuery } from "@tanstack/react-query";
import { LuRss, LuHeart, LuTag, LuBot, LuMessageSquare, LuDownload } from "react-icons/lu";
import { fetchDownloadStatus, fetchNewCategoryCount } from "@/lib/api";
import { DownloadStatus } from "@/lib/types";

export type SettingsSection = "feeds" | "interests" | "categories" | "ollama" | "feedback";

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

interface SidebarItem {
  id: SettingsSection;
  icon: React.ElementType;
  label: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "feeds", icon: LuRss, label: "Feeds" },
  { id: "interests", icon: LuHeart, label: "Interests" },
  { id: "categories", icon: LuTag, label: "Categories" },
  { id: "ollama", icon: LuBot, label: "Ollama" },
  { id: "feedback", icon: LuMessageSquare, label: "Feedback" },
];

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  const { data: downloadStatus } = useQuery<DownloadStatus>({
    queryKey: ["sidebar-download-status"],
    queryFn: fetchDownloadStatus,
    refetchInterval: 3000,
  });

  const { data: newCategoryCount } = useQuery({
    queryKey: ["categories", "new-count"],
    queryFn: fetchNewCategoryCount,
    refetchInterval: 30000,
  });

  const isDownloadActive = downloadStatus?.active ?? false;
  const categoryBadgeCount = newCategoryCount?.count ?? 0;

  return (
    <Stack gap={1}>
      {SIDEBAR_ITEMS.map((item) => {
        const isActive = activeSection === item.id;
        const Icon = item.icon;
        const showDownloadIndicator = item.id === "ollama" && isDownloadActive;
        const showCategoryBadge = item.id === "categories" && categoryBadgeCount > 0;

        return (
          <Flex
            key={item.id}
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
            onClick={() => onSectionChange(item.id)}
          >
            <Icon size={18} />
            <Text fontSize="sm" fontWeight="medium">
              {item.label}
            </Text>
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
                ml="auto"
                css={{ animation: `${pulse} 2s ease-in-out infinite` }}
              >
                <LuDownload size={16} color="var(--chakra-colors-accent-solid)" />
              </Box>
            )}
          </Flex>
        );
      })}
    </Stack>
  );
}
