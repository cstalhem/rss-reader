"use client";

import { Dialog, Button, Text } from "@chakra-ui/react";

interface DeleteGroupDialogProps {
  groupName: string | null;
  categoryCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteGroupDialog({
  groupName,
  categoryCount,
  onConfirm,
  onCancel,
}: DeleteGroupDialogProps) {
  if (!groupName) return null;

  const handleConfirm = () => {
    onConfirm();
    onCancel();
  };

  return (
    <Dialog.Root
      open={!!groupName}
      onOpenChange={({ open }) => !open && onCancel()}
      placement="center"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Delete Group</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body>
            <Text>
              Delete group <strong>{groupName}</strong>?{" "}
              {categoryCount > 0
                ? `The ${categoryCount} ${categoryCount === 1 ? "category" : "categories"} in this group will be moved back to the ungrouped list. Their individual weight overrides will be preserved.`
                : "This group is empty."}
            </Text>
          </Dialog.Body>

          <Dialog.Footer>
            <Dialog.ActionTrigger asChild>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </Dialog.ActionTrigger>
            <Button colorPalette="red" onClick={handleConfirm}>
              Delete
            </Button>
          </Dialog.Footer>

          <Dialog.CloseTrigger />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
