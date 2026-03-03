"use client";

import { Dialog, Button } from "@chakra-ui/react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (details: { open: boolean }) => void;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  confirmColorPalette?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  confirmColorPalette = "red",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>{body}</Dialog.Body>
          <Dialog.Footer>
            <Dialog.ActionTrigger asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.ActionTrigger>
            <Button colorPalette={confirmColorPalette} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
