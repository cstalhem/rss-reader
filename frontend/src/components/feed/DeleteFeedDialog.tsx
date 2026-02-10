"use client";

import { Dialog, Button, Text } from "@chakra-ui/react";
import { Feed } from "@/lib/types";

interface DeleteFeedDialogProps {
  feed: Feed | null;
  onClose: () => void;
  onConfirm: (feedId: number) => void;
}

export function DeleteFeedDialog({
  feed,
  onClose,
  onConfirm,
}: DeleteFeedDialogProps) {
  if (!feed) return null;

  const handleConfirm = () => {
    onConfirm(feed.id);
    onClose();
  };

  return (
    <Dialog.Root open={!!feed} onOpenChange={({ open }) => !open && onClose()} placement="center">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Remove Feed</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body>
            <Text>
              Remove <strong>{feed.title}</strong>? This will delete all articles
              from this feed.
            </Text>
          </Dialog.Body>

          <Dialog.Footer>
            <Dialog.ActionTrigger asChild>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </Dialog.ActionTrigger>
            <Button colorPalette="red" onClick={handleConfirm}>
              Remove
            </Button>
          </Dialog.Footer>

          <Dialog.CloseTrigger />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
