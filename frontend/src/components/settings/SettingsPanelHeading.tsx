"use client";

import { Text } from "@chakra-ui/react";

export function SettingsPanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="lg" fontWeight="semibold" mb={4}>
      {children}
    </Text>
  );
}
