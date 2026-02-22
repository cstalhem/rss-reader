"use client";

import { useState } from "react";
import { Button, Input, Popover, Portal, Stack } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import { Field } from "@/components/ui/field";
import { Category } from "@/lib/types";

interface CreateCategoryPopoverProps {
  onCreateCategory: (displayName: string) => void;
  existingCategories: Category[];
}

export function CreateCategoryPopover({
  onCreateCategory,
  existingCategories,
}: CreateCategoryPopoverProps) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const isDuplicate = existingCategories.some(
    (c) => c.display_name.toLowerCase() === name.trim().toLowerCase()
  );
  const isEmpty = name.trim().length === 0;
  const isInvalid = isEmpty || isDuplicate;

  const handleCreate = () => {
    if (isInvalid) return;
    onCreateCategory(name.trim());
    setName("");
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      positioning={{ placement: "bottom-start" }}
    >
      <Popover.Trigger asChild>
        <Button colorPalette="accent" size="sm">
          <LuPlus size={16} />
          Add Category
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Arrow />
            <Popover.Body>
              <Stack gap={4}>
                <Field
                  label="Category Name"
                  invalid={!isEmpty && isDuplicate}
                  errorText={isDuplicate ? "Category already exists" : undefined}
                >
                  <Input
                    placeholder="e.g., Machine Learning"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isInvalid) {
                        handleCreate();
                      }
                    }}
                    autoFocus
                    size="sm"
                  />
                </Field>
                <Button
                  size="sm"
                  colorPalette="accent"
                  disabled={isInvalid}
                  onClick={handleCreate}
                >
                  Create
                </Button>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
