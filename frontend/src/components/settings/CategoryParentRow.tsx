"use client";

import { useState } from "react";
import { Flex, Text, Box } from "@chakra-ui/react";
import { LuFolder } from "react-icons/lu";
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
}

export function CategoryParentRow({
  category,
  weight,
  childCount,
  onWeightChange,
}: CategoryParentRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Flex
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
      <LuFolder size={16} color="var(--chakra-colors-fg-muted)" />

      <Text fontSize="sm" fontWeight="semibold" flex={1} truncate>
        {toTitleCase(category)}
      </Text>

      <Text fontSize="xs" color="fg.muted">
        ({childCount})
      </Text>

      <WeightPresets value={weight} onChange={onWeightChange} size="sm" />
    </Flex>
  );
}
