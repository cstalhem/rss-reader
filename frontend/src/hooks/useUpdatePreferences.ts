"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePreferences } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { PreferencesUpdate } from "@/lib/types";

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: PreferencesUpdate) => updatePreferences(update),
    onSuccess: (data, variables) => {
      // Write the authoritative PUT response straight to cache so the interests
      // form's remount-reset (keyed on updated_at) is deterministic and doesn't
      // hinge on a follow-up refetch that could fail.
      queryClient.setQueryData(queryKeys.preferences.detail, data);
      // Only interests/anti-interests changes trigger a server-side rescore, so
      // wake the scoring chip only for those — a dwell-only save leaves scoring
      // untouched and shouldn't refetch it.
      if (
        variables.interests !== undefined ||
        variables.anti_interests !== undefined
      ) {
        queryClient.invalidateQueries({ queryKey: queryKeys.scoring.status });
      }
    },
    meta: { errorTitle: "Couldn't save your preferences" },
  });
}
