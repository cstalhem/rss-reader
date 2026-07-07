"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFolder } from "@/lib/api";
import { invalidateFeedTree } from "@/lib/invalidation";
import type { FeedFolderUpdatePayload } from "@/lib/types";

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FeedFolderUpdatePayload }) =>
      updateFolder(id, data),
    onSuccess: () => {
      // Feeds embed `folder_name` — a rename must refresh both trees.
      invalidateFeedTree(queryClient);
    },
    meta: { errorTitle: "Failed to update folder" },
  });
}
