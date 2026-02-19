"use client";

import { Box, Button, Collapsible, Flex, Stack, Text } from "@chakra-ui/react";
import { LuChevronRight } from "react-icons/lu";
import { Category } from "@/lib/types";

interface HiddenCategoriesSectionProps {
  hiddenCategories: Category[];
  onUnhide: (categoryId: number) => void;
}

export function HiddenCategoriesSection({
  hiddenCategories,
  onUnhide,
}: HiddenCategoriesSectionProps) {
  if (hiddenCategories.length === 0) return null;

  return (
    <Collapsible.Root>
      <Collapsible.Trigger asChild>
        <Flex
          alignItems="center"
          gap={2}
          cursor="pointer"
          py={2}
          px={3}
          borderRadius="sm"
          _hover={{ bg: "bg.muted" }}
          transition="background 0.15s"
        >
          <Collapsible.Indicator
            transition="transform 0.2s"
            _open={{ transform: "rotate(90deg)" }}
          >
            <LuChevronRight size={14} />
          </Collapsible.Indicator>
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
            Hidden ({hiddenCategories.length})
          </Text>
        </Flex>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Stack gap={1}>
          {hiddenCategories.map((category) => (
            <Flex
              key={category.id}
              alignItems="center"
              py={2}
              px={3}
              bg="bg.subtle"
              borderRadius="sm"
            >
              <Text fontSize="sm" color="fg.muted">
                {category.display_name}
              </Text>
              <Box flex={1} />
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onUnhide(category.id)}
              >
                Unhide
              </Button>
            </Flex>
          ))}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
