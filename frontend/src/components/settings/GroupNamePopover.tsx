"use client";

import { useState } from "react";
import { Button, Input, Popover, Portal, Stack } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";

interface GroupNamePopoverProps {
  selectedCount: number;
  onCreateGroup: (name: string) => void;
  isDisabled: boolean;
  existingNames: string[];
}

export function GroupNamePopover({
  selectedCount,
  onCreateGroup,
  isDisabled,
  existingNames,
}: GroupNamePopoverProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    if (
      existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())
    ) {
      setError("A group with this name already exists");
      return;
    }
    onCreateGroup(trimmed);
    setName("");
    setError("");
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreate();
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={({ open: isOpen }) => {
        setOpen(isOpen);
        if (!isOpen) {
          setName("");
          setError("");
        }
      }}
    >
      <Popover.Trigger asChild>
        <Button size="sm" variant="outline" disabled={isDisabled}>
          Group selected ({selectedCount})
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Body>
              <Stack gap={3}>
                <Field label="Group name" invalid={!!error} errorText={error}>
                  <Input
                    placeholder="e.g., Programming"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError("");
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    size="sm"
                  />
                </Field>
                <Button size="sm" onClick={handleCreate}>
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
