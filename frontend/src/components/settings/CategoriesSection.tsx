"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge, Box, Flex, Stack, Skeleton, Text, Input } from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import { useCategories } from "@/hooks/useCategories";
import { Category } from "@/lib/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { toaster } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CategoryTree } from "./CategoryTree";
import { CategoryActionBar } from "./CategoryActionBar";
import { CreateCategoryPopover } from "./CreateCategoryPopover";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import { MoveToGroupDialog } from "./MoveToGroupDialog";
import { HiddenCategoriesSection } from "./HiddenCategoriesSection";

export function CategoriesSection() {
  const {
    categories,
    newCount,
    isLoading,
    updateCategory,
    createCategoryMutation,
    deleteCategoryMutation,
    hideMutation,
    unhideMutation,
    acknowledgeMutation,
    batchMoveMutation,
    batchHideMutation,
    batchDeleteMutation,
    ungroupParentMutation,
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

  // Move to group dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  // Ungroup confirmation state (null = closed, number = count)
  const [ungroupConfirmCount, setUngroupConfirmCount] = useState<number | null>(null);

  // Delete dialog state (supports single and bulk)
  const [deleteDialogState, setDeleteDialogState] = useState<{
    open: boolean;
    count: number;
    categoryName: string | null;
    isParent: boolean;
    childCount: number;
    ids: number[];
  }>({ open: false, count: 0, categoryName: null, isParent: false, childCount: 0, ids: [] });

  // Ungroup parent confirmation state (for context menu on parent rows)
  const [ungroupParentConfirm, setUngroupParentConfirm] = useState<{
    id: number;
    name: string;
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

  // Hidden categories
  const hiddenCategories = useMemo(
    () =>
      categories
        .filter((c) => c.is_hidden)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [categories]
  );

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
      hideMutation.mutate(categoryId);
      toaster.create({ title: "Category hidden", type: "info" });
    },
    [hideMutation.mutate]
  );

  const handleBadgeDismiss = useCallback(
    (categoryId: number) => {
      acknowledgeMutation.mutate([categoryId]);
    },
    [acknowledgeMutation.mutate]
  );

  const handleUnhideCategory = useCallback(
    (categoryId: number) => {
      unhideMutation.mutate(categoryId);
      toaster.create({ title: "Category unhidden", type: "info" });
    },
    [unhideMutation.mutate]
  );

  const handleDeleteCategory = useCallback(
    (categoryId: number) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return;
      const children = childrenMap[categoryId] ?? [];
      const isParent = children.length > 0;
      setDeleteDialogState({
        open: true,
        count: 1,
        categoryName: cat.display_name,
        isParent,
        childCount: children.length,
        ids: [categoryId],
      });
    },
    [categories, childrenMap]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (deleteDialogState.ids.length > 1) {
      batchDeleteMutation.mutate(deleteDialogState.ids);
    } else if (deleteDialogState.ids.length === 1) {
      deleteCategoryMutation.mutate(deleteDialogState.ids[0]);
    }
    clearSelection();
    setDeleteDialogState((prev) => ({ ...prev, open: false }));
  }, [deleteDialogState, deleteCategoryMutation, batchDeleteMutation, clearSelection]);

  const handleRenameCategory = useCallback(
    (categoryId: number, newName: string) => {
      updateCategory(categoryId, { display_name: newName });
    },
    [updateCategory]
  );

  const handleUngroupParent = useCallback(
    (categoryId: number) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return;
      setUngroupParentConfirm({ id: categoryId, name: cat.display_name });
    },
    [categories]
  );

  const handleUngroupParentConfirm = useCallback(() => {
    if (ungroupParentConfirm) {
      ungroupParentMutation.mutate(ungroupParentConfirm.id);
      toaster.create({ title: "Group ungrouped", type: "info" });
      setUngroupParentConfirm(null);
    }
  }, [ungroupParentConfirm, ungroupParentMutation]);

  const handleActionMoveToGroup = useCallback(() => {
    setMoveDialogOpen(true);
  }, []);

  const handleMoveToGroup = useCallback(
    (targetParentId: number) => {
      batchMoveMutation.mutate({ categoryIds: Array.from(selectedIds), targetParentId });
      clearSelection();
      setMoveDialogOpen(false);
    },
    [selectedIds, batchMoveMutation, clearSelection]
  );

  const handleCreateAndMove = useCallback(
    async (groupName: string) => {
      const created = await createCategoryMutation.mutateAsync({ displayName: groupName });
      batchMoveMutation.mutate({ categoryIds: Array.from(selectedIds), targetParentId: created.id });
      clearSelection();
      setMoveDialogOpen(false);
    },
    [selectedIds, createCategoryMutation, batchMoveMutation, clearSelection]
  );

  const handleActionUngroup = useCallback(() => {
    setUngroupConfirmCount(selectedIds.size);
  }, [selectedIds]);

  const handleUngroupConfirm = useCallback(() => {
    batchMoveMutation.mutate({ categoryIds: Array.from(selectedIds), targetParentId: -1 });
    toaster.create({
      title: `${selectedIds.size} ${selectedIds.size === 1 ? "category" : "categories"} ungrouped`,
      type: "info",
    });
    clearSelection();
    setUngroupConfirmCount(null);
  }, [selectedIds, batchMoveMutation, clearSelection]);

  const handleActionHide = useCallback(() => {
    batchHideMutation.mutate(Array.from(selectedIds));
    toaster.create({
      title: `${selectedIds.size} ${selectedIds.size === 1 ? "category" : "categories"} hidden`,
      type: "info",
    });
    clearSelection();
  }, [selectedIds, batchHideMutation, clearSelection]);

  const handleActionDelete = useCallback(() => {
    setDeleteDialogState({
      open: true,
      count: selectedIds.size,
      categoryName: null,
      isParent: false,
      childCount: 0,
      ids: Array.from(selectedIds),
    });
  }, [selectedIds]);

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
            <Box color="fg.subtle"><LuTag size={40} /></Box>
            <Text color="fg.muted" textAlign="center">
              Categories will appear here once articles are scored by the LLM
            </Text>
          </Flex>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap={6} pb={{ base: selectedIds.size > 0 ? 16 : 0, sm: 0 }}>
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
          onCreateCategory={(displayName) => createCategoryMutation.mutate({ displayName })}
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
        open={deleteDialogState.open}
        onOpenChange={(open) => setDeleteDialogState((prev) => ({ ...prev, open }))}
        count={deleteDialogState.count}
        categoryName={deleteDialogState.categoryName}
        isParent={deleteDialogState.isParent}
        childCount={deleteDialogState.childCount}
        onConfirm={handleDeleteConfirm}
      />

      <MoveToGroupDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        parentCategories={parents}
        childrenMap={childrenMap}
        selectedCount={selectedIds.size}
        onMove={handleMoveToGroup}
        onCreate={handleCreateAndMove}
      />

      {/* Ungroup confirmation dialog (action bar batch ungroup) */}
      <ConfirmDialog
        open={ungroupConfirmCount !== null}
        onOpenChange={(e) => {
          if (!e.open) setUngroupConfirmCount(null);
        }}
        title="Ungroup categories"
        body={
          <Text>
            Ungroup {ungroupConfirmCount}{" "}
            {ungroupConfirmCount === 1 ? "category" : "categories"}? They
            will be moved to the root level.
          </Text>
        }
        confirmLabel="Confirm"
        confirmColorPalette="accent"
        onConfirm={handleUngroupConfirm}
      />

      {/* Ungroup parent confirmation dialog (context menu on parent row) */}
      <ConfirmDialog
        open={ungroupParentConfirm !== null}
        onOpenChange={(e) => {
          if (!e.open) setUngroupParentConfirm(null);
        }}
        title="Ungroup parent category"
        body={
          <Text>
            Ungroup <strong>{ungroupParentConfirm?.name}</strong>? All
            children will be moved to the root level and the parent will
            become an ungrouped category.
          </Text>
        }
        confirmLabel="Confirm"
        confirmColorPalette="accent"
        onConfirm={handleUngroupParentConfirm}
      />

      {/* Hidden categories section */}
      <HiddenCategoriesSection
        hiddenCategories={hiddenCategories}
        onUnhide={handleUnhideCategory}
      />
    </Stack>
  );
}
