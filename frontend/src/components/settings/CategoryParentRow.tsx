"use client";

import { useState } from "react";
import { Flex, Text, Box } from "@chakra-ui/react";
import { LuFolder } from "react-icons/lu";
import { useDroppable } from "@dnd-kit/core";
import { WeightPresets } from "./WeightPresets";

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
}

export function CategoryParentRow({
  category,
  weight,
  childCount,
  onWeightChange,
  isDndEnabled = false,
  activeId,
}: CategoryParentRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `parent:${category}`,
    disabled: !isDndEnabled,
  });

  return (
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

      <Text fontSize="sm" fontWeight="semibold" flex={1} truncate>
        {toTitleCase(category)}
      </Text>

      <Text fontSize="xs" color="fg.muted">
        ({childCount})
      </Text>

      <WeightPresets value={weight} onChange={onWeightChange} size="sm" />

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
  );
}
