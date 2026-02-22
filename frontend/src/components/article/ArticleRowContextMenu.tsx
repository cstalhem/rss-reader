"use client";

import { IconButton, Menu, Portal } from "@chakra-ui/react";
import {
  LuEllipsisVertical,
  LuMailOpen,
  LuExternalLink,
  LuRefreshCw,
} from "react-icons/lu";
import { ArticleListItem } from "@/lib/types";

interface ArticleRowContextMenuProps {
  article: ArticleListItem;
  onMarkUnread: () => void;
  onRescore: () => void;
}

export function ArticleRowContextMenu({
  article,
  onMarkUnread,
  onRescore,
}: ArticleRowContextMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          aria-label="Article actions"
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
            <Menu.Item value="mark-unread" onClick={onMarkUnread}>
              <LuMailOpen />
              Mark unread
            </Menu.Item>
            <Menu.Item
              value="open-original"
              onClick={() => window.open(article.url, "_blank", "noopener")}
            >
              <LuExternalLink />
              Open original
            </Menu.Item>
            <Menu.Item value="rescore" onClick={onRescore}>
              <LuRefreshCw />
              Rescore
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
