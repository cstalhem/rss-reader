"use client";

import React, { useState, useRef, useEffect } from "react";
import { Flex, Text, Badge, Box, Input, Checkbox } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { Category } from "@/lib/types";
import { WeightPresetStrip } from "./WeightPresetStrip";
import { CategoryContextMenu } from "./CategoryContextMenu";

interface CategoryChildRowProps {
  category: Category;
  weight: string;
  isOverridden: boolean;
  parentWeight: string;
  isNew?: boolean;
  onWeightChange: (weight: string) => void;
  onResetWeight?: () => void;
  onHide: () => void;
  onBadgeDismiss?: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  isSelected: boolean;
  onToggleSelection: () => void;
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
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(category.display_name);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== category.display_name) {
      onRename(trimmed);
    }
    setIsRenaming(false);
    setRenameValue(category.display_name);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameValue(category.display_name);
  };

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
            onCheckedChange={() => onToggleSelection()}
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
                handleRenameSubmit();
              } else if (e.key === "Escape") {
                handleRenameCancel();
              }
            }}
            onBlur={handleRenameSubmit}
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
              onBadgeDismiss?.();
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
            onChange={onWeightChange}
            isOverridden={isOverridden}
            onReset={onResetWeight}
          />
        </Box>

        {!isRenaming && (
          <Box minH={{ base: "44px", sm: "auto" }} display="flex" alignItems="center">
            <CategoryContextMenu
              type="child"
              isWeightOverridden={isOverridden}
              onResetWeight={onResetWeight}
              onRename={() => setIsRenaming(true)}
              onHide={onHide}
              onDelete={onDelete}
            />
          </Box>
        )}
      </Flex>

      {/* Mobile weight strip */}
      <Box display={{ base: "block", sm: "none" }} px={3} pb={2}>
        <WeightPresetStrip
          value={weight}
          onChange={onWeightChange}
          isOverridden={isOverridden}
          onReset={onResetWeight}
        />
      </Box>
    </Box>
  );
};

export const CategoryChildRow = React.memo(CategoryChildRowComponent);
