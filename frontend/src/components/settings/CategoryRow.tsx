"use client";

import { useState } from "react";
import { Flex, Text, Badge, IconButton } from "@chakra-ui/react";
import { LuGripVertical, LuX } from "react-icons/lu";
import { WeightPresets } from "./WeightPresets";

function toTitleCase(kebab: string): string {
  return kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface CategoryRowProps {
  category: string;
  weight: string;
  isOverridden?: boolean;
  isNew?: boolean;
  isReturned?: boolean;
  onWeightChange: (weight: string) => void;
  onResetWeight?: () => void;
  onHide: () => void;
  onBadgeDismiss?: () => void;
  showCheckbox?: boolean;
  isChecked?: boolean;
  onCheckChange?: (checked: boolean) => void;
  isDraggable?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function CategoryRow({
  category,
  weight,
  isOverridden,
  isNew,
  isReturned,
  onWeightChange,
  onResetWeight,
  onHide,
  onBadgeDismiss,
  isDraggable,
  dragHandleProps,
}: CategoryRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Flex
      alignItems="center"
      gap={2}
      p={2}
      bg="bg.subtle"
      borderRadius="sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isDraggable && (
        <Flex
          {...dragHandleProps}
          cursor="grab"
          _active={{ cursor: "grabbing" }}
          color="fg.muted"
          alignItems="center"
        >
          <LuGripVertical size={14} />
        </Flex>
      )}

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
          New
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
          Returned
        </Badge>
      )}

      <WeightPresets
        value={weight}
        onChange={onWeightChange}
        isOverridden={isOverridden}
        onReset={onResetWeight}
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
