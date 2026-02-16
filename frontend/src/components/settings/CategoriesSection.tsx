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
        {isOver &&
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
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const draggedCategory = event.active.id as string;
      const source = findContainer(draggedCategory);
      setActiveId(draggedCategory);
      setSourceContainer(source);
    },
    [findContainer]
  );

  const handleDragOver = useCallback((_: DragOverEvent) => {
    // Visual feedback is handled by useDroppable isOver in each container.
    // The actual move happens on dragEnd.
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setSourceContainer(null);

      if (!over || !categoryGroups) return;

      const draggedCategory = active.id as string;
      const sourceContainer = findContainer(draggedCategory);

      // Determine destination container
      let destContainer: string;
      const overId = over.id as string;
      if (
        overId === "ungrouped" ||
        categoryGroups.groups.some((g) => g.id === overId)
      ) {
        destContainer = overId;
      } else {
        destContainer = findContainer(overId);
      }

      if (sourceContainer === destContainer) return;

      // Build updated groups
      const updatedGroups = categoryGroups.groups.map((g) => {
        let cats = [...g.categories];

        if (g.id === sourceContainer) {
          cats = cats.filter((c) => c !== draggedCategory);
        }

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
  const activeCategoryDisplay = activeId ? toTitleCase(activeId) : null;
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

        {/* Ungrouped categories */}
        {ungroupedCategories.length > 0 && (
          <Box>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              Ungrouped
            </Text>
            <UngroupedDroppable
              items={ungroupedCategories}
              activeId={activeId}
              sourceContainer={sourceContainer}
            >
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

        {/* Drag overlay */}
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
