"use client";

import { Box, Button, Flex, Text } from "@chakra-ui/react";
import type { PullProgress } from "@/hooks/useModelPull";

interface ModelPullProgressProps {
  progress: PullProgress;
  onCancel: () => void;
  /** Compact variant: thin bar + percentage only, no cancel/speed/status */
  compact?: boolean;
}

export function ModelPullProgress({
  progress,
  onCancel,
  compact,
}: ModelPullProgressProps) {
  if (compact) {
    return (
      <Box width="100%">
        <Box
          height="4px"
          bg="bg.subtle"
          borderRadius="full"
          overflow="hidden"
          mb={0.5}
        >
          <Box
            height="100%"
            bg="accent.solid"
            borderRadius="full"
            width={`${progress.percentage}%`}
            transition="width 0.3s ease"
          />
        </Box>
        <Text fontSize="xs" color="fg.muted">
          Downloading... {progress.percentage}%
        </Text>
      </Box>
    );
  }

  return (
    <Box width="100%">
      {/* Progress bar */}
      <Box
        height="6px"
        bg="bg.subtle"
        borderRadius="full"
        overflow="hidden"
        mb={1.5}
      >
        <Box
          height="100%"
          bg="accent.solid"
          borderRadius="full"
          width={`${progress.percentage}%`}
          transition="width 0.3s ease"
        />
      </Box>

      {/* Status line + cancel */}
      <Flex justifyContent="space-between" alignItems="center">
        <Text fontSize="xs" color="fg.muted">
          {progress.percentage}%
          {progress.speed && ` \u2022 ${progress.speed}`}
          {progress.status && ` \u2022 ${progress.status}`}
        </Text>
        <Button size="xs" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </Flex>
    </Box>
  );
}
