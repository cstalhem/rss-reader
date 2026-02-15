"use client";

import { Box, Collapsible, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { LuChevronRight } from "react-icons/lu";
import { useQuery } from "@tanstack/react-query";
import { fetchOllamaPrompts } from "@/lib/api";

function PromptSection({ title, content }: { title: string; content: string }) {
  return (
    <Collapsible.Root>
      <Collapsible.Trigger asChild>
        <Flex
          alignItems="center"
          gap={2}
          cursor="pointer"
          py={2}
          _hover={{ color: "fg.default" }}
          color="fg.muted"
        >
          <Collapsible.Indicator>
            <LuChevronRight size={14} />
          </Collapsible.Indicator>
          <Text fontSize="sm" fontWeight="medium">
            {title}
          </Text>
        </Flex>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Box
          bg="bg.subtle"
          p={4}
          borderRadius="md"
          fontFamily="mono"
          fontSize="sm"
          whiteSpace="pre-wrap"
          color="fg.muted"
          maxH="300px"
          overflowY="auto"
        >
          {content}
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function SystemPrompts() {
  const { data: prompts, isLoading } = useQuery({
    queryKey: ["ollama-prompts"],
    queryFn: fetchOllamaPrompts,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Flex py={4} justifyContent="center">
        <Spinner size="sm" />
      </Flex>
    );
  }

  if (!prompts) return null;

  return (
    <Stack gap={1}>
      <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={1}>
        System Prompts
      </Text>
      <PromptSection
        title="Categorization Prompt"
        content={prompts.categorization_prompt}
      />
      <PromptSection
        title="Scoring Prompt"
        content={prompts.scoring_prompt}
      />
    </Stack>
  );
}
