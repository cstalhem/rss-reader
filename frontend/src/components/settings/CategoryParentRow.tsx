"use client";

import React, { useCallback } from "react";
import { Badge, Flex, Text, Box, Input } from "@chakra-ui/react";
import { LuChevronRight, LuFolder } from "react-icons/lu";
import { Category } from "@/lib/types";
import { useRenameState } from "@/hooks/useRenameState";
import { WeightPresetStrip } from "./WeightPresetStrip";
import { CategoryContextMenu } from "./CategoryContextMenu";

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
  const handleWeightChange = useCallback((weight: string) => onWeightChange(category.id, weight), [category.id, onWeightChange]);
  const handleDelete = useCallback(() => onDelete(category.id), [category.id, onDelete]);
  const handleUngroup = useCallback(() => onUngroup(category.id), [category.id, onUngroup]);
  const handleHide = useCallback(() => onHide(category.id), [category.id, onHide]);
  const handleToggleExpand = useCallback(() => onToggleExpand(category.id), [category.id, onToggleExpand]);

  const { isRenaming, renameValue, setRenameValue, startRename, handleSubmit, handleCancel, inputRef } =
    useRenameState(category.display_name, handleRename);

  return (
    <Box
      borderWidth={{ base: "1px", sm: "0" }}
      borderColor="border.subtle"
      borderRadius={{ base: "md", sm: "sm" }}
      bg="bg.subtle"
      _hover={{ bg: "bg.muted" }}
      transition="background 0.15s"
    >
      <Flex
        role="group"
        alignItems="center"
        gap={2}
        py={3}
        px={3}
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
          <Text
            fontSize="sm"
            fontWeight="semibold"
            truncate
            cursor="pointer"
            onClick={handleToggleExpand}
          >
            {category.display_name}
          </Text>
        )}

        <Text fontSize="xs" color="fg.muted">
          ({childCount})
        </Text>

        {!isExpanded && newChildCount > 0 && (
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
        )}

        <Box flex={1} />

        {/* Desktop weight strip */}
        <Box display={{ base: "none", sm: "block" }}>
          <WeightPresetStrip value={weight} onChange={handleWeightChange} />
        </Box>

        {!isRenaming && (
          <Box minH={{ base: "44px", sm: "auto" }} display="flex" alignItems="center">
            <CategoryContextMenu
              type="parent"
              onUngroup={handleUngroup}
              onRename={startRename}
              onHide={handleHide}
              onDelete={handleDelete}
            />
          </Box>
        )}
      </Flex>

      {/* Mobile weight strip */}
      <Box display={{ base: "block", sm: "none" }} px={3} pb={2}>
        <WeightPresetStrip value={weight} onChange={handleWeightChange} />
      </Box>
    </Box>
  );
};

export const CategoryParentRow = React.memo(CategoryParentRowComponent);
