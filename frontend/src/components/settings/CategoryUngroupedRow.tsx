"use client";

import React, { useState, useRef, useEffect } from "react";
import { Flex, Text, Badge, IconButton, Box, Input, Checkbox } from "@chakra-ui/react";
import { LuX, LuPencil, LuTrash2 } from "react-icons/lu";
import { Tooltip } from "@/components/ui/tooltip";
import { Category } from "@/lib/types";
import { WeightPresetStrip } from "./WeightPresetStrip";

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
      py={2}
      px={3}
      bg="bg.subtle"
      borderRadius="sm"
      _hover={{ bg: "bg.muted" }}
      transition="background 0.15s"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box onClick={(e) => e.stopPropagation()}>
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

      <WeightPresetStrip
        value={weight}
        onChange={onWeightChange}
        isOverridden={false}
      />

      <Flex
        overflow="hidden"
        maxW={{ base: "auto", md: isHovered ? "110px" : "0" }}
        transition="max-width 0.2s ease-out"
      >
        {!isRenaming && (
          <>
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
          </>
        )}

        <Tooltip content="Hide category" openDelay={300}>
          <IconButton
            aria-label="Hide category"
            size="xs"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onHide();
            }}
          >
            <LuX size={14} />
          </IconButton>
        </Tooltip>
      </Flex>
    </Flex>
  );
};

export const CategoryUngroupedRow = React.memo(CategoryUngroupedRowComponent);
