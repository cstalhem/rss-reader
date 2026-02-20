"use client";

import React, { useCallback, useState } from "react";
import { Flex, Text, Badge, Box, Input, Checkbox } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { Category } from "@/lib/types";
import { useRenameState } from "@/hooks/useRenameState";
import { WeightPresetStrip } from "./WeightPresetStrip";
import { CategoryContextMenu } from "./CategoryContextMenu";

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
  const handleWeightChange = useCallback((weight: string) => onWeightChange(category.id, weight), [category.id, onWeightChange]);
  const handleResetWeight = useCallback(() => onResetWeight(category.id), [category.id, onResetWeight]);
  const handleHide = useCallback(() => onHide(category.id), [category.id, onHide]);
  const handleDelete = useCallback(() => onDelete(category.id), [category.id, onDelete]);
  const handleBadgeDismiss = useCallback(() => onBadgeDismiss(category.id), [category.id, onBadgeDismiss]);

  const { isRenaming, renameValue, setRenameValue, startRename, handleSubmit, handleCancel, inputRef } =
    useRenameState(category.display_name, handleRename);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      borderWidth={{ base: "1px", sm: "0" }}
      borderColor="border.subtle"
      borderRadius={{ base: "md", sm: "sm" }}
      bg="bg.subtle"
      _hover={{ bg: "bg.muted" }}
      transition="background 0.15s"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Flex
        role="group"
        alignItems="center"
        gap={2}
        py={2}
        px={3}
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

        {isRenaming ? (
          <Input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSubmit();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
            onBlur={handleSubmit}
            size="sm"
            flex={1}
          />
        ) : (
          <Text fontSize="sm" truncate>
            {category.display_name}
          </Text>
        )}

        {isNew && (
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
        )}

        <Box flex={1} />

        {/* Desktop weight strip */}
        <Box display={{ base: "none", sm: "block" }}>
          <WeightPresetStrip
            value={weight}
            onChange={handleWeightChange}
            isOverridden={isOverridden}
            onReset={handleResetWeight}
          />
        </Box>

        {!isRenaming && (
          <Box minH={{ base: "44px", sm: "auto" }} display="flex" alignItems="center">
            <CategoryContextMenu
              type="child"
              isWeightOverridden={isOverridden}
              onResetWeight={handleResetWeight}
              onRename={startRename}
              onHide={handleHide}
              onDelete={handleDelete}
            />
          </Box>
        )}
      </Flex>

      {/* Mobile weight strip */}
      <Box display={{ base: "block", sm: "none" }} px={3} pb={2}>
        <WeightPresetStrip
          value={weight}
          onChange={handleWeightChange}
          isOverridden={isOverridden}
          onReset={handleResetWeight}
        />
      </Box>
    </Box>
  );
};

export const CategoryChildRow = React.memo(CategoryChildRowComponent);
