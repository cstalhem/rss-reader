"use client";

import React, { useState, useRef, useEffect } from "react";
import { Badge, Flex, Text, Box, Input } from "@chakra-ui/react";
import { LuChevronRight, LuFolder } from "react-icons/lu";
import { Category } from "@/lib/types";
import { WeightPresetStrip } from "./WeightPresetStrip";
import { CategoryContextMenu } from "./CategoryContextMenu";

interface CategoryParentRowProps {
  category: Category;
  weight: string;
  childCount: number;
  onWeightChange: (weight: string) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onUngroup: () => void;
  onHide: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
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
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(category.display_name);
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
          onClick={onToggleExpand}
          transition="transform 0.2s"
          transform={isExpanded ? "rotate(90deg)" : "rotate(0deg)"}
          color="fg.muted"
        >
          <LuChevronRight size={14} />
        </Box>

        <LuFolder size={16} color="var(--chakra-colors-fg-muted)" />

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
          <Text
            fontSize="sm"
            fontWeight="semibold"
            truncate
            cursor="pointer"
            onClick={onToggleExpand}
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
          <WeightPresetStrip value={weight} onChange={onWeightChange} />
        </Box>

        {!isRenaming && (
          <Box minH={{ base: "44px", sm: "auto" }} display="flex" alignItems="center">
            <CategoryContextMenu
              type="parent"
              onUngroup={onUngroup}
              onRename={() => setIsRenaming(true)}
              onHide={onHide}
              onDelete={onDelete}
            />
          </Box>
        )}
      </Flex>

      {/* Mobile weight strip */}
      <Box display={{ base: "block", sm: "none" }} px={3} pb={2}>
        <WeightPresetStrip value={weight} onChange={onWeightChange} />
      </Box>
    </Box>
  );
};

export const CategoryParentRow = React.memo(CategoryParentRowComponent);
