"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPreferences } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function usePreferences() {
  return useQuery({
    queryKey: queryKeys.preferences.detail,
    queryFn: fetchPreferences,
  });
}
