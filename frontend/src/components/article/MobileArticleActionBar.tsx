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

const filterLabels: Record<FilterTab, string> = {
  unread: "Unread",
  all: "All",
  scoring: "Scoring",
  blocked: "Blocked",
};

const sortLabels: Record<SortOption, string> = {
  score_desc: "Highest score",
  score_asc: "Lowest score",
  date_desc: "Newest first",
  date_asc: "Oldest first",
};

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
                <Button variant="ghost" size="sm" aria-label={filterLabels[filter]}>
                  <LuFilter />
                  {filterLabels[filter]}
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
                          <SegmentGroup.ItemText>Unread</SegmentGroup.ItemText>
                          <SegmentGroup.ItemHiddenInput />
                        </SegmentGroup.Item>
                        <SegmentGroup.Item value="all">
                          <SegmentGroup.ItemText>All</SegmentGroup.ItemText>
                          <SegmentGroup.ItemHiddenInput />
                        </SegmentGroup.Item>
                        <SegmentGroup.Item
                          value="scoring"
                          disabled={scoringCount === 0}
                        >
                          <SegmentGroup.ItemText>
                            Scoring{scoringCount > 0 ? ` (${scoringCount})` : ""}
                          </SegmentGroup.ItemText>
                          <SegmentGroup.ItemHiddenInput />
                        </SegmentGroup.Item>
                        <SegmentGroup.Item
                          value="blocked"
                          disabled={blockedCount === 0}
                        >
                          <SegmentGroup.ItemText>
                            Blocked{blockedCount > 0 ? ` (${blockedCount})` : ""}
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
                <Button variant="ghost" size="sm" aria-label={sortLabels[sortOption]}>
                  <LuArrowUpDown />
                  {sortLabels[sortOption]}
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
