"use client";

import {
  createListCollection,
  Portal,
  Select,
} from "@chakra-ui/react";
import { SortOption } from "@/lib/types";

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const sortOptions = createListCollection({
  items: [
    { label: "Highest score", value: "score_desc" },
    { label: "Lowest score", value: "score_asc" },
    { label: "Newest first", value: "date_desc" },
    { label: "Oldest first", value: "date_asc" },
  ],
});

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Select.Root
      collection={sortOptions}
      size="sm"
      value={[value]}
      onValueChange={(details) => {
        const selectedValue = details.value[0];
        if (selectedValue) {
          onChange(selectedValue as SortOption);
        }
      }}
      positioning={{ sameWidth: true }}
      width="auto"
      minWidth="160px"
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder="Sort by..." />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content>
            {sortOptions.items.map((option) => (
              <Select.Item key={option.value} item={option}>
                {option.label}
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  );
}
