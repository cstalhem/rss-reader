"use client";

import { Box, type BoxProps } from "@chakra-ui/react";

interface SettingsPanelProps extends BoxProps {
  children: React.ReactNode;
}

export function SettingsPanel({ children, ...rest }: SettingsPanelProps) {
  return (
    <Box
      bg="bg.subtle"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border.subtle"
      p={6}
      {...rest}
    >
      {children}
    </Box>
  );
}
