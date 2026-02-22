import { useCallback, useState } from "react";
import { Category } from "@/lib/types";
import { toaster } from "@/components/ui/toaster";

interface DeleteDialogState {
  open: boolean;
  count: number;
  categoryName: string | null;
  isParent: boolean;
  childCount: number;
  ids: number[];
}

const CLOSED_DELETE_STATE: DeleteDialogState = {
  open: false,
  count: 0,
  categoryName: null,
  isParent: false,
  childCount: 0,
  ids: [],
};

interface UseCategoryDialogsParams {
  categories: Category[];
  childrenMap: Record<number, Category[]>;
  selectedIds: Set<number>;
  clearSelection: () => void;
  batchMoveMutate: (vars: { categoryIds: number[]; targetParentId: number }) => void;
  batchDeleteMutate: (categoryIds: number[]) => void;
  deleteCategoryMutate: (id: number) => void;
  ungroupParentMutate: (categoryId: number) => void;
  createCategoryMutateAsync: (vars: { displayName: string }) => Promise<Category>;
}

export function useCategoryDialogs({
  categories,
  childrenMap,
  selectedIds,
  clearSelection,
  batchMoveMutate,
  batchDeleteMutate,
  deleteCategoryMutate,
  ungroupParentMutate,
  createCategoryMutateAsync,
}: UseCategoryDialogsParams) {
  // Move to group dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  // Ungroup confirmation state (null = closed, number = count)
  const [ungroupConfirmCount, setUngroupConfirmCount] = useState<number | null>(null);

  // Delete dialog state (supports single and bulk)
  const [deleteDialogState, setDeleteDialogState] = useState<DeleteDialogState>(CLOSED_DELETE_STATE);

  // Ungroup parent confirmation state (for context menu on parent rows)
  const [ungroupParentConfirm, setUngroupParentConfirm] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Single category delete (from context menu)
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

  // Confirm delete (single or bulk)
  const handleDeleteConfirm = useCallback(() => {
    if (deleteDialogState.ids.length > 1) {
      batchDeleteMutate(deleteDialogState.ids);
    } else if (deleteDialogState.ids.length === 1) {
      deleteCategoryMutate(deleteDialogState.ids[0]);
    }
    clearSelection();
    setDeleteDialogState((prev) => ({ ...prev, open: false }));
  }, [deleteDialogState, batchDeleteMutate, deleteCategoryMutate, clearSelection]);

  // Ungroup parent (context menu on parent row)
  const handleUngroupParent = useCallback(
    (categoryId: number) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return;
      setUngroupParentConfirm({ id: categoryId, name: cat.display_name });
    },
    [categories]
  );

  // Confirm ungroup parent
  const handleUngroupParentConfirm = useCallback(() => {
    if (ungroupParentConfirm) {
      ungroupParentMutate(ungroupParentConfirm.id);
      toaster.create({ title: "Group ungrouped", type: "info" });
      setUngroupParentConfirm(null);
    }
  }, [ungroupParentConfirm, ungroupParentMutate]);

  // Action bar: open move dialog
  const handleActionMoveToGroup = useCallback(() => {
    setMoveDialogOpen(true);
  }, []);

  // Move to group (from dialog)
  const handleMoveToGroup = useCallback(
    (targetParentId: number) => {
      batchMoveMutate({ categoryIds: Array.from(selectedIds), targetParentId });
      clearSelection();
      setMoveDialogOpen(false);
    },
    [selectedIds, batchMoveMutate, clearSelection]
  );

  // Create new group and move selected into it
  const handleCreateAndMove = useCallback(
    async (groupName: string) => {
      const created = await createCategoryMutateAsync({ displayName: groupName });
      batchMoveMutate({ categoryIds: Array.from(selectedIds), targetParentId: created.id });
      clearSelection();
      setMoveDialogOpen(false);
    },
    [selectedIds, createCategoryMutateAsync, batchMoveMutate, clearSelection]
  );

  // Action bar: open ungroup confirm
  const handleActionUngroup = useCallback(() => {
    setUngroupConfirmCount(selectedIds.size);
  }, [selectedIds]);

  // Confirm batch ungroup
  const handleUngroupConfirm = useCallback(() => {
    batchMoveMutate({ categoryIds: Array.from(selectedIds), targetParentId: -1 });
    toaster.create({
      title: `${selectedIds.size} ${selectedIds.size === 1 ? "category" : "categories"} ungrouped`,
      type: "info",
    });
    clearSelection();
    setUngroupConfirmCount(null);
  }, [selectedIds, batchMoveMutate, clearSelection]);

  // Action bar: open delete dialog for bulk
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

  return {
    // Dialog state
    moveDialogOpen,
    setMoveDialogOpen,
    ungroupConfirmCount,
    setUngroupConfirmCount,
    deleteDialogState,
    setDeleteDialogState,
    ungroupParentConfirm,
    setUngroupParentConfirm,
    // Handlers
    handleDeleteCategory,
    handleDeleteConfirm,
    handleUngroupParent,
    handleUngroupParentConfirm,
    handleActionMoveToGroup,
    handleMoveToGroup,
    handleCreateAndMove,
    handleActionUngroup,
    handleUngroupConfirm,
    handleActionDelete,
  };
}
