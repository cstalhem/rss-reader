"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge, Box, Flex, Stack, Skeleton, Text, Input } from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import { useCategories } from "@/hooks/useCategories";
import { Category } from "@/lib/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { CategoryTree } from "./CategoryTree";
import { CategoryActionBar } from "./CategoryActionBar";
import { CreateCategoryPopover } from "./CreateCategoryPopover";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";

export function CategoriesSection() {
  const {
    categories,
    newCount,
    isLoading,
    updateCategory,
    createCategory,
    deleteCategory,
    hideCategory,
    acknowledge,
    batchMove,
    batchHide,
    batchDelete,
    ungroupParent,
  } = useCategories();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Expand/collapse state persisted in localStorage
  const [expandedParents, setExpandedParents] = useLocalStorage<
    Record<number, boolean>
  >("category-expanded-parents", {});
  const toggleParent = useCallback(
    (parentId: number) => {
      setExpandedParents({
        ...expandedParents,
        [parentId]: !expandedParents[parentId],
      });
    },
    [expandedParents, setExpandedParents]
  );

  const [searchQuery, setSearchQuery] = useState("");

  // Delete state
  const [deletingCategory, setDeletingCategory] = useState<{
    id: number;
    displayName: string;
    childCount: number;
    isParent: boolean;
  } | null>(null);

  // Build tree from flat Category array
  const { parents, childrenMap, ungroupedCategories } = useMemo(() => {
    const cMap: Record<number, Category[]> = {};
    const parentIds = new Set<number>();

    // Group children by parent_id
    for (const cat of categories) {
      if (cat.parent_id !== null) {
        if (!cMap[cat.parent_id]) cMap[cat.parent_id] = [];
        cMap[cat.parent_id].push(cat);
        parentIds.add(cat.parent_id);
      }
    }

    // Parents: root-level categories that have children
    const parentCats = categories
      .filter((c) => c.parent_id === null && parentIds.has(c.id) && !c.is_hidden)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    // Ungrouped: root-level categories that have no children and are not hidden
    const ungrouped = categories
      .filter((c) => c.parent_id === null && !parentIds.has(c.id) && !c.is_hidden)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));

    // Sort children within each parent
    for (const parentId of Object.keys(cMap)) {
      cMap[Number(parentId)].sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    return { parents: parentCats, childrenMap: cMap, ungroupedCategories: ungrouped };
  }, [categories]);

  // New categories: unseen and not hidden
  const newCategoryIds = useMemo(() => {
    return new Set(
      categories
        .filter((c) => !c.is_seen && !c.is_hidden)
        .map((c) => c.id)
    );
  }, [categories]);

  // Search filtering
  const { filteredParents, filteredChildrenMap, filteredUngrouped } = useMemo(() => {
    if (!searchQuery) {
      return {
        filteredParents: parents,
        filteredChildrenMap: childrenMap,
        filteredUngrouped: ungroupedCategories,
      };
    }

    const query = searchQuery.toLowerCase();
    const newParents: Category[] = [];
    const newChildrenMap: Record<number, Category[]> = {};

    for (const parent of parents) {
      const parentMatches = parent.display_name.toLowerCase().includes(query);
      const children = childrenMap[parent.id] ?? [];
      const matchingChildren = children.filter((c) =>
        c.display_name.toLowerCase().includes(query)
      );

      if (parentMatches) {
        newParents.push(parent);
        newChildrenMap[parent.id] = children;
      } else if (matchingChildren.length > 0) {
        newParents.push(parent);
        newChildrenMap[parent.id] = matchingChildren;
      }
    }

    const newUngrouped = ungroupedCategories.filter((c) =>
      c.display_name.toLowerCase().includes(query)
    );

    return {
      filteredParents: newParents,
      filteredChildrenMap: newChildrenMap,
      filteredUngrouped: newUngrouped,
    };
  }, [searchQuery, parents, childrenMap, ungroupedCategories]);

  const handleWeightChange = useCallback(
    (categoryId: number, weight: string) => {
      updateCategory(categoryId, { weight });
    },
    [updateCategory]
  );

  const handleResetWeight = useCallback(
    (categoryId: number) => {
      // Send "inherit" to clear explicit weight (backend convention)
      updateCategory(categoryId, { weight: "inherit" as string | null });
    },
    [updateCategory]
  );

  const handleHideCategory = useCallback(
    (categoryId: number) => {
      hideCategory(categoryId);
    },
    [hideCategory]
  );

  const handleBadgeDismiss = useCallback(
    (categoryId: number) => {
      acknowledge([categoryId]);
    },
    [acknowledge]
  );

  const handleDeleteCategory = useCallback(
    (categoryId: number) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const children = childrenMap[categoryId] ?? [];
      const isParent = children.length > 0;
      setDeletingCategory({
        id: categoryId,
        displayName: cat.display_name,
        childCount: children.length,
        isParent,
      });
    },
    [categories, childrenMap]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (deletingCategory) {
      deleteCategory(deletingCategory.id);
      setDeletingCategory(null);
    }
  }, [deletingCategory, deleteCategory]);

  const handleRenameCategory = useCallback(
    (categoryId: number, newName: string) => {
      updateCategory(categoryId, { display_name: newName });
    },
    [updateCategory]
  );

  const handleUngroupParent = useCallback(
    (categoryId: number) => {
      ungroupParent(categoryId);
    },
    [ungroupParent]
  );

  const handleActionMoveToGroup = useCallback(() => {
    // Placeholder — will be implemented in Plan 04
    console.log("Move to group", Array.from(selectedIds));
  }, [selectedIds]);

  const handleActionUngroup = useCallback(() => {
    batchMove(Array.from(selectedIds), -1);
    clearSelection();
  }, [selectedIds, batchMove, clearSelection]);

  const handleActionHide = useCallback(() => {
    batchHide(Array.from(selectedIds));
    clearSelection();
  }, [selectedIds, batchHide, clearSelection]);

  const handleActionDelete = useCallback(() => {
    batchDelete(Array.from(selectedIds));
    clearSelection();
  }, [selectedIds, batchDelete, clearSelection]);

  if (isLoading) {
    return (
      <Stack gap={4}>
        <Skeleton height="200px" variant="shine" />
      </Stack>
    );
  }

  if (categories.length === 0) {
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

  return (
    <Stack gap={6}>
      {/* Header with title and new badge */}
      <Flex alignItems="center" gap={2}>
        <Text fontSize="xl" fontWeight="semibold">
          Topic Categories
        </Text>
        {newCount > 0 && (
          <Badge colorPalette="accent" size="sm">
            {newCount} new
          </Badge>
        )}
        <Box flex={1} />
        <CreateCategoryPopover
          onCreateCategory={(displayName) => createCategory(displayName)}
          existingCategories={categories}
        />
      </Flex>

      {/* Action bar */}
      <CategoryActionBar
        selectedCount={selectedIds.size}
        onMoveToGroup={handleActionMoveToGroup}
        onUngroup={handleActionUngroup}
        onHide={handleActionHide}
        onDelete={handleActionDelete}
      />

      {/* Search input */}
      <Input
        placeholder="Filter categories..."
        size="sm"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* Category tree */}
      <CategoryTree
        parents={filteredParents}
        childrenMap={filteredChildrenMap}
        ungroupedCategories={filteredUngrouped}
        newCategoryIds={newCategoryIds}
        onWeightChange={handleWeightChange}
        onResetWeight={handleResetWeight}
        onHide={handleHideCategory}
        onBadgeDismiss={handleBadgeDismiss}
        onRename={handleRenameCategory}
        onDelete={handleDeleteCategory}
        onUngroup={handleUngroupParent}
        selectedIds={selectedIds}
        onToggleSelection={toggleSelection}
        expandedParents={expandedParents}
        onToggleParent={toggleParent}
      />

      <DeleteCategoryDialog
        categoryName={deletingCategory?.displayName ?? null}
        childCount={deletingCategory?.childCount ?? 0}
        isParent={deletingCategory?.isParent ?? false}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingCategory(null)}
      />
    </Stack>
  );
}
