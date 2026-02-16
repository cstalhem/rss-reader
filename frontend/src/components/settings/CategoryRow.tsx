"use client";

import { memo, useState } from "react";
import { Flex, Text, Badge, IconButton, Checkbox, Box } from "@chakra-ui/react";
import { LuGripVertical, LuX } from "react-icons/lu";
import { Draggable } from "@hello-pangea/dnd";
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
  index?: number;
}

export const CategoryRow = memo(function CategoryRow({
  category,
  weight,
  isOverridden,
  isNew,
  isReturned,
  onWeightChange,
  onResetWeight,
  onHide,
  onBadgeDismiss,
  showCheckbox,
  isChecked,
  onCheckChange,
  index = 0,
}: CategoryRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Draggable draggableId={category} index={index}>
      {(provided, snapshot) => (
    <Flex
      ref={provided.innerRef}
      {...provided.draggableProps}
      alignItems="center"
      gap={2}
      p={2}
      bg="bg.subtle"
      borderRadius="sm"
      _hover={{ bg: "bg.muted" }}
      transition="background 0.15s, opacity 0.15s"
      style={{
        ...provided.draggableProps.style,
        opacity: snapshot.isDragging ? 0.5 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showCheckbox && (
        <Checkbox.Root
          size="sm"
          checked={isChecked}
          onCheckedChange={(e) => onCheckChange?.(!!e.checked)}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      )}

      <Flex
        {...provided.dragHandleProps}
        cursor="grab"
        _active={{ cursor: "grabbing" }}
        color="fg.muted"
        alignItems="center"
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
      )}
    </Draggable>
  );
});
