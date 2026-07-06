"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePreferences } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { PreferencesUpdate } from "@/lib/types";

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: PreferencesUpdate) => updatePreferences(update),
    onSuccess: (data) => {
      // Write the authoritative PUT response straight to cache so the interests
      // form's remount-reset (keyed on updated_at) is deterministic and doesn't
      // hinge on a follow-up refetch that could fail. Interests/anti-interests
      // changes trigger a server-side rescore, so wake the scoring chip too.
      queryClient.setQueryData(queryKeys.preferences.detail, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.scoring.status });
    },
    meta: { errorTitle: "Couldn't save your interests" },
  });
}
