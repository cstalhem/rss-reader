"use client";

import { ActionBar, Button, Flex, Portal, Text } from "@chakra-ui/react";
import {
  LuEyeOff,
  LuIndentDecrease,
  LuListTree,
  LuTrash2,
} from "react-icons/lu";

interface CategoryActionBarProps {
  selectedCount: number;
  onMoveToGroup: () => void;
  onUngroup: () => void;
  onHide: () => void;
  onDelete: () => void;
}

export function CategoryActionBar({
  selectedCount,
  onMoveToGroup,
  onUngroup,
  onHide,
  onDelete,
}: CategoryActionBarProps) {
  return (
    <>
      {/* Desktop: sticky header */}
      <Flex
        display={{ base: "none", sm: "flex" }}
        alignItems="center"
        py={2}
        px={3}
        bg="bg.subtle"
        borderRadius="sm"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        position="sticky"
        top={0}
        zIndex={1}
      >
        <Text fontSize="sm" color="fg.muted">
          {selectedCount > 0 ? `${selectedCount} selected` : "Select categories to act on them"}
        </Text>
        <Flex flex={1} />
        <Flex gap={2}>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onMoveToGroup}
          >
            <LuListTree /> Move to group
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onUngroup}
          >
            <LuIndentDecrease /> Ungroup
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onHide}
          >
            <LuEyeOff /> Hide
          </Button>
          <Button
            variant="outline"
            size="sm"
            colorPalette="red"
            disabled={selectedCount === 0}
            onClick={onDelete}
          >
            <LuTrash2 /> Delete
          </Button>
        </Flex>
      </Flex>

      {/* Mobile: floating pill action bar */}
      <ActionBar.Root open={selectedCount > 0}>
        <Portal>
          <ActionBar.Positioner display={{ base: "block", sm: "none" }} px={4}>
            <ActionBar.Content
              borderRadius="2xl"
              css={{ flexDirection: "column", alignItems: "stretch", gap: 0, py: 4 }}
            >
              <Text fontSize="xs" color="fg.muted" px={3} pb={1.5}>
                {selectedCount} selected
              </Text>
              <Flex gap={1} px={2} flexWrap="wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  colorPalette="red"
                  onClick={onDelete}
                  flex="1 1 40%"
                >
                  <LuTrash2 /> Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={onHide} flex="1 1 40%">
                  <LuEyeOff /> Hide
                </Button>
                <Button variant="ghost" size="sm" onClick={onUngroup} flex="1 1 40%">
                  <LuIndentDecrease /> Ungroup
                </Button>
                <Button variant="ghost" size="sm" onClick={onMoveToGroup} flex="1 1 40%">
                  <LuListTree /> Group
                </Button>
              </Flex>
            </ActionBar.Content>
          </ActionBar.Positioner>
        </Portal>
      </ActionBar.Root>
    </>
  );
}
