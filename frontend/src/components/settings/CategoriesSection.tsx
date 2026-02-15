"use client";

import { Box, Flex, Stack, Text, Skeleton } from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import { useCategories } from "@/hooks/useCategories";

export function CategoriesSection() {
  const { allCategories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <Stack gap={4}>
        <Skeleton height="200px" variant="shine" />
      </Stack>
    );
  }

  return (
    <Stack gap={8}>
      <Box>
        <Text fontSize="xl" fontWeight="semibold" mb={2}>
          Topic Categories
        </Text>
        <Text color="fg.muted" mb={6}>
          Organize categories into groups and set weights to tune your article scores
        </Text>

        {allCategories.length === 0 ? (
          <Flex
            direction="column"
            alignItems="center"
            justifyContent="center"
            gap={4}
            p={8}
            bg="bg.subtle"
            borderRadius="md"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            <LuTag size={40} color="var(--chakra-colors-fg-subtle)" />
            <Text color="fg.muted" textAlign="center">
              Categories will appear here once articles are scored by the LLM
            </Text>
          </Flex>
        ) : (
          <Text color="fg.muted">
            {allCategories.length} categories discovered. Full management UI coming in next plan.
          </Text>
        )}
      </Box>
    </Stack>
  );
}
