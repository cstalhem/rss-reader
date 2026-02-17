"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge, Box, Flex, Stack, Skeleton, Text, Input } from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { useCategories } from "@/hooks/useCategories";
import { usePreferences } from "@/hooks/usePreferences";
import {
  updateCategoryWeight as apiUpdateCategoryWeight,
  updatePreferences as apiUpdatePreferences,
} from "@/lib/api";
import { toaster } from "@/components/ui/toaster";
import { CategoryTree } from "./CategoryTree";
import { CreateCategoryPopover } from "./CreateCategoryPopover";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";

function toTitleCase(kebab: string): string {
  return kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function CategoriesSection() {
  const {
    categoryGroups,
    allCategories,
    newCount,
    returnedCount,
    isLoading,
    hideCategory,
    acknowledge,
    saveGroups,
    createCategory,
    deleteCategory,
    renameCategory,
  } = useCategories();
  const { preferences } = usePreferences();
  const queryClient = useQueryClient();

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isDndDisabled = searchQuery.length > 0;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Delete state
  const [deletingCategory, setDeletingCategory] = useState<{
    name: string;
    childCount: number;
    isParent: boolean;
  } | null>(null);

  const categoryWeightMutation = useMutation({
    mutationFn: ({ category, weight }: { category: string; weight: string }) =>
      apiUpdateCategoryWeight(category, weight),
    onMutate: async ({ category, weight }) => {
      await queryClient.cancelQueries({ queryKey: ["preferences"] });
      await queryClient.cancelQueries({ queryKey: ["categoryGroups"] });

      const previousPreferences = queryClient.getQueryData(["preferences"]);
      const previousCategoryGroups = queryClient.getQueryData(["categoryGroups"]);

      queryClient.setQueryData(["preferences"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          topic_weights: {
            ...old.topic_weights,
            [category]: weight,
          },
        };
      });

      return { previousPreferences, previousCategoryGroups };
    },
    onError: (err, _variables, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(["preferences"], context.previousPreferences);
      }
      if (context?.previousCategoryGroups) {
        queryClient.setQueryData(["categoryGroups"], context.previousCategoryGroups);
      }
      toaster.create({
        title: "Failed to update weight",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    },
    onSettled: () => {
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
    onMutate: async (category) => {
      await queryClient.cancelQueries({ queryKey: ["preferences"] });
      await queryClient.cancelQueries({ queryKey: ["categoryGroups"] });

      const previousPreferences = queryClient.getQueryData(["preferences"]);
      const previousCategoryGroups = queryClient.getQueryData(["categoryGroups"]);

      queryClient.setQueryData(["preferences"], (old: any) => {
        if (!old) return old;
        const newWeights = { ...old.topic_weights };
        delete newWeights[category];
        return { ...old, topic_weights: newWeights };
      });

      return { previousPreferences, previousCategoryGroups };
    },
    onError: (err, _variable, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(["preferences"], context.previousPreferences);
      }
      if (context?.previousCategoryGroups) {
        queryClient.setQueryData(["categoryGroups"], context.previousCategoryGroups);
      }
      toaster.create({
        title: "Failed to reset weight",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
      });
    },
    onSettled: () => {
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

  // Search filtering
  const { filteredChildren, filteredUngrouped } = useMemo(() => {
    if (!searchQuery) {
      return {
        filteredChildren: categoryGroups?.children ?? {},
        filteredUngrouped: ungroupedCategories,
      };
    }

    const query = searchQuery.toLowerCase();
    const children = categoryGroups?.children ?? {};
    const newFilteredChildren: Record<string, string[]> = {};

    // Filter parents: include parent if parent name matches OR any child name matches
    for (const [parent, childList] of Object.entries(children)) {
      const parentMatches = parent.toLowerCase().includes(query);
      const matchingChildren = childList.filter((c) =>
        c.toLowerCase().includes(query)
      );

      if (parentMatches) {
        // Parent matches — include all children
        newFilteredChildren[parent] = childList;
      } else if (matchingChildren.length > 0) {
        // Parent doesn't match but some children do — include only matching children
        newFilteredChildren[parent] = matchingChildren;
      }
      // If neither parent nor children match, exclude this parent entirely
    }

    // Filter ungrouped categories
    const newFilteredUngrouped = ungroupedCategories.filter((c) =>
      c.toLowerCase().includes(query)
    );

    return {
      filteredChildren: newFilteredChildren,
      filteredUngrouped: newFilteredUngrouped,
    };
  }, [searchQuery, categoryGroups, ungroupedCategories]);

  // Ungroup drop zone
  const { setNodeRef: setUngroupDropRef, isOver: isOverUngroup } = useDroppable({
    id: "ungroup-zone",
    disabled: isDndDisabled,
  });

  // DnD handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || !categoryGroups) return;

      const draggedCategory = active.id as string;
      const rawOverId = over.id as string;

      // Guard: prevent self-grouping
      if (draggedCategory === rawOverId) return;

      // Strip drop: prefix from CategoryChildRow droppable IDs
      const overId = rawOverId.startsWith("drop:") ? rawOverId.slice(5) : rawOverId;

      // Guard: still prevent self-grouping after prefix strip
      if (draggedCategory === overId) return;

      // Determine destination
      let destParent: string | null = null; // null = root level

      if (overId === "ungroup-zone" || overId === "root") {
        destParent = null;
      } else if (overId.startsWith("parent:")) {
        destParent = overId.replace("parent:", "");
      } else {
        // Dropped onto a category — check if it's a root-level ungrouped category
        // (which becomes a parent) or a parent that already has children
        const children = categoryGroups.children;
        if (overId in children) {
          // Dropped onto an existing parent
          destParent = overId;
        } else {
          // Check if it's an ungrouped root-level category
          const isChild = Object.values(children).flat().includes(overId);
          if (!isChild) {
            // It's a root-level ungrouped category — it becomes a parent
            destParent = overId;
          } else {
            // Dropped onto a child of a parent — invalid target, no-op
            return;
          }
        }
      }

      // Build updated children map
      const newChildren = { ...categoryGroups.children };

      // Remove dragged category from current parent (if it's a child)
      for (const [parent, childList] of Object.entries(newChildren)) {
        newChildren[parent] = childList.filter((c) => c !== draggedCategory);
      }

      // Only remove if it's being moved into another parent (not staying at root)
      if (destParent !== null && draggedCategory in newChildren) {
        // If draggedCategory is a parent (has children key), skip the drop
        if (
          newChildren[draggedCategory] &&
          newChildren[draggedCategory].length > 0
        ) {
          return; // Can't nest a parent with children under another parent
        }
        delete newChildren[draggedCategory];
      }

      if (destParent === null) {
        // Moving to root — already removed from parent above, nothing more to do
      } else {
        // Add to destination parent
        if (!newChildren[destParent]) {
          newChildren[destParent] = [];
        }
        if (!newChildren[destParent].includes(draggedCategory)) {
          newChildren[destParent].push(draggedCategory);
          newChildren[destParent].sort();
        }
      }

      saveGroups({
        ...categoryGroups,
        children: newChildren,
      });
    },
    [categoryGroups, saveGroups]
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

  const handleDeleteCategory = useCallback(
    (name: string) => {
      const children = categoryGroups?.children ?? {};
      const isParent = name in children;
      const childCount = isParent ? children[name].length : 0;
      setDeletingCategory({ name, childCount, isParent });
    },
    [categoryGroups]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (deletingCategory) {
      deleteCategory(deletingCategory.name);
      setDeletingCategory(null);
    }
  }, [deletingCategory, deleteCategory]);

  const handleRenameCategory = useCallback(
    (oldName: string, newName: string) => {
      renameCategory({ name: oldName, newName });
    },
    [renameCategory]
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
        <CreateCategoryPopover
          onCreateCategory={(name) => createCategory(name)}
          existingCategories={allCategories}
        />
      </Flex>

      {/* Search input */}
      <Input
        placeholder="Filter categories..."
        size="sm"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Category tree with DnD */}
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) =>
          !isDndDisabled && setActiveId(e.active.id as string)
        }
        onDragEnd={handleDragEnd}
      >
        <CategoryTree
          children={filteredChildren}
          ungroupedCategories={filteredUngrouped}
          topicWeights={preferences?.topic_weights ?? null}
          newCategories={newCategories}
          returnedCategories={returnedCategories}
          onWeightChange={handleCategoryWeightChange}
          onResetWeight={handleResetCategoryWeight}
          onHide={handleHideCategory}
          onBadgeDismiss={handleBadgeDismiss}
          isDndEnabled={!isDndDisabled}
          activeId={activeId}
          onRename={handleRenameCategory}
          onDelete={handleDeleteCategory}
        />

        {/* Explicit ungroup drop zone */}
        {activeId && (
          <Box
            ref={setUngroupDropRef}
            py={3}
            px={4}
            mt={2}
            borderWidth="2px"
            borderStyle="dashed"
            borderColor={isOverUngroup ? "accent.solid" : "border.subtle"}
            borderRadius="md"
            bg={isOverUngroup ? "accent.subtle" : "transparent"}
            textAlign="center"
            fontSize="sm"
            color="fg.muted"
            transition="all 0.2s"
          >
            Drop here to ungroup
          </Box>
        )}

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
              <Text fontSize="sm">{toTitleCase(activeId)}</Text>
            </Box>
          )}
        </DragOverlay>
      </DndContext>

      <DeleteCategoryDialog
        categoryName={deletingCategory?.name ?? null}
        childCount={deletingCategory?.childCount ?? 0}
        isParent={deletingCategory?.isParent ?? false}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingCategory(null)}
      />
    </Stack>
  );
}
