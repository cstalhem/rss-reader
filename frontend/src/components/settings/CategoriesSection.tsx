"use client";

import { useCallback, useMemo, useState } from "react";
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
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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

function toTitleCase(kebab: string): string {
  return kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Droppable wrapper for the ungrouped categories list */
function UngroupedDroppable({
  items,
  children,
}: {
  items: string[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "ungrouped" });
  return (
    <Box
      ref={setNodeRef}
      bg={isOver ? "bg.muted" : undefined}
      borderRadius="sm"
      transition="background 0.15s"
      p={isOver ? 1 : 0}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </Box>
  );
}

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

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const isDragActive = activeId !== null;

  // Checkbox selection for ungrouped categories
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

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

  // Helper: find which container (group id or "ungrouped") a category belongs to
  const findContainer = useCallback(
    (categoryName: string): string => {
      if (!categoryGroups) return "ungrouped";
      for (const group of categoryGroups.groups) {
        if (group.categories.includes(categoryName)) return group.id;
      }
      return "ungrouped";
    },
    [categoryGroups]
  );

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

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Visual feedback is handled by useDroppable isOver in each container.
    // The actual move happens on dragEnd.
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || !categoryGroups) return;

      const draggedCategory = active.id as string;
      const sourceContainer = findContainer(draggedCategory);

      // Determine destination container:
      // If we're over a container droppable ID, use that. Otherwise find the container of the category we're over.
      let destContainer: string;
      const overId = over.id as string;
      if (
        overId === "ungrouped" ||
        categoryGroups.groups.some((g) => g.id === overId)
      ) {
        destContainer = overId;
      } else {
        // overId is a category name -- find its container
        destContainer = findContainer(overId);
      }

      if (sourceContainer === destContainer) return; // No cross-container move

      // Build updated groups
      const updatedGroups = categoryGroups.groups.map((g) => {
        let cats = [...g.categories];

        // Remove from source group
        if (g.id === sourceContainer) {
          cats = cats.filter((c) => c !== draggedCategory);
        }

        // Add to destination group
        if (g.id === destContainer) {
          if (!cats.includes(draggedCategory)) {
            cats.push(draggedCategory);
          }
        }

        return { ...g, categories: cats };
      });

      const updated: CategoryGroups = {
        ...categoryGroups,
        groups: updatedGroups,
      };

      saveGroups(updated);
    },
    [categoryGroups, findContainer, saveGroups]
  );

  // Checkbox handlers
  const handleCheckChange = useCallback(
    (category: string, checked: boolean) => {
      setSelectedCategories((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(category);
        } else {
          next.delete(category);
        }
        return next;
      });
    },
    []
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

  // Find the active category's display name for DragOverlay
  const activeCategoryDisplay = activeId ? toTitleCase(activeId) : null;

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
        <Button
          size="sm"
          variant="outline"
          disabled={selectedCategories.size === 0}
        >
          Group selected ({selectedCategories.size})
        </Button>
      </Flex>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
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
                  isDragActive={isDragActive}
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
            <UngroupedDroppable items={ungroupedCategories}>
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
                      showCheckbox
                      isChecked={selectedCategories.has(category)}
                      onCheckChange={(checked) =>
                        handleCheckChange(category, checked)
                      }
                    />
                  );
                })}
              </Stack>
            </UngroupedDroppable>
          </Box>
        )}

        {/* Drag overlay -- visual preview during drag */}
        <DragOverlay>
          {activeId && (
            <Box
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              borderRadius="sm"
              p={2}
              shadow="md"
            >
              <Text fontSize="sm">{activeCategoryDisplay}</Text>
            </Box>
          )}
        </DragOverlay>
      </DndContext>
    </Stack>
  );
}
