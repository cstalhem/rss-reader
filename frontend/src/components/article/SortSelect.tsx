"use client";

import {
  createListCollection,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
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
    <SelectRoot
      collection={sortOptions}
      size="sm"
      value={[value]}
      onValueChange={(details) => {
        const selectedValue = details.value[0];
        if (selectedValue) {
          onChange(selectedValue as SortOption);
        }
      }}
      width="auto"
      minWidth="160px"
    >
      <SelectTrigger>
        <SelectValueText placeholder="Sort by..." />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.items.map((option) => (
          <SelectItem key={option.value} item={option}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
