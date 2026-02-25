"use client";

import { useState } from "react";
import { Button, Dialog, Field, Flex, Input, Text } from "@chakra-ui/react";
import { useUpdateFeed } from "@/hooks/useFeedMutations";
import { Feed } from "@/lib/types";

interface EditFeedDialogProps {
  feed: Feed;
  onClose: () => void;
}

export function EditFeedDialog({ feed, onClose }: EditFeedDialogProps) {
  const updateFeed = useUpdateFeed();
  const [editedTitle, setEditedTitle] = useState(feed.title);
  const [error, setError] = useState("");
  const [titleSaved, setTitleSaved] = useState(false);

  const hasChanges = editedTitle.trim() !== feed.title;

  const handleSaveName = async () => {
    const trimmedTitle = editedTitle.trim();
    if (!trimmedTitle) {
      setError("Feed name is required");
      return;
    }

    setError("");

    if (!hasChanges) return;

    try {
      await updateFeed.mutateAsync({
        id: feed.id,
        data: { title: trimmedTitle },
      });
      setTitleSaved(true);
      setTimeout(() => setTitleSaved(false), 2000);
    } catch {
      setError("Failed to update feed name");
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={({ open }) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="md">
          <Dialog.Header>
            <Dialog.Title>Edit Feed</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body>
            <Flex direction="column" gap={4}>
              <Field.Root invalid={!!error}>
                <Field.Label>Feed Name</Field.Label>
                <Input
                  value={editedTitle}
                  onChange={(event) => setEditedTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveName();
                    }
                  }}
                  autoFocus
                />
                {error && <Field.ErrorText>{error}</Field.ErrorText>}
              </Field.Root>

              {hasChanges && (
                <Button
                  size="sm"
                  colorPalette="accent"
                  onClick={() => void handleSaveName()}
                  disabled={updateFeed.isPending}
                >
                  {updateFeed.isPending ? "Saving..." : "Save Name"}
                </Button>
              )}

              {titleSaved && (
                <Text fontSize="sm" color="fg.success">
                  Name saved!
                </Text>
              )}

              <Flex justifyContent="flex-end" gap={2} mt={2}>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button colorPalette="accent" onClick={onClose}>
                  Done
                </Button>
              </Flex>
            </Flex>
          </Dialog.Body>

          <Dialog.CloseTrigger />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
