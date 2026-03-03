"use client";

import { useState } from "react";
import { Button, Dialog, Field, Flex, Input, Text } from "@chakra-ui/react";
import { useUpdateFeedFolder } from "@/hooks/useFeedFolders";
import { FeedFolder } from "@/lib/types";

interface EditFolderDialogProps {
  folder: FeedFolder;
  onClose: () => void;
}

export function EditFolderDialog({ folder, onClose }: EditFolderDialogProps) {
  const updateFolder = useUpdateFeedFolder();
  const [editedName, setEditedName] = useState(folder.name);
  const [error, setError] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  const hasChanges = editedName.trim() !== folder.name;

  const handleSaveName = async () => {
    const trimmedName = editedName.trim();
    if (!trimmedName) {
      setError("Folder name is required");
      return;
    }

    setError("");

    if (!hasChanges) return;

    try {
      await updateFolder.mutateAsync({
        id: folder.id,
        data: { name: trimmedName },
      });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch {
      setError("Failed to update folder name");
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={({ open }) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="md">
          <Dialog.Header>
            <Dialog.Title>Edit Folder</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body>
            <Flex direction="column" gap={4}>
              <Field.Root invalid={!!error}>
                <Field.Label>Folder Name</Field.Label>
                <Input
                  value={editedName}
                  onChange={(event) => setEditedName(event.target.value)}
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
                  disabled={updateFolder.isPending}
                >
                  {updateFolder.isPending ? "Saving..." : "Save Name"}
                </Button>
              )}

              {nameSaved && (
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
