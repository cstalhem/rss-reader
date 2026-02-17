"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { Flex, Text, Badge, IconButton, Box, Input } from "@chakra-ui/react";
import { LuGripVertical, LuX, LuPencil, LuTrash2 } from "react-icons/lu";
import { Tooltip } from "@/components/ui/tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Category } from "@/lib/types";
import { WeightPresetStrip } from "./WeightPresetStrip";
import { SwipeableRow } from "./SwipeableRow";

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
  isDndEnabled?: boolean;
  onRename: (newName: string) => void;
  onDelete: () => void;
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
  isDndEnabled = false,
  onRename,
  onDelete,
}: CategoryChildRowProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(category.display_name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category.id.toString(),
    disabled: !isDndEnabled,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop:${category.id}`,
    data: { type: "category", categoryId: category.id },
    disabled: !isDndEnabled,
  });

  // Combine sortable and droppable refs
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setSortableRef(node);
      setDroppableRef(node);
    },
    [setSortableRef, setDroppableRef]
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
    <SwipeableRow onEditReveal={() => setIsRenaming(true)}>
      <Flex
        ref={setNodeRef}
        role="group"
        style={style}
        alignItems="center"
        gap={2}
        py={2}
        px={3}
        bg={isOver ? "accent.subtle" : "bg.subtle"}
        borderRadius="sm"
        _hover={{ bg: isOver ? "accent.subtle" : "bg.muted" }}
        transition="background 0.15s"
      >
        <Flex
          color="fg.muted"
          alignItems="center"
          opacity={isDndEnabled ? 0.3 : 0}
          cursor={isDndEnabled ? "grab" : "default"}
          {...attributes}
          {...listeners}
        >
          <LuGripVertical size={14} />
        </Flex>

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
                maxW="0"
                overflow="hidden"
                transition="max-width 0.15s, padding 0.15s"
                _groupHover={{ maxW: "20px", pr: 1 }}
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
          isOverridden={isOverridden}
          onReset={onResetWeight}
        />

        <Flex
          overflow="hidden"
          maxW={{ base: "auto", md: "0" }}
          _groupHover={{ maxW: "110px" }}
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
    </SwipeableRow>
  );
};

export const CategoryChildRow = React.memo(CategoryChildRowComponent);
