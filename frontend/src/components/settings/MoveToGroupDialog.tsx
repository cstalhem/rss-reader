"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  Flex,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuFolder, LuPlus } from "react-icons/lu";
import { Category } from "@/lib/types";

interface MoveToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootCategories: Category[];
  childrenMap: Record<number, Category[]>;
  selectedCount: number;
  onMove: (targetParentId: number) => void;
  onCreate: (groupName: string) => void;
}

export function MoveToGroupDialog({
  open,
  onOpenChange,
  rootCategories,
  childrenMap,
  selectedCount,
  onMove,
  onCreate,
}: MoveToGroupDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const filtered = rootCategories
    .filter((p) => p.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aIsGroup = (childrenMap[a.id]?.length ?? 0) > 0;
      const bIsGroup = (childrenMap[b.id]?.length ?? 0) > 0;
      if (aIsGroup !== bIsGroup) return aIsGroup ? -1 : 1;
      return a.display_name.localeCompare(b.display_name);
    });

  const handleClose = () => {
    onOpenChange(false);
    setSearchQuery("");
    setIsCreating(false);
    setNewGroupName("");
  };

  const handleMove = (parentId: number) => {
    onMove(parentId);
    handleClose();
  };

  const handleCreate = () => {
    const name = newGroupName.trim();
    if (!name) return;
    onCreate(name);
    handleClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) handleClose();
      }}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Move to group</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <Input
                  placeholder="Search categories..."
                  size="sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <Stack gap={1} maxH="240px" overflowY="auto">
                  {filtered.map((parent) => {
                    const childCount = childrenMap[parent.id]?.length ?? 0;
                    const isGroup = childCount > 0;

                    return (
                      <Flex
                        key={parent.id}
                        alignItems="center"
                        gap={2}
                        px={3}
                        py={2}
                        borderRadius="sm"
                        cursor="pointer"
                        _hover={{ bg: "bg.subtle" }}
                        onClick={() => handleMove(parent.id)}
                      >
                        {isGroup ? <LuFolder size={16} /> : null}
                        <Text fontSize="sm" flex={1}>
                          {parent.display_name}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {childCount}
                        </Text>
                      </Flex>
                    );
                  })}

                  {filtered.length === 0 && searchQuery && (
                    <Text fontSize="sm" color="fg.muted" px={3} py={2}>
                      No categories match &quot;{searchQuery}&quot;
                    </Text>
                  )}
                </Stack>

                {/* Create new group option */}
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
                    <Text fontSize="sm">Create new group</Text>
                  </Flex>
                ) : (
                  <Flex
                    gap={2}
                    borderTopWidth="1px"
                    borderColor="border.subtle"
                    pt={2}
                  >
                    <Input
                      placeholder="Group name..."
                      size="sm"
                      flex={1}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreate();
                        if (e.key === "Escape") {
                          setIsCreating(false);
                          setNewGroupName("");
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      colorPalette="accent"
                      disabled={!newGroupName.trim()}
                      onClick={handleCreate}
                    >
                      Create
                    </Button>
                  </Flex>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Text fontSize="xs" color="fg.muted">
                {selectedCount} {selectedCount === 1 ? "category" : "categories"} selected
              </Text>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
    </Dialog.Root>
  );
}
