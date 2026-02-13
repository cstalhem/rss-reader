"use client";

import { useRef, useState, useEffect } from "react";
import { fetchArticle } from "@/lib/api";
import { Article } from "@/lib/types";

/**
 * Tracks articles that just finished scoring while viewing the Scoring tab.
 * When an article disappears from query results (scored by LLM), this hook
 * fetches its updated data and holds it for 3 seconds so the UI can animate
 * the transition before the article leaves the list.
 */
export function useCompletingArticles(
  currentArticles: Article[] | undefined,
  isActive: boolean
) {
  const prevIdsRef = useRef<Set<number>>(new Set());
  const [completing, setCompleting] = useState<Map<number, Article>>(new Map());

  useEffect(() => {
    if (!isActive || !currentArticles) {
      prevIdsRef.current = new Set();
      setCompleting(new Map());
      return;
    }

    const currentIds = new Set(currentArticles.map((a) => a.id));
    const prevIds = prevIdsRef.current;

    // Skip first render — nothing to compare against
    if (prevIds.size === 0) {
      prevIdsRef.current = currentIds;
      return;
    }

    // Detect articles that just disappeared from the scoring tab
    const disappeared: number[] = [];
    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        disappeared.push(id);
      }
    }

    // Fetch updated article data (now has score + categories) and hold it
    for (const id of disappeared) {
      fetchArticle(id).then((article) => {
        if (article.scoring_state === "scored") {
          setCompleting((prev) => new Map(prev).set(id, article));

          // Remove after 3 seconds (matches CSS animation duration)
          setTimeout(() => {
            setCompleting((prev) => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
          }, 3000);
        }
      });
    }

    prevIdsRef.current = currentIds;
  }, [currentArticles, isActive]);

  return {
    completingArticles: Array.from(completing.values()),
    completingIds: new Set(completing.keys()),
  };
}
