"use client";

import { useState } from "react";
import {
  ActionBar,
  Button,
  Flex,
  IconButton,
  Popover,
  Portal,
  SegmentGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  LuArrowDownWideNarrow,
  LuArrowUpDown,
  LuArrowUpNarrowWide,
  LuCheckCheck,
  LuFilter,
} from "react-icons/lu";
import type { FilterTab, SortOption } from "@/lib/types";
import {
  ARTICLE_FILTER_LABELS,
  ARTICLE_SORT_LABELS,
  getArticleFilterActionLabel,
} from "./viewConfig";

interface MobileArticleActionBarProps {
  filter: FilterTab;
  onFilterChange: (filter: FilterTab) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  onMarkAllRead: () => void;
  canMarkAllRead: boolean;
  isMarkingRead: boolean;
  scoringCount: number;
  blockedCount: number;
}

export function MobileArticleActionBar({
  filter,
  onFilterChange,
  sortOption,
  onSortChange,
  onMarkAllRead,
  canMarkAllRead,
  isMarkingRead,
  scoringCount,
  blockedCount,
}: MobileArticleActionBarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filterCounts = { unreadCount: 0, scoringCount, blockedCount };

  return (
    <ActionBar.Root open={true} closeOnInteractOutside={false}>
      <Portal>
        <ActionBar.Positioner display={{ base: "block", md: "none" }} px={4}>
          <ActionBar.Content borderRadius="full">
            {canMarkAllRead && (
              <>
                <IconButton
                  aria-label="Mark all as read"
                  size="sm"
                  variant="ghost"
                  onClick={onMarkAllRead}
                  disabled={isMarkingRead}
                >
                  <LuCheckCheck />
                </IconButton>
                <ActionBar.Separator />
              </>
            )}

            {/* Filter popover */}
            <Popover.Root
              positioning={{ placement: "top" }}
              open={filterOpen}
              onOpenChange={(e) => setFilterOpen(e.open)}
            >
              <Popover.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={ARTICLE_FILTER_LABELS[filter]}
                >
                  <LuFilter />
                  {ARTICLE_FILTER_LABELS[filter]}
                </Button>
              </Popover.Trigger>
              <Portal>
                <Popover.Positioner>
                  <Popover.Content width="auto">
                    <Popover.Body p={2}>
                      <SegmentGroup.Root
                        size="sm"
                        value={filter}
                        onValueChange={(e) =>
                          onFilterChange(e.value as FilterTab)
                        }
                        onClick={() => setFilterOpen(false)}
                      >
                        <SegmentGroup.Indicator />
                        <SegmentGroup.Item value="unread">
                          <SegmentGroup.ItemText>
                            {ARTICLE_FILTER_LABELS.unread}
                          </SegmentGroup.ItemText>
                          <SegmentGroup.ItemHiddenInput />
                        </SegmentGroup.Item>
                        <SegmentGroup.Item value="all">
                          <SegmentGroup.ItemText>
                            {ARTICLE_FILTER_LABELS.all}
                          </SegmentGroup.ItemText>
                          <SegmentGroup.ItemHiddenInput />
                        </SegmentGroup.Item>
                        <SegmentGroup.Item
                          value="scoring"
                          disabled={scoringCount === 0}
                        >
                          <SegmentGroup.ItemText>
                            {getArticleFilterActionLabel("scoring", filterCounts)}
                          </SegmentGroup.ItemText>
                          <SegmentGroup.ItemHiddenInput />
                        </SegmentGroup.Item>
                        <SegmentGroup.Item
                          value="blocked"
                          disabled={blockedCount === 0}
                        >
                          <SegmentGroup.ItemText>
                            {getArticleFilterActionLabel("blocked", filterCounts)}
                          </SegmentGroup.ItemText>
                          <SegmentGroup.ItemHiddenInput />
                        </SegmentGroup.Item>
                      </SegmentGroup.Root>
                    </Popover.Body>
                  </Popover.Content>
                </Popover.Positioner>
              </Portal>
            </Popover.Root>

            <ActionBar.Separator />

            {/* Sort popover */}
            <Popover.Root
              positioning={{ placement: "top" }}
              open={sortOpen}
              onOpenChange={(e) => setSortOpen(e.open)}
              lazyMount
              unmountOnExit
            >
              <Popover.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={ARTICLE_SORT_LABELS[sortOption]}
                >
                  <LuArrowUpDown />
                  {ARTICLE_SORT_LABELS[sortOption]}
                </Button>
              </Popover.Trigger>
              <Portal>
                <Popover.Positioner>
                  <Popover.Content minW="64">
                    <Popover.Body p={3}>
                      <Stack gap={2}>
                        <Text fontSize="xs" fontWeight="medium" color="fg.muted">
                          By score
                        </Text>
                        <SegmentGroup.Root
                          size="sm"
                          value={
                            sortOption === "score_desc" ||
                            sortOption === "score_asc"
                              ? sortOption
                              : ""
                          }
                          onValueChange={(e) =>
                            onSortChange(e.value as SortOption)
                          }
                          onClick={() => setSortOpen(false)}
                        >
                          <SegmentGroup.Indicator />
                          <SegmentGroup.Item value="score_desc" flex={1}>
                            <SegmentGroup.ItemText>
                              <Flex align="center" gap={1}>
                                <LuArrowDownWideNarrow /> Highest
                              </Flex>
                            </SegmentGroup.ItemText>
                            <SegmentGroup.ItemHiddenInput />
                          </SegmentGroup.Item>
                          <SegmentGroup.Item value="score_asc" flex={1}>
                            <SegmentGroup.ItemText>
                              <Flex align="center" gap={1}>
                                <LuArrowUpNarrowWide /> Lowest
                              </Flex>
                            </SegmentGroup.ItemText>
                            <SegmentGroup.ItemHiddenInput />
                          </SegmentGroup.Item>
                        </SegmentGroup.Root>

                        <Text fontSize="xs" fontWeight="medium" color="fg.muted">
                          By date
                        </Text>
                        <SegmentGroup.Root
                          size="sm"
                          value={
                            sortOption === "date_desc" ||
                            sortOption === "date_asc"
                              ? sortOption
                              : ""
                          }
                          onValueChange={(e) =>
                            onSortChange(e.value as SortOption)
                          }
                          onClick={() => setSortOpen(false)}
                        >
                          <SegmentGroup.Indicator />
                          <SegmentGroup.Item value="date_desc" flex={1}>
                            <SegmentGroup.ItemText>
                              <Flex align="center" gap={1}>
                                <LuArrowDownWideNarrow /> Newest
                              </Flex>
                            </SegmentGroup.ItemText>
                            <SegmentGroup.ItemHiddenInput />
                          </SegmentGroup.Item>
                          <SegmentGroup.Item value="date_asc" flex={1}>
                            <SegmentGroup.ItemText>
                              <Flex align="center" gap={1}>
                                <LuArrowUpNarrowWide /> Oldest
                              </Flex>
                            </SegmentGroup.ItemText>
                            <SegmentGroup.ItemHiddenInput />
                          </SegmentGroup.Item>
                        </SegmentGroup.Root>
                      </Stack>
                    </Popover.Body>
                  </Popover.Content>
                </Popover.Positioner>
              </Portal>
            </Popover.Root>
          </ActionBar.Content>
        </ActionBar.Positioner>
      </Portal>
    </ActionBar.Root>
  );
}
