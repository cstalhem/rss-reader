"use client";

import { useState, useRef, useEffect } from "react";
import { Flex, Text, Box, IconButton, Input } from "@chakra-ui/react";
import { LuFolder, LuPencil, LuTrash2 } from "react-icons/lu";
import { useDroppable } from "@dnd-kit/core";
import { WeightPresetStrip } from "./WeightPresetStrip";
import { SwipeableRow } from "./SwipeableRow";

function toTitleCase(kebab: string): string {
  return kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface CategoryParentRowProps {
  category: string;
  weight: string;
  childCount: number;
  onWeightChange: (weight: string) => void;
  isDndEnabled?: boolean;
  activeId?: string | null;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

export function CategoryParentRow({
  category,
  weight,
  childCount,
  onWeightChange,
  isDndEnabled = false,
  activeId,
  onRename,
  onDelete,
}: CategoryParentRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(toTitleCase(category));
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `parent:${category}`,
    disabled: !isDndEnabled,
  });

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && trimmed !== category) {
      onRename(trimmed);
    }
    setIsRenaming(false);
    setRenameValue(toTitleCase(category));
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameValue(toTitleCase(category));
  };

  return (
    <SwipeableRow onEditReveal={() => setIsRenaming(true)}>
      <Flex
        ref={setNodeRef}
        alignItems="center"
        gap={2}
        py={3}
        px={3}
        bg={isOver ? "bg.muted" : "bg.subtle"}
        borderRadius="sm"
        _hover={{ bg: "bg.muted" }}
        transition="background 0.15s"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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
          <Text fontSize="sm" fontWeight="semibold" flex={1} truncate>
            {toTitleCase(category)}
          </Text>
        )}

        <Text fontSize="xs" color="fg.muted">
          ({childCount})
        </Text>

        {!isRenaming && (
          <>
            <IconButton
              aria-label="Rename category"
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
              opacity={{ base: 1, md: isHovered ? 1 : 0 }}
              transition="opacity 0.15s"
            >
              <LuPencil size={14} />
            </IconButton>

            <IconButton
              aria-label="Delete category"
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              opacity={{ base: 1, md: isHovered ? 1 : 0 }}
              transition="opacity 0.15s"
            >
              <LuTrash2 size={14} />
            </IconButton>
          </>
        )}

        <WeightPresetStrip value={weight} onChange={onWeightChange} />

        {isOver && activeId && activeId !== category && (
          <Box
            position="absolute"
            bottom="-8px"
            left={3}
            right={3}
            p={2}
            bg="bg.muted"
            borderRadius="sm"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border.subtle"
            opacity={0.5}
          >
            <Text fontSize="sm" color="fg.muted">
              {toTitleCase(activeId)}
            </Text>
          </Box>
        )}
      </Flex>
    </SwipeableRow>
  );
}
