"use client";

import React, { useState } from "react";
import { Flex, Text, Badge, Box, Input, Checkbox } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { Category } from "@/lib/types";
import { useRenameState } from "@/hooks/useRenameState";
import { WeightPresetStrip } from "./WeightPresetStrip";
import { CategoryContextMenu } from "./CategoryContextMenu";

interface CategoryUngroupedRowProps {
  category: Category;
  weight: string;
  isNew?: boolean;
  isSelected: boolean;
  onWeightChange: (weight: string) => void;
  onHide: () => void;
  onBadgeDismiss?: () => void;
  onToggleSelection: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

const CategoryUngroupedRowComponent = ({
  category,
  weight,
  isNew,
  isSelected,
  onWeightChange,
  onHide,
  onBadgeDismiss,
  onToggleSelection,
  onRename,
  onDelete,
}: CategoryUngroupedRowProps) => {
  const { isRenaming, renameValue, setRenameValue, startRename, handleSubmit, handleCancel, inputRef } =
    useRenameState(category.display_name, onRename);
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
            isOverridden={false}
          />
        </Box>

        {!isRenaming && (
          <Box minH={{ base: "44px", sm: "auto" }} display="flex" alignItems="center">
            <CategoryContextMenu
              type="ungrouped"
              onRename={startRename}
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
          isOverridden={false}
        />
      </Box>
    </Box>
  );
};

export const CategoryUngroupedRow = React.memo(CategoryUngroupedRowComponent);
