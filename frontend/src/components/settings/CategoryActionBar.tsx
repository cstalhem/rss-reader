"use client";

import { ActionBar, Button, Flex, Portal, Text } from "@chakra-ui/react";

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
      {/* Desktop: static header */}
      <Flex
        display={{ base: "none", sm: "flex" }}
        alignItems="center"
        py={2}
        px={3}
        bg="bg.subtle"
        borderRadius="sm"
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
            Move to group
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onUngroup}
          >
            Ungroup
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onHide}
          >
            Hide
          </Button>
          <Button
            variant="outline"
            size="sm"
            colorPalette="red"
            disabled={selectedCount === 0}
            onClick={onDelete}
          >
            Delete
          </Button>
        </Flex>
      </Flex>

      {/* Mobile: floating action bar */}
      <ActionBar.Root open={selectedCount > 0}>
        <Portal>
          <ActionBar.Positioner display={{ base: "block", sm: "none" }}>
            <ActionBar.Content>
              <ActionBar.SelectionTrigger>
                {selectedCount} selected
              </ActionBar.SelectionTrigger>
              <ActionBar.Separator />
              <Button variant="outline" size="sm" onClick={onMoveToGroup}>
                Move to group
              </Button>
              <Button variant="outline" size="sm" onClick={onUngroup}>
                Ungroup
              </Button>
              <Button variant="outline" size="sm" onClick={onHide}>
                Hide
              </Button>
              <Button
                variant="outline"
                size="sm"
                colorPalette="red"
                onClick={onDelete}
              >
                Delete
              </Button>
            </ActionBar.Content>
          </ActionBar.Positioner>
        </Portal>
      </ActionBar.Root>
    </>
  );
}
