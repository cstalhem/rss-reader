"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  Field,
  Flex,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuCheck, LuFolderPlus } from "react-icons/lu";
import { useFeeds } from "@/hooks/useFeeds";
import { useCreateFeedFolder } from "@/hooks/useFeedFolders";

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateFolderDialog({
  isOpen,
  onClose,
}: CreateFolderDialogProps) {
  const { data: feeds } = useFeeds();
  const createFolder = useCreateFeedFolder();

  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFeedIds, setSelectedFeedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const ungroupedFeeds = useMemo(
    () =>
      (feeds ?? [])
        .filter((feed) => feed.folder_id === null)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [feeds]
  );

  const filteredFeeds = useMemo(
    () =>
      ungroupedFeeds.filter((feed) =>
        feed.title.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [ungroupedFeeds, searchQuery]
  );

  const resetState = () => {
    setName("");
    setSearchQuery("");
    setSelectedFeedIds(new Set());
    setError("");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const toggleFeedSelection = (feedId: number) => {
    setSelectedFeedIds((previous) => {
      const next = new Set(previous);
      if (next.has(feedId)) next.delete(feedId);
      else next.add(feedId);
      return next;
    });
  };

  const handleSubmit = async () => {
    setError("");

    const folderName = name.trim();
    if (!folderName) {
      setError("Folder name is required");
      return;
    }

    try {
      await createFolder.mutateAsync({
        name: folderName,
        feedIds: Array.from(selectedFeedIds),
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={({ open }) => !open && handleClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Create folder</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body>
            <Stack gap={4}>
              <Field.Root invalid={!!error}>
                <Field.Label>Folder name</Field.Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Engineering"
                  autoFocus
                />
                {error && <Field.ErrorText>{error}</Field.ErrorText>}
              </Field.Root>

              <Stack gap={2}>
                <Flex alignItems="center" justifyContent="space-between">
                  <Text fontSize="sm" fontWeight="medium">
                    Add ungrouped feeds (optional)
                  </Text>
                  {selectedFeedIds.size > 0 && (
                    <Badge colorPalette="accent">{selectedFeedIds.size} selected</Badge>
                  )}
                </Flex>

                <Input
                  placeholder="Search feeds..."
                  size="sm"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />

                <Stack
                  gap={1}
                  maxH="220px"
                  overflowY="auto"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderRadius="md"
                  p={1}
                >
                  {filteredFeeds.map((feed) => {
                    const isSelected = selectedFeedIds.has(feed.id);
                    return (
                      <Flex
                        key={feed.id}
                        alignItems="center"
                        justifyContent="space-between"
                        px={3}
                        py={2}
                        borderRadius="sm"
                        cursor="pointer"
                        bg={isSelected ? "accent.subtle" : "transparent"}
                        _hover={{ bg: isSelected ? "accent.subtle" : "bg.subtle" }}
                        onClick={() => toggleFeedSelection(feed.id)}
                      >
                        <Text fontSize="sm" truncate>
                          {feed.title}
                        </Text>
                        {isSelected ? <LuCheck size={16} /> : null}
                      </Flex>
                    );
                  })}

                  {filteredFeeds.length === 0 && (
                    <Text fontSize="sm" color="fg.muted" px={3} py={2}>
                      {ungroupedFeeds.length === 0
                        ? "No ungrouped feeds available"
                        : `No feeds match \"${searchQuery}\"`}
                    </Text>
                  )}
                </Stack>
              </Stack>
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              colorPalette="accent"
              onClick={handleSubmit}
              disabled={!name.trim()}
              loading={createFolder.isPending}
            >
              <LuFolderPlus />
              Create folder
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
