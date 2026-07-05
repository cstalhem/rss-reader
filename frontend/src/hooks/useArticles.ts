"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchArticles } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { FeedSelection } from "@/lib/types";

const ARTICLES_PAGE_SIZE = 25;

export function useArticles(selection: FeedSelection) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.articles.list(selection),
    queryFn: ({ pageParam }) =>
      fetchArticles(selection, pageParam, ARTICLES_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.reduce((sum, page) => sum + page.items.length, 0);
    },
  });

  const articles = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return { ...query, articles };
}
