"use client";

import {
  Portal,
  Select,
} from "@chakra-ui/react";
import { SortOption } from "@/lib/types";
import { ARTICLE_SORT_OPTIONS } from "./viewConfig";

interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <Select.Root
      collection={ARTICLE_SORT_OPTIONS}
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
            {ARTICLE_SORT_OPTIONS.items.map((option) => (
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
