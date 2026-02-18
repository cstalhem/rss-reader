"use client";

import { Button, Dialog, Portal, Text, Flex } from "@chakra-ui/react";

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  categoryName: string | null;
  isParent: boolean;
  childCount: number;
  onConfirm: () => void;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  count,
  categoryName,
  isParent,
  childCount,
  onConfirm,
}: DeleteCategoryDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {count > 1 ? "Delete Categories" : "Delete Category"}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {count > 1 ? (
                <Text>
                  Delete {count} categories? This cannot be undone. If the LLM
                  discovers them again, they will reappear.
                </Text>
              ) : isParent && childCount > 0 ? (
                <Text>
                  Delete parent category{" "}
                  <strong>{categoryName ?? ""}</strong>? The {childCount} child{" "}
                  {childCount === 1 ? "category" : "categories"} will be
                  released to the root level. Their individual weight overrides
                  will be preserved.
                </Text>
              ) : (
                <Text>
                  Delete category <strong>{categoryName ?? ""}</strong>? If the
                  LLM discovers this category again, it will reappear.
                </Text>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap={3}>
                <Dialog.ActionTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  size="sm"
                  onClick={onConfirm}
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
