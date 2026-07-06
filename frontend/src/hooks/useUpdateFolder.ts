"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFolder } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { FeedFolderUpdatePayload } from "@/lib/types";

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FeedFolderUpdatePayload }) =>
      updateFolder(id, data),
    onSuccess: () => {
      // Feeds embed `folder_name` — a rename must refresh both trees.
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.feedFolders.all });
    },
    meta: { errorTitle: "Failed to update folder" },
  });
}
