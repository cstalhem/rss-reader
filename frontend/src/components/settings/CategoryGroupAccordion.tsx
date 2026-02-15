"use client";

import { Accordion, Box, Flex, Text, Stack } from "@chakra-ui/react";
import { LuChevronDown } from "react-icons/lu";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { WeightPresets } from "./WeightPresets";
import { CategoryRow } from "./CategoryRow";
import type { CategoryGroup } from "@/lib/types";

interface CategoryGroupAccordionProps {
  group: CategoryGroup;
  topicWeights: Record<string, string> | null;
  onGroupWeightChange: (groupId: string, weight: string) => void;
  onCategoryWeightChange: (category: string, weight: string) => void;
  onResetCategoryWeight: (category: string) => void;
  onHideCategory: (category: string) => void;
  onBadgeDismiss: (category: string) => void;
  newCategories: Set<string>;
  returnedCategories: Set<string>;
  isDragActive?: boolean;
}

export function CategoryGroupAccordion({
  group,
  topicWeights,
  onGroupWeightChange,
  onCategoryWeightChange,
  onResetCategoryWeight,
  onHideCategory,
  onBadgeDismiss,
  newCategories,
  returnedCategories,
  isDragActive,
}: CategoryGroupAccordionProps) {
  const sortedCategories = [...group.categories].sort();

  const { setNodeRef, isOver } = useDroppable({ id: group.id });

  return (
    <Accordion.Item value={group.id}>
      <Flex alignItems="center" justifyContent="space-between">
        <Accordion.ItemTrigger
          cursor={isDragActive ? "default" : "pointer"}
          flex={1}
          py={3}
          px={4}
          _hover={{ bg: isDragActive ? undefined : "bg.muted" }}
          borderRadius="md"
          disabled={isDragActive}
        >
          <Flex alignItems="center" gap={2} flex={1}>
            <Accordion.ItemIndicator>
              <LuChevronDown />
            </Accordion.ItemIndicator>
            <Text fontWeight="semibold" fontSize="sm">
              {group.name}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              ({group.categories.length})
            </Text>
          </Flex>
        </Accordion.ItemTrigger>

        <Flex pr={2}>
          <WeightPresets
            value={group.weight || "normal"}
            onChange={(weight) => onGroupWeightChange(group.id, weight)}
            size="sm"
            onClick={(e) => e.stopPropagation()}
          />
        </Flex>
      </Flex>

      <Accordion.ItemContent>
        <Accordion.ItemBody px={4} pb={3} pt={1}>
          <Box
            ref={setNodeRef}
            bg={isOver ? "bg.muted" : undefined}
            borderRadius="sm"
            transition="background 0.15s"
            p={isOver ? 1 : 0}
          >
            <SortableContext
              items={sortedCategories}
              strategy={verticalListSortingStrategy}
            >
              <Stack gap={1}>
                {sortedCategories.map((category) => {
                  const explicitWeight = topicWeights?.[category];
                  const effectiveWeight =
                    explicitWeight || group.weight || "normal";
                  const isOverridden =
                    !!explicitWeight &&
                    explicitWeight !== (group.weight || "normal");

                  return (
                    <CategoryRow
                      key={category}
                      category={category}
                      weight={effectiveWeight}
                      isOverridden={isOverridden}
                      isNew={newCategories.has(category)}
                      isReturned={returnedCategories.has(category)}
                      onWeightChange={(w) =>
                        onCategoryWeightChange(category, w)
                      }
                      onResetWeight={() => onResetCategoryWeight(category)}
                      onHide={() => onHideCategory(category)}
                      onBadgeDismiss={() => onBadgeDismiss(category)}
                    />
                  );
                })}
              </Stack>
            </SortableContext>
          </Box>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  );
}
