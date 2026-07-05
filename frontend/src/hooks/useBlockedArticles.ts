"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchBlockedArticles } from "@/lib/api";
import { ARTICLES_PAGE_SIZE } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";

export function useBlockedArticles() {
  const query = useInfiniteQuery({
    queryKey: queryKeys.articles.blocked,
    queryFn: ({ pageParam }) =>
      fetchBlockedArticles(pageParam, ARTICLES_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      // Rescue invalidates this query (full refetch) rather than surgically
      // removing the rescued item, so the cache always mirrors the server set
      // — the next offset is simply the total item count so far.
      return allPages.reduce((sum, page) => sum + page.items.length, 0);
    },
  });

  const articles = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return { ...query, articles };
}
