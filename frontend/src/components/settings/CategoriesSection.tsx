"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Accordion,
  Badge,
  Box,
  Flex,
  Stack,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import {
  DragDropContext,
  Droppable,
  type DropResult,
  type DragStart,
} from "@hello-pangea/dnd";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";
import { usePreferences } from "@/hooks/usePreferences";
import {
  updateCategoryWeight as apiUpdateCategoryWeight,
  updatePreferences as apiUpdatePreferences,
} from "@/lib/api";
import { toaster } from "@/components/ui/toaster";
import { CategoryGroupAccordion } from "./CategoryGroupAccordion";
import { CategoryRow } from "./CategoryRow";
import { GroupNamePopover } from "./GroupNamePopover";
import { DeleteGroupDialog } from "./DeleteGroupDialog";
import type { CategoryGroups, CategoryGroup } from "@/lib/types";

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
  activeId,
  sourceContainer,
}: {
  items: string[];
  children: React.ReactNode;
  activeId: string | null;
  sourceContainer: string | null;
}) {
  return (
    <Droppable droppableId="ungrouped" type="CATEGORY">
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          {...provided.droppableProps}
          bg={snapshot.isDraggingOver ? "bg.muted" : undefined}
          borderRadius="sm"
          transition="background 0.15s"
          p={snapshot.isDraggingOver ? 1 : 0}
        >
          {children}
          {provided.placeholder}
          {snapshot.isDraggingOver &&
            activeId &&
            sourceContainer !== "ungrouped" &&
            !items.includes(activeId) && (
            <Box
              p={2}
              mt={1}
              bg="bg.muted"
              borderRadius="sm"
              borderWidth="1px"
              borderStyle="dashed"
              borderColor="border.subtle"
              opacity={0.5}
            >
              <Text fontSize="sm" color="fg.muted">
                {toTitleCase(activeId)}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Droppable>
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
  const [sourceContainer, setSourceContainer] = useState<string | null>(null);
  const isDragActive = activeId !== null;

  // Checkbox selection for ungrouped categories
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );

  // Delete group dialog state
  const [deletingGroup, setDeletingGroup] = useState<CategoryGroup | null>(
    null
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
  const handleDragStart = useCallback(
    (start: DragStart) => {
      const draggedCategory = start.draggableId;
      setActiveId(draggedCategory);
      setSourceContainer(findContainer(draggedCategory));
    },
    [findContainer]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setActiveId(null);
      setSourceContainer(null);

      const { source, destination, draggableId } = result;
      if (!destination || !categoryGroups) return;

      const sourceContainerId = source.droppableId;
      const destContainerId = destination.droppableId;

      if (sourceContainerId === destContainerId) return;

      // Build updated groups
      const updatedGroups = categoryGroups.groups.map((g) => {
        let cats = [...g.categories];

        if (g.id === sourceContainerId) {
          cats = cats.filter((c) => c !== draggableId);
        }

        if (g.id === destContainerId) {
          if (!cats.includes(draggableId)) {
            cats.push(draggableId);
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
    [categoryGroups, saveGroups]
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

  // Group CRUD handlers
  const handleCreateGroup = useCallback(
    (name: string) => {
      if (!categoryGroups) return;

      const newGroup: CategoryGroup = {
        id: crypto.randomUUID(),
        name,
        weight: "normal",
        categories: Array.from(selectedCategories),
      };

      // Add selected categories to seen_categories to dismiss "New" badges
      const seenSet = new Set(categoryGroups.seen_categories ?? []);
      for (const cat of selectedCategories) {
        seenSet.add(cat);
      }

      const updated: CategoryGroups = {
        ...categoryGroups,
        groups: [...categoryGroups.groups, newGroup].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
        seen_categories: Array.from(seenSet),
      };

      saveGroups(updated);
      setSelectedCategories(new Set());
      toaster.create({
        title: `Created group "${name}"`,
        type: "success",
      });
    },
    [categoryGroups, selectedCategories, saveGroups]
  );

  const handleRenameGroup = useCallback(
    (groupId: string, newName: string) => {
      if (!categoryGroups) return;

      const updated: CategoryGroups = {
        ...categoryGroups,
        groups: categoryGroups.groups
          .map((g) => (g.id === groupId ? { ...g, name: newName } : g))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };

      saveGroups(updated);
    },
    [categoryGroups, saveGroups]
  );

  const handleDeleteGroupRequest = useCallback(
    (groupId: string) => {
      const group = categoryGroups?.groups.find((g) => g.id === groupId);
      if (group) {
        setDeletingGroup(group);
      }
    },
    [categoryGroups]
  );

  const handleDeleteGroupConfirm = useCallback(() => {
    if (!categoryGroups || !deletingGroup) return;

    const updated: CategoryGroups = {
      ...categoryGroups,
      groups: categoryGroups.groups.filter((g) => g.id !== deletingGroup.id),
    };

    saveGroups(updated);
    toaster.create({
      title: `Deleted group "${deletingGroup.name}"`,
      type: "success",
    });
    setDeletingGroup(null);
  }, [categoryGroups, deletingGroup, saveGroups]);

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
  const existingGroupNames = sortedGroups.map((g) => g.name);

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
        <GroupNamePopover
          selectedCount={selectedCategories.size}
          onCreateGroup={handleCreateGroup}
          isDisabled={selectedCategories.size === 0}
          existingNames={existingGroupNames}
        />
      </Flex>

      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                  onRenameGroup={handleRenameGroup}
                  onDeleteGroup={handleDeleteGroupRequest}
                  newCategories={newCategories}
                  returnedCategories={returnedCategories}
                  isDragActive={isDragActive}
                  activeId={activeId}
                  sourceContainer={sourceContainer}
                />
              ))}
            </Accordion.Root>
          </Box>
        )}

        {/* Ungrouped categories — always visible during drag so items can be moved out of groups */}
        {(ungroupedCategories.length > 0 || isDragActive) && (
          <UngroupedDroppable
            items={ungroupedCategories}
            activeId={activeId}
            sourceContainer={sourceContainer}
          >
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              Ungrouped
            </Text>
            {ungroupedCategories.length > 0 && (
              <Stack gap={1}>
                {ungroupedCategories.map((category, index) => {
                  const weight =
                    preferences?.topic_weights?.[category] || "normal";
                  return (
                    <CategoryRow
                      key={category}
                      category={category}
                      index={index}
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
            )}
          </UngroupedDroppable>
        )}
      </DragDropContext>

      {/* Delete group confirmation dialog */}
      <DeleteGroupDialog
        groupName={deletingGroup?.name ?? null}
        categoryCount={deletingGroup?.categories.length ?? 0}
        onConfirm={handleDeleteGroupConfirm}
        onCancel={() => setDeletingGroup(null)}
      />
    </Stack>
  );
}
