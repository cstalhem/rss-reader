"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchArticles } from "@/lib/api";
import { ARTICLES_PAGE_SIZE } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import type { FeedSelection, ReadFilter } from "@/lib/types";

export function useArticles(selection: FeedSelection, filter: ReadFilter) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.articles.list(selection, filter),
    queryFn: ({ pageParam }) =>
      fetchArticles(selection, filter, pageParam, ARTICLES_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      // The server query is filtered by read state and re-evaluated per
      // request: items whose read state flips (mark-read in the unread view,
      // mark-unread in the read view) leave the server's result set but stay
      // in our cache (rows dim in place), so the next offset is the number of
      // cached items that still match the active filter — not the raw cache
      // length, which would overshoot and skip matching articles that shifted down.
      return allPages.reduce(
        (sum, page) =>
          sum +
          page.items.filter((item) =>
            filter === "read" ? item.is_read : !item.is_read,
          ).length,
        0,
      );
    },
  });

  const articles = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return { ...query, articles };
}
