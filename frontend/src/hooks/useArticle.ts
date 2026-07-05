"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchArticle } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function useArticle(id: number | null) {
  return useQuery({
    queryKey: queryKeys.articles.detail(id ?? -1),
    queryFn: () => fetchArticle(id as number),
    enabled: id !== null,
  });
}
