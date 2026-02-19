"use client";

import { Flex, Box, Text } from "@chakra-ui/react";
import type { OllamaHealth } from "@/lib/types";

interface OllamaHealthBadgeProps {
  health: OllamaHealth | undefined;
  isLoading: boolean;
}

export function OllamaHealthBadge({ health, isLoading }: OllamaHealthBadgeProps) {
  if (isLoading || !health) {
    return (
      <Flex alignItems="center" gap={2}>
        <Box w={2} h={2} borderRadius="full" bg="fg.subtle" />
        <Text fontSize="sm" color="fg.muted">
          Checking...
        </Text>
      </Flex>
    );
  }

  if (!health.connected) {
    return (
      <Flex alignItems="center" gap={2}>
        <Box w={2} h={2} borderRadius="full" bg="fg.error" />
        <Text fontSize="sm" color="fg.muted">
          Disconnected
        </Text>
      </Flex>
    );
  }

  return (
    <Flex alignItems="center" gap={2}>
      <Box w={2} h={2} borderRadius="full" bg="fg.success" />
      <Text fontSize="sm" color="fg.muted">
        Connected
        {health.latency_ms != null && ` \u00B7 ${health.latency_ms}ms`}
        {health.version && ` \u00B7 v${health.version}`}
      </Text>
    </Flex>
  );
}
