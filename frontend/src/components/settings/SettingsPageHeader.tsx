"use client";

import type { ReactNode } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";

interface SettingsPageHeaderProps {
  title: string;
  titleBadge?: ReactNode;
  children?: ReactNode;
}

export function SettingsPageHeader({
  title,
  titleBadge,
  children,
}: SettingsPageHeaderProps) {
  return (
    <Flex alignItems="center" gap={2}>
      <Text fontSize="xl" fontWeight="semibold">
        {title}
      </Text>
      {titleBadge}
      {children && <Box flex={1} />}
      {children}
    </Flex>
  );
}
