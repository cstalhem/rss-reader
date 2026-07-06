"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useCategories(needsTriage?: boolean) {
  return useQuery({
    queryKey: queryKeys.categories.list(needsTriage),
    queryFn: () => fetchCategories(needsTriage),
  });
}
