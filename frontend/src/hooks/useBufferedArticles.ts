"use client";

import { useRef, useState, useCallback } from "react";
import type { ArticleListItem } from "@/lib/types";

export function useBufferedArticles(
  articles: ArticleListItem[] | undefined,
  isBuffering: boolean,
  resetKey: unknown,
  limit: number,
): {
  displayArticles: ArticleListItem[] | undefined;
  newCount: number;
  flush: () => void;
} {
  const snapshotRef = useRef<Set<number> | null>(null);
  const prevBufferingRef = useRef(false);
  const prevResetKeyRef = useRef(resetKey);
  const prevLimitRef = useRef(limit);
  const prevArticleIdsRef = useRef<Set<number> | null>(null);
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const [, setFlushCounter] = useState(0);

  // Detect transitions
  const justActivated = isBuffering && !prevBufferingRef.current;
  const justDeactivated = !isBuffering && prevBufferingRef.current;
  const resetKeyChanged = isBuffering && resetKey !== prevResetKeyRef.current;

  prevBufferingRef.current = isBuffering;
  prevResetKeyRef.current = resetKey;

  // Take or reset snapshot (only when articles are loaded — avoid empty snapshot)
  if (justActivated || resetKeyChanged) {
    snapshotRef.current = articles ? new Set(articles.map((a) => a.id)) : null;
  }
  // Deferred snapshot: buffering activated before articles loaded, take snapshot now
  if (isBuffering && !snapshotRef.current && articles) {
    snapshotRef.current = new Set(articles.map((a) => a.id));
  }
  // Pagination: limit increased while buffering — add only the newly paginated IDs
  if (isBuffering && snapshotRef.current && limit > prevLimitRef.current && articles) {
    const prev = prevArticleIdsRef.current;
    for (const a of articles) {
      if (prev && !prev.has(a.id)) {
        snapshotRef.current.add(a.id);
      }
    }
  }
  // Only update prev-tracking refs when articles are loaded — an intermediate
  // undefined render (TanStack Query key change) would swallow the limit bump.
  if (articles) {
    prevLimitRef.current = limit;
    prevArticleIdsRef.current = new Set(articles.map((a) => a.id));
  }

  if (justDeactivated) {
    snapshotRef.current = null;
  }

  const flush = useCallback(() => {
    snapshotRef.current = new Set(articlesRef.current?.map((a) => a.id));
    setFlushCounter((c) => c + 1);
  }, []);

  // Passthrough when not buffering or data not yet loaded
  if (!isBuffering || !snapshotRef.current || !articles) {
    return { displayArticles: articles, newCount: 0, flush };
  }

  // Filter and count in single pass
  const snapshot = snapshotRef.current;
  const displayArticles: ArticleListItem[] = [];
  let newCount = 0;
  if (articles) {
    for (const a of articles) {
      if (snapshot.has(a.id)) displayArticles.push(a);
      else newCount++;
    }
  }

  return { displayArticles, newCount, flush };
}
