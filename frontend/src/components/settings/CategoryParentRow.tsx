"use client";

import React, { useState, useRef, useEffect } from "react";
import { Badge, Flex, Text, Box, IconButton, Input } from "@chakra-ui/react";
import { LuChevronRight, LuFolder, LuPencil, LuTrash2 } from "react-icons/lu";
import { Tooltip } from "@/components/ui/tooltip";
import { Category } from "@/lib/types";
import { WeightPresetStrip } from "./WeightPresetStrip";

interface CategoryParentRowProps {
  category: Category;
  weight: string;
  childCount: number;
  onWeightChange: (weight: string) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
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
  isExpanded,
  onToggleExpand,
  newChildCount,
  onDismissNewChildren,
}: CategoryParentRowProps) => {
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
    <Flex
      role="group"
      alignItems="center"
      gap={2}
      py={3}
      px={3}
      bg="bg.subtle"
      borderRadius="sm"
      _hover={{ bg: "bg.muted" }}
      transition="background 0.15s"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

      <WeightPresetStrip value={weight} onChange={onWeightChange} />

      {!isRenaming && (
        <Flex
          overflow="hidden"
          maxW={{ base: "auto", md: isHovered ? "80px" : "0" }}
          transition="max-width 0.2s ease-out"
        >
          <Tooltip content="Rename category" openDelay={300}>
            <IconButton
              aria-label="Rename category"
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
            >
              <LuPencil size={14} />
            </IconButton>
          </Tooltip>

          <Tooltip content="Delete category" openDelay={300}>
            <IconButton
              aria-label="Delete category"
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <LuTrash2 size={14} />
            </IconButton>
          </Tooltip>
        </Flex>
      )}
    </Flex>
  );
};

export const CategoryParentRow = React.memo(CategoryParentRowComponent);
