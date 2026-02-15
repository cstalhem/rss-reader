"use client";

import { Accordion, Flex, Text, Stack } from "@chakra-ui/react";
import { LuChevronDown } from "react-icons/lu";
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
}: CategoryGroupAccordionProps) {
  const sortedCategories = [...group.categories].sort();

  return (
    <Accordion.Item value={group.id}>
      <Flex alignItems="center" justifyContent="space-between">
        <Accordion.ItemTrigger
          cursor="pointer"
          flex={1}
          py={3}
          px={4}
          _hover={{ bg: "bg.muted" }}
          borderRadius="md"
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
          <Stack gap={1}>
            {sortedCategories.map((category) => {
              const explicitWeight = topicWeights?.[category];
              const effectiveWeight =
                explicitWeight || group.weight || "normal";
              const isOverridden =
                !!explicitWeight && explicitWeight !== (group.weight || "normal");

              return (
                <CategoryRow
                  key={category}
                  category={category}
                  weight={effectiveWeight}
                  isOverridden={isOverridden}
                  isNew={newCategories.has(category)}
                  isReturned={returnedCategories.has(category)}
                  onWeightChange={(w) => onCategoryWeightChange(category, w)}
                  onResetWeight={() => onResetCategoryWeight(category)}
                  onHide={() => onHideCategory(category)}
                  onBadgeDismiss={() => onBadgeDismiss(category)}
                />
              );
            })}
          </Stack>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  );
}
