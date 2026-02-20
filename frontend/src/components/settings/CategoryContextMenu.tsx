"use client";

import { IconButton, Menu, Portal } from "@chakra-ui/react";
import {
  LuEllipsisVertical,
  LuEyeOff,
  LuIndentDecrease,
  LuPencil,
  LuTrash2,
  LuUndo2,
} from "react-icons/lu";

interface CategoryContextMenuProps {
  type: "parent" | "child" | "ungrouped";
  isWeightOverridden?: boolean;
  onUngroup?: () => void;
  onResetWeight?: () => void;
  onRename: () => void;
  onHide: () => void;
  onDelete: () => void;
}

export function CategoryContextMenu({
  type,
  isWeightOverridden,
  onUngroup,
  onResetWeight,
  onRename,
  onHide,
  onDelete,
}: CategoryContextMenuProps) {
  return (
    <Menu.Root>
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
              <Menu.Item value="ungroup" onClick={onUngroup}>
                <LuIndentDecrease />
                Ungroup
              </Menu.Item>
            )}
            {type === "child" && (
              <Menu.Item
                value="reset-weight"
                disabled={!isWeightOverridden}
                onClick={onResetWeight}
              >
                <LuUndo2 />
                Reset weight
              </Menu.Item>
            )}
            <Menu.Item value="rename" onClick={onRename}>
              <LuPencil />
              Edit name
            </Menu.Item>
            <Menu.Item value="hide" onClick={onHide}>
              <LuEyeOff />
              Hide
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item value="delete" color="fg.error" onClick={onDelete}>
              <LuTrash2 />
              Delete
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
