"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { LuMessageSquare } from "react-icons/lu";

export function FeedbackPlaceholder() {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      gap={4}
      py={16}
    >
      <Box color="fg.subtle"><LuMessageSquare size={40} /></Box>
      <Text fontSize="lg" fontWeight="semibold">
        Feedback Loop
      </Text>
      <Text color="fg.muted" textAlign="center" maxW="md">
        Coming soon -- your feedback will help improve article scoring over
        time.
      </Text>
    </Flex>
  );
}
