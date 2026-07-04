"use client";

import { useCallback } from "react";
import { IconButton, Menu, Portal } from "@chakra-ui/react";
import {
  LuEllipsisVertical,
  LuIndentDecrease,
  LuPencil,
  LuTrash2,
} from "react-icons/lu";

interface CategoryContextMenuProps {
  type: "parent" | "child" | "ungrouped";
  onUngroup?: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function CategoryContextMenu({
  type,
  onUngroup,
  onRename,
  onDelete,
}: CategoryContextMenuProps) {
  const handleSelect = useCallback(
    (details: { value: string }) => {
      const actions: Record<string, (() => void) | undefined> = {
        ungroup: onUngroup,
        rename: onRename,
        delete: onDelete,
      };
      actions[details.value]?.();
    },
    [onUngroup, onRename, onDelete],
  );

  return (
    <Menu.Root lazyMount unmountOnExit immediate onSelect={handleSelect}>
      <Menu.Trigger asChild>
        <IconButton
          aria-label="Category actions"
          size="xs"
          variant="ghost"
          onClick={(e) => e.stopPropagation()}
        >
          <LuEllipsisVertical size={14} />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {type === "parent" && (
              <Menu.Item value="ungroup">
                <LuIndentDecrease />
                Ungroup
              </Menu.Item>
            )}
            <Menu.Item value="rename">
              <LuPencil />
              Edit name
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item value="delete" color="fg.error">
              <LuTrash2 />
              Delete
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
