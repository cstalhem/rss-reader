"use client";

import { useCallback, useMemo } from "react";
import { Badge, Box, Flex, Stack, Skeleton, Text } from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";
import { usePreferences } from "@/hooks/usePreferences";
import {
  updateCategoryWeight as apiUpdateCategoryWeight,
  updatePreferences as apiUpdatePreferences,
} from "@/lib/api";
import { CategoryTree } from "./CategoryTree";

export function CategoriesSection() {
  const {
    categoryGroups,
    allCategories,
    newCount,
    returnedCount,
    isLoading,
    hideCategory,
    acknowledge,
  } = useCategories();
  const { preferences } = usePreferences();
  const queryClient = useQueryClient();

  const categoryWeightMutation = useMutation({
    mutationFn: ({ category, weight }: { category: string; weight: string }) =>
      apiUpdateCategoryWeight(category, weight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
    },
  });

  const resetWeightMutation = useMutation({
    mutationFn: (category: string) => {
      const currentWeights = { ...preferences?.topic_weights };
      delete currentWeights[category];
      return apiUpdatePreferences({ topic_weights: currentWeights });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
      queryClient.invalidateQueries({ queryKey: ["categoryGroups"] });
    },
  });

  // Compute new and returned category sets from categoryGroups data
  const newCategories = useMemo(() => {
    if (!categoryGroups) return new Set<string>();
    const seen = new Set(categoryGroups.seen_categories ?? []);
    const hidden = new Set(categoryGroups.hidden_categories ?? []);
    return new Set(
      allCategories.filter((c) => !seen.has(c) && !hidden.has(c))
    );
  }, [categoryGroups, allCategories]);

  const returnedCategories = useMemo(() => {
    if (!categoryGroups) return new Set<string>();
    return new Set(categoryGroups.returned_categories ?? []);
  }, [categoryGroups]);

  // Compute ungrouped categories: not in any parent-child relationship, not hidden
  const ungroupedCategories = useMemo(() => {
    if (!categoryGroups) return allCategories;
    const childSet = new Set(
      Object.values(categoryGroups.children).flat().map((c) => c.toLowerCase())
    );
    const parentSet = new Set(
      Object.keys(categoryGroups.children).map((c) => c.toLowerCase())
    );
    const hidden = new Set(
      (categoryGroups.hidden_categories ?? []).map((c) => c.toLowerCase())
    );
    return allCategories
      .filter((c) => {
        const lower = c.toLowerCase();
        return !childSet.has(lower) && !parentSet.has(lower) && !hidden.has(lower);
      })
      .sort();
  }, [categoryGroups, allCategories]);

  const handleCategoryWeightChange = useCallback(
    (category: string, weight: string) => {
      categoryWeightMutation.mutate({ category, weight });
      // Dismiss new/returned badge when weight is explicitly set
      if (newCategories.has(category) || returnedCategories.has(category)) {
        acknowledge([category]);
      }
    },
    [categoryWeightMutation, newCategories, returnedCategories, acknowledge]
  );

  const handleResetCategoryWeight = useCallback(
    (category: string) => {
      resetWeightMutation.mutate(category);
    },
    [resetWeightMutation]
  );

  const handleHideCategory = useCallback(
    (category: string) => {
      hideCategory(category);
    },
    [hideCategory]
  );

  const handleBadgeDismiss = useCallback(
    (category: string) => {
      acknowledge([category]);
    },
    [acknowledge]
  );

  if (isLoading) {
    return (
      <Stack gap={4}>
        <Skeleton height="200px" variant="shine" />
      </Stack>
    );
  }

  if (allCategories.length === 0) {
    return (
      <Stack gap={8}>
        <Box>
          <Text fontSize="xl" fontWeight="semibold" mb={2}>
            Topic Categories
          </Text>

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
        </Box>
      </Stack>
    );
  }

  const totalNew = newCount + returnedCount;

  return (
    <Stack gap={6}>
      {/* Header with title and new badge */}
      <Flex alignItems="center" gap={2}>
        <Text fontSize="xl" fontWeight="semibold">
          Topic Categories
        </Text>
        {totalNew > 0 && (
          <Badge colorPalette="accent" size="sm">
            {totalNew} new
          </Badge>
        )}
        <Box flex={1} />
        {/* Create category button placeholder — functional in Plan 04 */}
      </Flex>

      {/* Category tree */}
      <CategoryTree
        children={categoryGroups?.children ?? {}}
        ungroupedCategories={ungroupedCategories}
        topicWeights={preferences?.topic_weights ?? null}
        newCategories={newCategories}
        returnedCategories={returnedCategories}
        onWeightChange={handleCategoryWeightChange}
        onResetWeight={handleResetCategoryWeight}
        onHide={handleHideCategory}
        onBadgeDismiss={handleBadgeDismiss}
      />
    </Stack>
  );
}
