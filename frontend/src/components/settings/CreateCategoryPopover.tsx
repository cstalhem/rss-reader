"use client";

import { useState } from "react";
import { Button, Input, Popover, Portal, Stack } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import { Field } from "@/components/ui/field";

interface CreateCategoryPopoverProps {
  onCreateCategory: (name: string) => void;
  existingCategories: string[];
}

export function CreateCategoryPopover({
  onCreateCategory,
  existingCategories,
}: CreateCategoryPopoverProps) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const normalizedExisting = existingCategories.map((c) => c.toLowerCase());

  const isDuplicate = normalizedExisting.includes(name.trim().toLowerCase());
  const isEmpty = name.trim().length === 0;
  const isInvalid = isEmpty || isDuplicate;

  const handleCreate = () => {
    if (isInvalid) return;
    onCreateCategory(name.trim().toLowerCase().replace(/\s+/g, "-"));
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
        <Button size="sm" variant="outline">
          <LuPlus />
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
                    placeholder="e.g., machine-learning"
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
