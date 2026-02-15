"use client";

import { Box, Flex, Skeleton } from "@chakra-ui/react";

export function ArticleRowSkeleton() {
  return (
    <Flex py={3} px={4} gap={3} borderBottom="1px solid" borderColor="border.subtle">
      {/* Read dot placeholder */}
      <Box flexShrink={0} alignSelf="center" px={2}>
        <Skeleton variant="shine" borderRadius="full" boxSize="10px" />
      </Box>
      {/* Content area */}
      <Flex flex={1} direction="column" gap={2}>
        <Skeleton variant="shine" height="18px" width="75%" />
        <Skeleton variant="shine" height="14px" width="45%" />
      </Flex>
      {/* Score badge placeholder */}
      <Skeleton variant="shine" height="22px" width="36px" borderRadius="md" alignSelf="center" />
    </Flex>
  );
}
