"use client";

import { Button, Dialog, Portal, Text, Flex } from "@chakra-ui/react";

interface DeleteCategoryDialogProps {
  categoryName: string | null;
  childCount: number;
  isParent: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteCategoryDialog({
  categoryName,
  childCount,
  isParent,
  onConfirm,
  onCancel,
}: DeleteCategoryDialogProps) {
  return (
    <Dialog.Root open={categoryName !== null} onOpenChange={onCancel}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Delete Category</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {isParent && childCount > 0 ? (
                <Text>
                  Delete parent category <strong>{categoryName ?? ""}</strong>?
                  The {childCount} child {childCount === 1 ? "category" : "categories"} will be
                  released to the root level. Their individual weight overrides will be preserved.
                </Text>
              ) : (
                <Text>
                  Delete category <strong>{categoryName ?? ""}</strong>?
                  If the LLM discovers this category again, it will reappear.
                </Text>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap={3}>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline" size="sm" onClick={onCancel}>
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  size="sm"
                  onClick={() => {
                    onConfirm();
                  }}
                >
                  Delete
                </Button>
              </Flex>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
