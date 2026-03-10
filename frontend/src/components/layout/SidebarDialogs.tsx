"use client";

import { DeleteFeedDialog } from "@/components/feed/DeleteFeedDialog";
import { MoveToFolderDialog } from "@/components/feed/MoveToFolderDialog";
import type { Feed, FeedFolder } from "@/lib/types";

interface SidebarDialogsProps {
  feedToDelete: Feed | null;
  feedToMove: Feed | null;
  folders: FeedFolder[];
  onCloseDelete: () => void;
  onConfirmDelete: (feedId: number) => void;
  onCreateAndMove: (folderName: string) => Promise<void>;
  onMove: (folderId: number | null) => void;
  onOpenMoveChange: (open: boolean) => void;
}

export function SidebarDialogs({
  feedToDelete,
  feedToMove,
  folders,
  onCloseDelete,
  onConfirmDelete,
  onCreateAndMove,
  onMove,
  onOpenMoveChange,
}: SidebarDialogsProps) {
  return (
    <>
      <DeleteFeedDialog
        feed={feedToDelete}
        onClose={onCloseDelete}
        onConfirm={onConfirmDelete}
      />
      <MoveToFolderDialog
        open={!!feedToMove}
        onOpenChange={onOpenMoveChange}
        folders={folders}
        onMove={onMove}
        onCreateAndMove={onCreateAndMove}
      />
    </>
  );
}
