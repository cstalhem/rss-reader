"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFolder } from "@/lib/api";
import { invalidateFeedTree } from "@/lib/invalidation";
import type { FeedFolderCreatePayload } from "@/lib/types";

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: FeedFolderCreatePayload) => createFolder(payload),
    onSuccess: () => {
      // `feed_ids` may move feeds into the new folder — refresh both trees.
      invalidateFeedTree(queryClient);
    },
    meta: { errorTitle: "Failed to create folder" },
  });
}
