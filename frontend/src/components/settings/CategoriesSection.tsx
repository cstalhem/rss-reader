"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { Badge, EmptyState, Stack, Text, Input } from "@chakra-ui/react";
import { LuTag } from "react-icons/lu";
import { SettingsPageHeader } from "./SettingsPageHeader";
import { useCategories } from "@/hooks/useCategories";
import { useCategoryTree } from "@/hooks/useCategoryTree";
import { useCategoryDialogs } from "@/hooks/useCategoryDialogs";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { toaster } from "@/components/ui/toaster";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CategoryTree } from "./CategoryTree";
import { CategoryActionBar } from "./CategoryActionBar";
import { CreateCategoryPopover } from "./CreateCategoryPopover";
import { DeleteCategoryDialog } from "./DeleteCategoryDialog";
import { MoveToGroupDialog } from "./MoveToGroupDialog";
import { HiddenCategoriesSection } from "./HiddenCategoriesSection";
import { CategoriesTreeSkeleton } from "./CategoriesTreeSkeleton";

// --- CategoryTreeContext (co-located: single consumer) ---

export interface CategoryTreeContextValue {
  onWeightChange: (categoryId: number, weight: string) => void;
  onResetWeight: (categoryId: number) => void;
  onHide: (categoryId: number) => void;
  onBadgeDismiss: (categoryId: number) => void;
  onRename: (categoryId: number, newName: string) => void;
  onDelete: (categoryId: number) => void;
  onUngroup: (categoryId: number) => void;
  selectedIds: Set<number>;
  onToggleSelection: (id: number) => void;
  newCategoryIds: Set<number>;
}

const CategoryTreeContext = createContext<CategoryTreeContextValue | null>(null);

export function useCategoryTreeContext() {
  const ctx = useContext(CategoryTreeContext);
  if (!ctx) throw new Error("useCategoryTreeContext must be used within CategoryTreeContext.Provider");
  return ctx;
}

// --- CategoriesSection ---

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

  // Defer heavy tree render so the shell paints instantly
  const [treeReady, setTreeReady] = useState(false);
  const [, startTransition] = useTransition();
  useEffect(() => {
    startTransition(() => setTreeReady(true));
  }, [startTransition]);

  // Tree building + search
  const { parents, childrenMap, ungroupedCategories, newCategoryIds, hiddenCategories, searchQuery, setSearchQuery } =
    useCategoryTree(categories);
  const rootMoveTargets = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === null && !c.is_hidden)
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [categories]
  );

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

  // Dialog state + handlers
  const dialogs = useCategoryDialogs({
    categories,
    childrenMap,
    selectedIds,
    clearSelection,
    batchMoveMutate: batchMoveMutation.mutate,
    batchDeleteMutate: batchDeleteMutation.mutate,
    deleteCategoryMutate: deleteCategoryMutation.mutate,
    ungroupParentMutate: ungroupParentMutation.mutate,
    createCategoryMutateAsync: createCategoryMutation.mutateAsync,
  });

  // Action callbacks for context
  const handleWeightChange = useCallback(
    (categoryId: number, weight: string) => updateCategory(categoryId, { weight }),
    [updateCategory]
  );
  const handleResetWeight = useCallback(
    (categoryId: number) => updateCategory(categoryId, { weight: "inherit" as string | null }),
    [updateCategory]
  );
  const { mutate: hideCategory } = hideMutation;
  const { mutate: acknowledgeCategory } = acknowledgeMutation;
  const { mutate: unhideCategory } = unhideMutation;
  const { mutate: batchHide } = batchHideMutation;

  const handleHideCategory = useCallback(
    (categoryId: number) => {
      hideCategory(categoryId);
      toaster.create({ title: "Category hidden", type: "info" });
    },
    [hideCategory]
  );
  const handleBadgeDismiss = useCallback(
    (categoryId: number) => acknowledgeCategory([categoryId]),
    [acknowledgeCategory]
  );
  const handleRenameCategory = useCallback(
    (categoryId: number, newName: string) => updateCategory(categoryId, { display_name: newName }),
    [updateCategory]
  );
  const handleUnhideCategory = useCallback(
    (categoryId: number) => {
      unhideCategory(categoryId);
      toaster.create({ title: "Category unhidden", type: "info" });
    },
    [unhideCategory]
  );

  // Action bar: hide
  const handleActionHide = useCallback(() => {
    batchHide(Array.from(selectedIds));
    toaster.create({
      title: `${selectedIds.size} ${selectedIds.size === 1 ? "category" : "categories"} hidden`,
      type: "info",
    });
    clearSelection();
  }, [selectedIds, batchHide, clearSelection]);

  // Context value (memoized to prevent spurious re-renders)
  const contextValue = useMemo<CategoryTreeContextValue>(() => ({
    onWeightChange: handleWeightChange,
    onResetWeight: handleResetWeight,
    onHide: handleHideCategory,
    onBadgeDismiss: handleBadgeDismiss,
    onRename: handleRenameCategory,
    onDelete: dialogs.handleDeleteCategory,
    onUngroup: dialogs.handleUngroupParent,
    selectedIds,
    onToggleSelection: toggleSelection,
    newCategoryIds,
  }), [
    handleWeightChange, handleResetWeight, handleHideCategory, handleBadgeDismiss,
    handleRenameCategory, dialogs.handleDeleteCategory, dialogs.handleUngroupParent,
    selectedIds, toggleSelection, newCategoryIds,
  ]);

  if (!isLoading && categories.length === 0) {
    return (
      <Stack gap={8}>
        <SettingsPageHeader title="Topic Categories" />
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <LuTag size={40} />
            </EmptyState.Indicator>
            <EmptyState.Description>
              Categories will appear here once articles are scored by the LLM
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </Stack>
    );
  }

  return (
    <CategoryTreeContext.Provider value={contextValue}>
      <Stack as="section" aria-label="Categories" gap={6} pb={{ base: selectedIds.size > 0 ? 16 : 0, sm: 0 }}>
        <SettingsPageHeader
          title="Topic Categories"
          titleBadge={
            newCount > 0 ? (
              <Badge colorPalette="accent" size="sm">
                {newCount} new
              </Badge>
            ) : undefined
          }
        >
          <CreateCategoryPopover
            onCreateCategory={(displayName) => createCategoryMutation.mutate({ displayName })}
            existingCategories={categories}
          />
        </SettingsPageHeader>

        <CategoryActionBar
          selectedCount={selectedIds.size}
          onMoveToGroup={dialogs.handleActionMoveToGroup}
          onUngroup={dialogs.handleActionUngroup}
          onHide={handleActionHide}
          onDelete={dialogs.handleActionDelete}
        />

        <Input
          placeholder="Filter categories..."
          size="sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {isLoading || !treeReady ? (
          <CategoriesTreeSkeleton />
        ) : (
          <CategoryTree
            parents={parents}
            childrenMap={childrenMap}
            ungroupedCategories={ungroupedCategories}
            expandedParents={expandedParents}
            onToggleParent={toggleParent}
          />
        )}

        <DeleteCategoryDialog
          open={dialogs.deleteDialogState.open}
          onOpenChange={(open) => dialogs.setDeleteDialogState((prev) => ({ ...prev, open }))}
          count={dialogs.deleteDialogState.count}
          categoryName={dialogs.deleteDialogState.categoryName}
          isParent={dialogs.deleteDialogState.isParent}
          childCount={dialogs.deleteDialogState.childCount}
          onConfirm={dialogs.handleDeleteConfirm}
        />

        <MoveToGroupDialog
          open={dialogs.moveDialogOpen}
          onOpenChange={dialogs.setMoveDialogOpen}
          rootCategories={rootMoveTargets}
          childrenMap={childrenMap}
          selectedCount={selectedIds.size}
          onMove={dialogs.handleMoveToGroup}
          onCreate={dialogs.handleCreateAndMove}
        />

        <ConfirmDialog
          open={dialogs.ungroupConfirmCount !== null}
          onOpenChange={(e) => {
            if (!e.open) dialogs.setUngroupConfirmCount(null);
          }}
          title="Ungroup categories"
          body={
            <Text>
              Ungroup {dialogs.ungroupConfirmCount}{" "}
              {dialogs.ungroupConfirmCount === 1 ? "category" : "categories"}? They
              will be moved to the root level.
            </Text>
          }
          confirmLabel="Confirm"
          confirmColorPalette="accent"
          onConfirm={dialogs.handleUngroupConfirm}
        />

        <ConfirmDialog
          open={dialogs.ungroupParentConfirm !== null}
          onOpenChange={(e) => {
            if (!e.open) dialogs.setUngroupParentConfirm(null);
          }}
          title="Ungroup parent category"
          body={
            <Text>
              Ungroup <strong>{dialogs.ungroupParentConfirm?.name}</strong>? All
              children will be moved to the root level and the parent will
              become an ungrouped category.
            </Text>
          }
          confirmLabel="Confirm"
          confirmColorPalette="accent"
          onConfirm={dialogs.handleUngroupParentConfirm}
        />

        {!isLoading && treeReady && (
          <HiddenCategoriesSection
            hiddenCategories={hiddenCategories}
            onUnhide={handleUnhideCategory}
          />
        )}
      </Stack>
    </CategoryTreeContext.Provider>
  );
}
