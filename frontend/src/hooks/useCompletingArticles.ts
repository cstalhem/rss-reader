"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { fetchArticle } from "@/lib/api";
import { ArticleListItem } from "@/lib/types";

const COMPLETING_ARTICLE_DURATION = 3_000;

/**
 * Tracks articles that just finished scoring while viewing the Scoring tab.
 *
 * When an article disappears from query results (scored by LLM), this hook
 * immediately retains it with its previous data (no render gap), then fetches
 * the updated data (with score + categories) and holds it for 3 seconds so
 * the UI can animate the transition before the article leaves the list.
 *
 * Returns a merged display list that preserves article positions — completing
 * articles stay where they were instead of jumping around.
 *
 * Uses useLayoutEffect to detect disappearances before the browser paints.
 */
export function useCompletingArticles(
  currentArticles: ArticleListItem[] | undefined,
  isActive: boolean
) {
  const prevOrderRef = useRef<number[]>([]);
  const prevDataRef = useRef<Map<number, ArticleListItem>>(new Map());
  const detectedRef = useRef<Set<number>>(new Set());
  const [completing, setCompleting] = useState<Map<number, ArticleListItem>>(new Map());

  useLayoutEffect(() => {
    if (!isActive || !currentArticles) {
      prevOrderRef.current = [];
      prevDataRef.current = new Map();
      detectedRef.current = new Set();
      setCompleting(new Map());
      return;
    }

    const currentIds = new Set(currentArticles.map((a) => a.id));
    const prevData = prevDataRef.current;

    // Skip first render — nothing to compare against
    if (prevData.size === 0) {
      prevOrderRef.current = currentArticles.map((a) => a.id);
      prevDataRef.current = new Map(currentArticles.map((a) => [a.id, a]));
      return;
    }

    // Detect articles that just disappeared from the scoring tab
    for (const [id, article] of prevData) {
      if (!currentIds.has(id) && !detectedRef.current.has(id)) {
        detectedRef.current.add(id);

        // Immediately add OLD article data (before browser paints — no visual gap)
        setCompleting((prev) => new Map(prev).set(id, article));

        // Fetch updated data (now has score + categories) to show in animation
        fetchArticle(id).then((updated) => {
          if (updated.scoring_state === "scored") {
            setCompleting((prev) => new Map(prev).set(id, updated));
          }
        });

        // Remove after animation completes (matches CSS animation duration)
        setTimeout(() => {
          detectedRef.current.delete(id);
          setCompleting((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        }, COMPLETING_ARTICLE_DURATION);
      }
    }

    // Update refs — preserve order including completing articles
    prevDataRef.current = new Map(currentArticles.map((a) => [a.id, a]));
    // Don't overwrite order — keep completing article positions intact
    // Only add new articles that appeared since last render
    const prevOrderSet = new Set(prevOrderRef.current);
    const newOrder = [...prevOrderRef.current];
    for (const article of currentArticles) {
      if (!prevOrderSet.has(article.id)) {
        newOrder.push(article.id);
      }
    }
    prevOrderRef.current = newOrder;
  }, [currentArticles, isActive]);

  // Build merged display list preserving original positions
  const completingIds = new Set(completing.keys());

  let displayArticles: ArticleListItem[] | undefined;
  if (!currentArticles) {
    displayArticles = completing.size > 0 ? Array.from(completing.values()) : undefined;
  } else if (completing.size === 0) {
    displayArticles = currentArticles;
  } else {
    const currentMap = new Map(currentArticles.map((a) => [a.id, a]));
    const result: ArticleListItem[] = [];

    // Walk stored order to preserve positions
    for (const id of prevOrderRef.current) {
      if (currentMap.has(id)) {
        result.push(currentMap.get(id)!);
      } else if (completing.has(id)) {
        result.push(completing.get(id)!);
      }
    }

    // Add any new articles not yet in order
    const seen = new Set(prevOrderRef.current);
    for (const article of currentArticles) {
      if (!seen.has(article.id)) {
        result.push(article);
      }
    }

    displayArticles = result;
  }

  return {
    displayArticles,
    completingIds,
  };
}
