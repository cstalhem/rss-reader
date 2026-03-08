"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { ArticleListItem } from "@/lib/types";

type BufferState = {
  snapshot: Set<number> | null;
  prevIsBuffering: boolean;
  prevResetKey: unknown;
  prevLimit: number;
  prevArticles: ArticleListItem[] | undefined;
  prevArticleIds: Set<number> | null;
};

/**
 * Pure state transition function — computes next buffer state from previous
 * state and current props. Returns the same reference if nothing changed
 * (critical for avoiding infinite re-render loops when used with setState
 * during render).
 */
function computeBufferState(
  prev: BufferState,
  articles: ArticleListItem[] | undefined,
  isBuffering: boolean,
  resetKey: unknown,
  limit: number,
): BufferState {
  const justActivated = isBuffering && !prev.prevIsBuffering;
  const justDeactivated = !isBuffering && prev.prevIsBuffering;
  const resetKeyChanged = isBuffering && resetKey !== prev.prevResetKey;

  let snapshot = prev.snapshot;

  // Take or reset snapshot (only when articles are loaded — avoid empty snapshot)
  if (justActivated || resetKeyChanged) {
    snapshot = articles ? new Set(articles.map((a) => a.id)) : null;
  }

  // Deferred snapshot: buffering activated before articles loaded, take snapshot now
  if (isBuffering && !snapshot && articles) {
    snapshot = new Set(articles.map((a) => a.id));
  }

  // Pagination: limit increased while buffering — add only the newly paginated IDs
  if (isBuffering && snapshot && limit > prev.prevLimit && articles) {
    const prevIds = prev.prevArticleIds;
    if (prevIds) {
      let cloned = false;
      for (const a of articles) {
        if (!prevIds.has(a.id)) {
          if (!cloned) {
            snapshot = new Set(snapshot);
            cloned = true;
          }
          snapshot.add(a.id);
        }
      }
    }
  }

  // Deactivation
  if (justDeactivated) {
    snapshot = null;
  }

  // Update prev-tracking only when articles are loaded — an intermediate
  // undefined render (TanStack Query key change) would swallow the limit bump.
  let prevArticleIds = prev.prevArticleIds;
  let prevArticles = prev.prevArticles;
  let prevLimit = prev.prevLimit;

  if (articles) {
    prevLimit = limit;
    if (articles !== prev.prevArticles) {
      prevArticleIds = new Set(articles.map((a) => a.id));
      prevArticles = articles;
    }
  }

  // Return same reference if nothing changed (prevents infinite re-render)
  if (
    snapshot === prev.snapshot &&
    isBuffering === prev.prevIsBuffering &&
    resetKey === prev.prevResetKey &&
    prevLimit === prev.prevLimit &&
    prevArticleIds === prev.prevArticleIds
  ) {
    return prev;
  }

  return {
    snapshot,
    prevIsBuffering: isBuffering,
    prevResetKey: resetKey,
    prevLimit,
    prevArticles,
    prevArticleIds,
  };
}

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
  const [bufferState, setBufferState] = useState<BufferState>(() => ({
    snapshot: null,
    prevIsBuffering: false,
    prevResetKey: resetKey,
    prevLimit: limit,
    prevArticles: undefined,
    prevArticleIds: null,
  }));

  // Compute next state during render (React-supported pattern for derived state)
  const nextState = computeBufferState(bufferState, articles, isBuffering, resetKey, limit);
  if (nextState !== bufferState) {
    setBufferState(nextState);
  }

  // Filter articles against snapshot in useMemo
  const { displayArticles, newCount } = useMemo(() => {
    if (!isBuffering || !nextState.snapshot || !articles) {
      return { displayArticles: articles, newCount: 0 };
    }
    const snapshot = nextState.snapshot;
    const display: ArticleListItem[] = [];
    let count = 0;
    for (const a of articles) {
      if (snapshot.has(a.id)) display.push(a);
      else count++;
    }
    return { displayArticles: display, newCount: count };
  }, [articles, isBuffering, nextState.snapshot]);

  // articlesRef for flush — write in effect, read in callback (both allowed by lint)
  const articlesRef = useRef(articles);
  useEffect(() => {
    articlesRef.current = articles;
  });

  const flush = useCallback(() => {
    setBufferState((prev) => ({
      ...prev,
      snapshot: new Set(articlesRef.current?.map((a) => a.id)),
    }));
  }, []);

  return { displayArticles, newCount, flush };
}
