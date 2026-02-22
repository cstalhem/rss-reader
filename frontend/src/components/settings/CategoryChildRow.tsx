"use client";

import React, { useCallback } from "react";
import { Box, Checkbox } from "@chakra-ui/react";
import { Category } from "@/lib/types";
import { useCategoryTreeContext } from "./CategoriesSection";
import { CategoryContextMenu } from "./CategoryContextMenu";
import { CategoryRowShell } from "./CategoryRowShell";
import { NewCategoryBadge } from "./NewCategoryBadge";

interface CategoryChildRowProps {
  category: Category;
  weight: string;
  isOverridden: boolean;
  parentWeight: string;
}

const CategoryChildRowComponent = ({
  category,
  weight,
  isOverridden,
}: CategoryChildRowProps) => {
  const {
    onWeightChange, onResetWeight, onHide, onBadgeDismiss,
    onRename, onDelete, selectedIds, onToggleSelection, newCategoryIds,
  } = useCategoryTreeContext();

  const isNew = newCategoryIds.has(category.id);
  const isSelected = selectedIds.has(category.id);

  const handleRename = useCallback((newName: string) => onRename(category.id, newName), [category.id, onRename]);
  const handleWeightChange = useCallback((w: string) => onWeightChange(category.id, w), [category.id, onWeightChange]);
  const handleResetWeight = useCallback(() => onResetWeight(category.id), [category.id, onResetWeight]);
  const handleHide = useCallback(() => onHide(category.id), [category.id, onHide]);
  const handleDelete = useCallback(() => onDelete(category.id), [category.id, onDelete]);
  const handleBadgeDismiss = useCallback(() => onBadgeDismiss(category.id), [category.id, onBadgeDismiss]);

  return (
    <CategoryRowShell
      category={category}
      weight={weight}
      onWeightChange={handleWeightChange}
      onRename={handleRename}
      isOverridden={isOverridden}
      onReset={handleResetWeight}
      badge={
        isNew
          ? (isHovered: boolean) => <NewCategoryBadge isHovered={isHovered} onDismiss={handleBadgeDismiss} />
          : undefined
      }
      renderContextMenu={(startRename) => (
        <CategoryContextMenu
          type="child"
          isWeightOverridden={isOverridden}
          onResetWeight={handleResetWeight}
          onRename={startRename}
          onHide={handleHide}
          onDelete={handleDelete}
        />
      )}
    >
      <Box onClick={(e) => e.stopPropagation()} minH={{ base: "44px", sm: "auto" }} display="flex" alignItems="center">
        <Checkbox.Root
          size="sm"
          colorPalette="accent"
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(category.id)}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      </Box>
    </CategoryRowShell>
  );
};

export const CategoryChildRow = React.memo(CategoryChildRowComponent);
