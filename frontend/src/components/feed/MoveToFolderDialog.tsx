"use client";

import { useMemo, useState } from "react";
import { Button, Dialog, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { LuFolder, LuPlus } from "react-icons/lu";
import { FeedFolder } from "@/lib/types";

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FeedFolder[];
  onMove: (folderId: number | null) => void;
  onCreateAndMove: (folderName: string) => void;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  onMove,
  onCreateAndMove,
}: MoveToFolderDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const filteredFolders = useMemo(
    () =>
      [...folders]
        .filter((folder) =>
          folder.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.display_order - b.display_order || a.id - b.id),
    [folders, searchQuery]
  );

  const handleClose = () => {
    onOpenChange(false);
    setSearchQuery("");
    setIsCreating(false);
    setNewFolderName("");
  };

  const handleMove = (folderId: number | null) => {
    onMove(folderId);
    handleClose();
  };

  const handleCreate = () => {
    const folderName = newFolderName.trim();
    if (!folderName) return;
    onCreateAndMove(folderName);
    handleClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) handleClose();
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Move to folder</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap={3}>
              <Input
                placeholder="Search folders..."
                size="sm"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              <Stack gap={1} maxH="220px" overflowY="auto">
                <Flex
                  alignItems="center"
                  gap={2}
                  px={3}
                  py={2}
                  borderRadius="sm"
                  cursor="pointer"
                  _hover={{ bg: "bg.subtle" }}
                  onClick={() => handleMove(null)}
                >
                  <Text fontSize="sm">Ungrouped (root level)</Text>
                </Flex>

                {filteredFolders.map((folder) => (
                  <Flex
                    key={folder.id}
                    alignItems="center"
                    gap={2}
                    px={3}
                    py={2}
                    borderRadius="sm"
                    cursor="pointer"
                    _hover={{ bg: "bg.subtle" }}
                    onClick={() => handleMove(folder.id)}
                  >
                    <LuFolder size={16} />
                    <Text fontSize="sm" flex={1}>
                      {folder.name}
                    </Text>
                  </Flex>
                ))}

                {filteredFolders.length === 0 && searchQuery && (
                  <Text fontSize="sm" color="fg.muted" px={3} py={2}>
                    No folders match &quot;{searchQuery}&quot;
                  </Text>
                )}
              </Stack>

              {!isCreating ? (
                <Flex
                  alignItems="center"
                  gap={2}
                  px={3}
                  py={2}
                  borderRadius="sm"
                  cursor="pointer"
                  _hover={{ bg: "bg.subtle" }}
                  borderTopWidth="1px"
                  borderColor="border.subtle"
                  onClick={() => setIsCreating(true)}
                >
                  <LuPlus size={16} />
                  <Text fontSize="sm">Create new folder</Text>
                </Flex>
              ) : (
                <Flex gap={2} borderTopWidth="1px" borderColor="border.subtle" pt={2}>
                  <Input
                    placeholder="Folder name..."
                    size="sm"
                    flex={1}
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleCreate();
                      if (event.key === "Escape") {
                        setIsCreating(false);
                        setNewFolderName("");
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    colorPalette="accent"
                    disabled={!newFolderName.trim()}
                    onClick={handleCreate}
                  >
                    Create
                  </Button>
                </Flex>
              )}
            </Stack>
          </Dialog.Body>
          <Dialog.CloseTrigger />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
