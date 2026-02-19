"use client";

import { Box, Flex, Text } from "@chakra-ui/react";
import { LuBot } from "react-icons/lu";

export function OllamaPlaceholder() {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      gap={4}
      py={16}
    >
      <Box color="fg.subtle"><LuBot size={40} /></Box>
      <Text fontSize="lg" fontWeight="semibold">
        Ollama Configuration
      </Text>
      <Text color="fg.muted" textAlign="center" maxW="md">
        Coming soon -- configure your Ollama models and connection settings
        here.
      </Text>
    </Flex>
  );
}
