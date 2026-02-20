"use client";

import React, { useCallback, useState } from "react";
import { Badge, Box, Checkbox, Flex } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { Category } from "@/lib/types";
import { CategoryContextMenu } from "./CategoryContextMenu";
import { CategoryRowShell } from "./CategoryRowShell";

interface CategoryChildRowProps {
  category: Category;
  weight: string;
  isOverridden: boolean;
  parentWeight: string;
  isNew?: boolean;
  onWeightChange: (categoryId: number, weight: string) => void;
  onResetWeight: (categoryId: number) => void;
  onHide: (categoryId: number) => void;
  onBadgeDismiss: (categoryId: number) => void;
  onRename: (categoryId: number, newName: string) => void;
  onDelete: (categoryId: number) => void;
  isSelected: boolean;
  onToggleSelection: (id: number) => void;
}

const CategoryChildRowComponent = ({
  category,
  weight,
  isOverridden,
  isNew,
  onWeightChange,
  onResetWeight,
  onHide,
  onBadgeDismiss,
  onRename,
  onDelete,
  isSelected,
  onToggleSelection,
}: CategoryChildRowProps) => {
  const handleRename = useCallback((newName: string) => onRename(category.id, newName), [category.id, onRename]);
  const handleWeightChange = useCallback((w: string) => onWeightChange(category.id, w), [category.id, onWeightChange]);
  const handleResetWeight = useCallback(() => onResetWeight(category.id), [category.id, onResetWeight]);
  const handleHide = useCallback(() => onHide(category.id), [category.id, onHide]);
  const handleDelete = useCallback(() => onDelete(category.id), [category.id, onDelete]);
  const handleBadgeDismiss = useCallback(() => onBadgeDismiss(category.id), [category.id, onBadgeDismiss]);

  const [isHovered, setIsHovered] = useState(false);

  return (
    <CategoryRowShell
      category={category}
      weight={weight}
      onWeightChange={handleWeightChange}
      onRename={handleRename}
      isOverridden={isOverridden}
      onReset={handleResetWeight}
      onHoverChange={setIsHovered}
      badge={
        isNew ? (
          <Badge
            colorPalette="accent"
            size="sm"
            cursor="pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleBadgeDismiss();
            }}
          >
            <Flex alignItems="center" gap={0}>
              <Box
                display="flex"
                alignItems="center"
                maxW={{ base: "20px", md: isHovered ? "20px" : "0" }}
                overflow="hidden"
                transition="max-width 0.15s, padding 0.15s"
                pr={isHovered ? 1 : 0}
              >
                <LuX size={14} />
              </Box>
              New
            </Flex>
          </Badge>
        ) : undefined
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
