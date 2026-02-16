"use client";

import { memo, useState, useRef, useEffect } from "react";
import {
  Accordion,
  Box,
  Flex,
  Text,
  Stack,
  IconButton,
} from "@chakra-ui/react";
import { LuChevronDown, LuPencil, LuTrash2 } from "react-icons/lu";
import { Droppable } from "@hello-pangea/dnd";
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
  onRenameGroup: (groupId: string, newName: string) => void;
  onDeleteGroup: (groupId: string) => void;
  newCategories: Set<string>;
  returnedCategories: Set<string>;
  isDragActive?: boolean;
  activeId?: string | null;
  sourceContainer?: string | null;
}

export const CategoryGroupAccordion = memo(function CategoryGroupAccordion({
  group,
  topicWeights,
  onGroupWeightChange,
  onCategoryWeightChange,
  onResetCategoryWeight,
  onHideCategory,
  onBadgeDismiss,
  onRenameGroup,
  onDeleteGroup,
  newCategories,
  returnedCategories,
  isDragActive,
  activeId,
  sourceContainer,
}: CategoryGroupAccordionProps) {
  const sortedCategories = [...group.categories].sort();

  // Hover state for edit/delete button reveal
  const [isHovered, setIsHovered] = useState(false);

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== group.name) {
      onRenameGroup(group.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setRenameValue(group.name);
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  };

  return (
    <Droppable droppableId={group.id} type="CATEGORY">
      {(provided, snapshot) => {
        const isOver = snapshot.isDraggingOver;
        const showPlaceholder =
          isOver &&
          activeId &&
          sourceContainer !== group.id &&
          !group.categories.includes(activeId);

        return (
          <Accordion.Item
            value={group.id}
            ref={provided.innerRef}
            {...provided.droppableProps}
            bg={isOver ? "bg.muted" : undefined}
            transition="background 0.15s"
          >
            <Flex
              alignItems="center"
              justifyContent="space-between"
              borderRadius="md"
              _hover={{
                bg: isDragActive || isRenaming ? undefined : "bg.muted",
              }}
              transition="background 0.15s"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <Accordion.ItemTrigger
                cursor={isDragActive || isRenaming ? "default" : "pointer"}
                flex={1}
                py={3}
                px={4}
                borderRadius="md"
                disabled={isDragActive || isRenaming}
              >
                <Flex alignItems="center" gap={2} flex={1}>
                  <Accordion.ItemIndicator>
                    <LuChevronDown />
                  </Accordion.ItemIndicator>
                  {isRenaming ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        background: "transparent",
                        border:
                          "1px solid var(--chakra-colors-border-subtle)",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        color: "inherit",
                      }}
                    />
                  ) : (
                    <Text fontWeight="semibold" fontSize="sm">
                      {group.name}
                    </Text>
                  )}
                  <Text fontSize="xs" color="fg.muted">
                    ({group.categories.length})
                  </Text>
                </Flex>
              </Accordion.ItemTrigger>

              <Flex pr={2} gap={1} alignItems="center">
                <WeightPresets
                  value={group.weight || "normal"}
                  onChange={(weight) => onGroupWeightChange(group.id, weight)}
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                />
                <IconButton
                  aria-label="Rename group"
                  size="xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameValue(group.name);
                    setIsRenaming(true);
                  }}
                  opacity={{ base: 1, md: isHovered ? 1 : 0 }}
                  transition="opacity 0.15s"
                >
                  <LuPencil size={14} />
                </IconButton>
                <IconButton
                  aria-label="Delete group"
                  size="xs"
                  variant="ghost"
                  colorPalette="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteGroup(group.id);
                  }}
                  opacity={{ base: 1, md: isHovered ? 1 : 0 }}
                  transition="opacity 0.15s"
                >
                  <LuTrash2 size={14} />
                </IconButton>
              </Flex>
            </Flex>

            <Accordion.ItemContent>
              <Accordion.ItemBody px={4} pb={3} pt={1}>
                <Stack gap={1}>
                  {sortedCategories.map((category, index) => {
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
                        index={index}
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
                {provided.placeholder}
              </Accordion.ItemBody>
            </Accordion.ItemContent>

            {showPlaceholder && (
              <Box
                borderWidth="1px"
                borderStyle="dashed"
                borderColor="border.subtle"
                borderRadius="sm"
                p={2}
                mx={4}
                mb={2}
                bg="bg.muted"
                opacity={0.5}
              >
                <Text fontSize="sm" color="fg.muted">
                  {activeId
                    ?.split("-")
                    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </Text>
              </Box>
            )}
          </Accordion.Item>
        );
      }}
    </Droppable>
  );
});
