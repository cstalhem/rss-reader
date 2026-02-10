"use client";

import { Box, Text } from "@chakra-ui/react";

export function EmptyFeedState() {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="200px"
      p={4}
      textAlign="center"
    >
      <Text fontSize="sm" color="fg.muted">
        No feeds yet — tap + to add your first feed
      </Text>
    </Box>
  );
}
