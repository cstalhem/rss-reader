"use client";

import { useCallback, useMemo } from "react";
import {
  Accordion,
  Badge,
  Box,
  Button,
  Flex,
  Stack,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";
import { usePreferences } from "@/hooks/usePreferences";
import {
  updateCategoryWeight as apiUpdateCategoryWeight,
  updatePreferences as apiUpdatePreferences,
} from "@/lib/api";
import { CategoryGroupAccordion } from "./CategoryGroupAccordion";
import { CategoryRow } from "./CategoryRow";
import type { CategoryGroups } from "@/lib/types";

export function CategoriesSection() {
  const {
    categoryGroups,
    allCategories,
    newCount,
    returnedCount,
    isLoading,
    saveGroups,
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

  // Compute ungrouped categories: not in any group, not hidden
  const ungroupedCategories = useMemo(() => {
    if (!categoryGroups) return allCategories;
    const grouped = new Set(
      categoryGroups.groups.flatMap((g) => g.categories)
    );
    const hidden = new Set(categoryGroups.hidden_categories ?? []);
    return allCategories
      .filter((c) => !grouped.has(c) && !hidden.has(c))
      .sort();
  }, [categoryGroups, allCategories]);

  const sortedGroups = useMemo(() => {
    if (!categoryGroups) return [];
    return [...categoryGroups.groups].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [categoryGroups]);

  const handleGroupWeightChange = useCallback(
    (groupId: string, weight: string) => {
      if (!categoryGroups) return;
      const updated: CategoryGroups = {
        ...categoryGroups,
        groups: categoryGroups.groups.map((g) =>
          g.id === groupId ? { ...g, weight } : g
        ),
      };
      saveGroups(updated);
      // Dismiss new/returned badges for all categories in this group
      const group = categoryGroups.groups.find((g) => g.id === groupId);
      if (group) {
        const toAcknowledge = group.categories.filter(
          (c) => newCategories.has(c) || returnedCategories.has(c)
        );
        if (toAcknowledge.length > 0) {
          acknowledge(toAcknowledge);
        }
      }
    },
    [categoryGroups, saveGroups, newCategories, returnedCategories, acknowledge]
  );

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
      {/* Panel header */}
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
        <Button size="sm" variant="outline" disabled>
          Group selected
        </Button>
      </Flex>

      {/* Accordion groups */}
      {sortedGroups.length > 0 && (
        <Box
          bg="bg.subtle"
          borderRadius="md"
          borderWidth="1px"
          borderColor="border.subtle"
        >
          <Accordion.Root multiple collapsible>
            {sortedGroups.map((group) => (
              <CategoryGroupAccordion
                key={group.id}
                group={group}
                topicWeights={preferences?.topic_weights ?? null}
                onGroupWeightChange={handleGroupWeightChange}
                onCategoryWeightChange={handleCategoryWeightChange}
                onResetCategoryWeight={handleResetCategoryWeight}
                onHideCategory={handleHideCategory}
                onBadgeDismiss={handleBadgeDismiss}
                newCategories={newCategories}
                returnedCategories={returnedCategories}
              />
            ))}
          </Accordion.Root>
        </Box>
      )}

      {/* Ungrouped categories */}
      {ungroupedCategories.length > 0 && (
        <Box>
          <Text
            fontSize="sm"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            mb={3}
          >
            Ungrouped
          </Text>
          <Stack gap={1}>
            {ungroupedCategories.map((category) => {
              const weight =
                preferences?.topic_weights?.[category] || "normal";
              return (
                <CategoryRow
                  key={category}
                  category={category}
                  weight={weight}
                  isNew={newCategories.has(category)}
                  isReturned={returnedCategories.has(category)}
                  onWeightChange={(w) =>
                    handleCategoryWeightChange(category, w)
                  }
                  onHide={() => handleHideCategory(category)}
                  onBadgeDismiss={() => handleBadgeDismiss(category)}
                />
              );
            })}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
