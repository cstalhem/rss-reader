"use client";

import React, { useCallback } from "react";
import { Badge, Text, Box } from "@chakra-ui/react";
import { LuChevronRight, LuFolder } from "react-icons/lu";
import { Category } from "@/lib/types";
import { CategoryContextMenu } from "./CategoryContextMenu";
import { CategoryRowShell } from "./CategoryRowShell";

interface CategoryParentRowProps {
  category: Category;
  weight: string;
  childCount: number;
  onWeightChange: (categoryId: number, weight: string) => void;
  onRename: (categoryId: number, newName: string) => void;
  onDelete: (categoryId: number) => void;
  onUngroup: (categoryId: number) => void;
  onHide: (categoryId: number) => void;
  isExpanded: boolean;
  onToggleExpand: (parentId: number) => void;
  newChildCount: number;
  onDismissNewChildren?: () => void;
}

const CategoryParentRowComponent = ({
  category,
  weight,
  childCount,
  onWeightChange,
  onRename,
  onDelete,
  onUngroup,
  onHide,
  isExpanded,
  onToggleExpand,
  newChildCount,
  onDismissNewChildren,
}: CategoryParentRowProps) => {
  const handleRename = useCallback((newName: string) => onRename(category.id, newName), [category.id, onRename]);
  const handleWeightChange = useCallback((w: string) => onWeightChange(category.id, w), [category.id, onWeightChange]);
  const handleDelete = useCallback(() => onDelete(category.id), [category.id, onDelete]);
  const handleUngroup = useCallback(() => onUngroup(category.id), [category.id, onUngroup]);
  const handleHide = useCallback(() => onHide(category.id), [category.id, onHide]);
  const handleToggleExpand = useCallback(() => onToggleExpand(category.id), [category.id, onToggleExpand]);

  return (
    <CategoryRowShell
      category={category}
      weight={weight}
      onWeightChange={handleWeightChange}
      onRename={handleRename}
      py={3}
      nameFontWeight="semibold"
      onNameClick={handleToggleExpand}
      trailingContent={
        <Text fontSize="xs" color="fg.muted">
          ({childCount})
        </Text>
      }
      badge={
        !isExpanded && newChildCount > 0 ? (
          <Badge
            colorPalette="accent"
            size="sm"
            cursor="pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDismissNewChildren?.();
            }}
          >
            {newChildCount} new
          </Badge>
        ) : undefined
      }
      renderContextMenu={(startRename) => (
        <CategoryContextMenu
          type="parent"
          onUngroup={handleUngroup}
          onRename={startRename}
          onHide={handleHide}
          onDelete={handleDelete}
        />
      )}
    >
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        cursor="pointer"
        onClick={handleToggleExpand}
        transition="transform 0.2s"
        transform={isExpanded ? "rotate(90deg)" : "rotate(0deg)"}
        color="fg.muted"
      >
        <LuChevronRight size={14} />
      </Box>

      <Box color="fg.muted" display="inline-flex"><LuFolder size={16} /></Box>
    </CategoryRowShell>
  );
};

export const CategoryParentRow = React.memo(CategoryParentRowComponent);
