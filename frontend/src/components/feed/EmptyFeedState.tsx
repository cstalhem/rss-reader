"use client";

import { Flex, Text, Icon } from "@chakra-ui/react";
import { LuRss } from "react-icons/lu";

export function EmptyFeedState() {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      gap={3}
      minHeight="200px"
      p={4}
      textAlign="center"
    >
      <Icon as={LuRss} boxSize={10} color="fg.subtle" />
      <Text fontSize="md" color="fg.muted">
        No feeds yet
      </Text>
      <Text fontSize="sm" color="fg.subtle">
        Tap + above to add your first feed
      </Text>
    </Flex>
  );
}
