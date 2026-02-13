"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { fetchArticle } from "@/lib/api";
import { Article } from "@/lib/types";

/**
 * Tracks articles that just finished scoring while viewing the Scoring tab.
 *
 * When an article disappears from query results (scored by LLM), this hook
 * immediately retains it with its previous data (no render gap), then fetches
 * the updated data (with score + categories) and holds it for 3 seconds so
 * the UI can animate the transition before the article leaves the list.
 *
 * Uses useLayoutEffect to detect disappearances before the browser paints,
 * preventing any visible flash when articles transition out.
 */
export function useCompletingArticles(
  currentArticles: Article[] | undefined,
  isActive: boolean
) {
  const prevArticlesRef = useRef<Map<number, Article>>(new Map());
  const detectedRef = useRef<Set<number>>(new Set());
  const [completing, setCompleting] = useState<Map<number, Article>>(new Map());

  useLayoutEffect(() => {
    if (!isActive || !currentArticles) {
      prevArticlesRef.current = new Map();
      detectedRef.current = new Set();
      setCompleting(new Map());
      return;
    }

    const currentIds = new Set(currentArticles.map((a) => a.id));
    const prevMap = prevArticlesRef.current;

    // Skip first render — nothing to compare against
    if (prevMap.size === 0) {
      prevArticlesRef.current = new Map(currentArticles.map((a) => [a.id, a]));
      return;
    }

    // Detect articles that just disappeared from the scoring tab
    for (const [id, article] of prevMap) {
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

        // Remove after 3 seconds (matches CSS animation duration)
        setTimeout(() => {
          detectedRef.current.delete(id);
          setCompleting((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        }, 3000);
      }
    }

    prevArticlesRef.current = new Map(currentArticles.map((a) => [a.id, a]));
  }, [currentArticles, isActive]);

  return {
    completingArticles: Array.from(completing.values()),
    completingIds: new Set(completing.keys()),
  };
}
