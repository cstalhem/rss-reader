"use client";

import { Stack, Flex, Text } from "@chakra-ui/react";
import { LuRss, LuHeart, LuBot, LuMessageSquare } from "react-icons/lu";

export type SettingsSection = "feeds" | "interests" | "ollama" | "feedback";

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
  { id: "ollama", icon: LuBot, label: "Ollama" },
  { id: "feedback", icon: LuMessageSquare, label: "Feedback" },
];

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <Stack gap={1}>
      {SIDEBAR_ITEMS.map((item) => {
        const isActive = activeSection === item.id;
        const Icon = item.icon;

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
          </Flex>
        );
      })}
    </Stack>
  );
}
