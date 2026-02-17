"use client";

import { useState } from "react";
import { Flex, Text, Badge, IconButton, Box } from "@chakra-ui/react";
import { LuGripVertical, LuX } from "react-icons/lu";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WeightPresets } from "./WeightPresets";

function toTitleCase(kebab: string): string {
  return kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface CategoryChildRowProps {
  category: string;
  weight: string;
  isOverridden: boolean;
  parentWeight: string;
  isNew?: boolean;
  isReturned?: boolean;
  onWeightChange: (weight: string) => void;
  onResetWeight?: () => void;
  onHide: () => void;
  onBadgeDismiss?: () => void;
  isDndEnabled?: boolean;
}

export function CategoryChildRow({
  category,
  weight,
  isOverridden,
  isNew,
  isReturned,
  onWeightChange,
  onResetWeight,
  onHide,
  onBadgeDismiss,
  isDndEnabled = false,
}: CategoryChildRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: category,
    disabled: !isDndEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Flex
      ref={setNodeRef}
      style={style}
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

      <Text fontSize="sm" flex={1} truncate>
        {toTitleCase(category)}
      </Text>

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
              maxW={isHovered ? "20px" : "0"}
              overflow="hidden"
              transition="max-width 0.15s"
              pr={isHovered ? 1 : 0}
            >
              <LuX size={14} />
            </Box>
            New
          </Flex>
        </Badge>
      )}

      {isReturned && (
        <Badge
          colorPalette="yellow"
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
              maxW={isHovered ? "20px" : "0"}
              overflow="hidden"
              transition="max-width 0.15s"
              pr={isHovered ? 1 : 0}
            >
              <LuX size={14} />
            </Box>
            Returned
          </Flex>
        </Badge>
      )}

      <WeightPresets
        value={weight}
        onChange={onWeightChange}
        isOverridden={isOverridden}
        onReset={onResetWeight}
        size="sm"
      />

      <IconButton
        aria-label="Hide category"
        size="xs"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onHide();
        }}
        opacity={{ base: 1, md: isHovered ? 1 : 0 }}
        transition="opacity 0.15s"
      >
        <LuX size={14} />
      </IconButton>
    </Flex>
  );
}
