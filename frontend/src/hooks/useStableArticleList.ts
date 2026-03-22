"use client";

import {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import type { ArticleListItem } from "@/lib/types";

export interface StableListResult {
  displayArticles: ArticleListItem[] | undefined;
  pendingCount: number;
  exitingIds: Set<number>;
  flush: () => void;
}

type EntryStatus = "active" | "pending" | "exiting";

type StableEntry = {
  article: ArticleListItem;
  status: EntryStatus;
};

type StableState = {
  entries: Map<number, StableEntry>;
  order: number[];
  pendingOrder: number[];
  newlyExiting: number[];
  prevEnabled: boolean;
  prevResetKey: unknown;
  prevLimit: number;
  prevArticles: ArticleListItem[] | undefined;
  prevArticleIds: Set<number> | null;
};

function createEmptyState(
  enabled: boolean,
  resetKey: unknown,
  limit: number,
): StableState {
  return {
    entries: new Map(),
    order: [],
    pendingOrder: [],
    newlyExiting: [],
    prevEnabled: enabled,
    prevResetKey: resetKey,
    prevLimit: limit,
    prevArticles: undefined,
    prevArticleIds: null,
  };
}

function buildFromArticles(
  articles: ArticleListItem[],
  enabled: boolean,
  resetKey: unknown,
  limit: number,
): StableState {
  const entries = new Map<number, StableEntry>();
  const order: number[] = [];
  for (const a of articles) {
    entries.set(a.id, { article: a, status: "active" });
    order.push(a.id);
  }
  return {
    entries,
    order,
    pendingOrder: [],
    newlyExiting: [],
    prevEnabled: enabled,
    prevResetKey: resetKey,
    prevLimit: limit,
    prevArticles: articles,
    prevArticleIds: new Set(articles.map((a) => a.id)),
  };
}

function computeNextState(
  prev: StableState,
  articles: ArticleListItem[] | undefined,
  enabled: boolean,
  additions: "buffer" | "immediate",
  removals: "retain" | { animate: number } | "drop",
  resetKey: unknown,
  limit: number,
): StableState {
  // 1a. DEACTIVATION
  if (!enabled && prev.prevEnabled) {
    return createEmptyState(false, resetKey, limit);
  }

  // 1b. RESET KEY CHANGE while enabled
  if (enabled && resetKey !== prev.prevResetKey) {
    if (articles) {
      return buildFromArticles(articles, enabled, resetKey, limit);
    }
    return createEmptyState(enabled, resetKey, limit);
  }

  // 1c. NOT ENABLED — passthrough
  if (!enabled) {
    // Track resetKey/limit changes even while disabled
    if (resetKey !== prev.prevResetKey || limit !== prev.prevLimit) {
      return { ...prev, prevResetKey: resetKey, prevLimit: limit };
    }
    return prev;
  }

  // 1d. NO ARTICLES — waiting for data
  if (!articles) {
    return prev;
  }

  // 2. INITIALIZATION — enabled, entries empty, articles arrived
  if (prev.entries.size === 0) {
    return buildFromArticles(articles, enabled, resetKey, limit);
  }

  // 3. BUILD FRESH LOOKUP
  const freshMap = new Map<number, ArticleListItem>();
  for (const a of articles) {
    freshMap.set(a.id, a);
  }

  let changed = false;
  let entries = prev.entries;
  let order = prev.order;
  let pendingOrder = prev.pendingOrder;
  const newlyExiting: number[] = [];

  // Helper to clone entries lazily
  const ensureEntriesMutable = () => {
    if (entries === prev.entries) {
      entries = new Map(prev.entries);
      changed = true;
    }
  };

  const ensureOrderMutable = () => {
    if (order === prev.order) {
      order = [...prev.order];
      changed = true;
    }
  };

  const ensurePendingOrderMutable = () => {
    if (pendingOrder === prev.pendingOrder) {
      pendingOrder = [...prev.pendingOrder];
      changed = true;
    }
  };

  // 4. DETECT ADDITIONS
  const isPagination = limit > prev.prevLimit && prev.prevArticleIds;

  for (const a of articles) {
    if (!prev.entries.has(a.id)) {
      // Check if also not in already-mutated entries (avoid double-add)
      if (entries !== prev.entries && entries.has(a.id)) continue;

      if (isPagination) {
        // 4a. PAGINATION — only IDs not in prevArticleIds are pagination additions
        if (!prev.prevArticleIds!.has(a.id)) {
          ensureEntriesMutable();
          ensureOrderMutable();
          entries.set(a.id, { article: a, status: "active" });
          order.push(a.id);
        } else {
          // Was in prevArticleIds but not in entries — shouldn't happen per plan
          // but treat as buffer/immediate addition for safety
          if (additions === "buffer") {
            ensureEntriesMutable();
            ensurePendingOrderMutable();
            entries.set(a.id, { article: a, status: "pending" });
            pendingOrder.push(a.id);
          } else {
            ensureEntriesMutable();
            ensureOrderMutable();
            entries.set(a.id, { article: a, status: "active" });
            order.push(a.id);
          }
        }
      } else {
        // 4b. NON-PAGINATION
        if (additions === "buffer") {
          ensureEntriesMutable();
          ensurePendingOrderMutable();
          entries.set(a.id, { article: a, status: "pending" });
          pendingOrder.push(a.id);
        } else {
          ensureEntriesMutable();
          ensureOrderMutable();
          entries.set(a.id, { article: a, status: "active" });
          order.push(a.id);
        }
      }
    }
  }

  // 5. DETECT REMOVALS — active entries not in freshMap
  for (const [id, entry] of prev.entries) {
    if (entry.status === "active" && !freshMap.has(id)) {
      if (removals === "retain") {
        // Keep with cached data, status stays "active" — no change needed
      } else if (typeof removals === "object") {
        // animate
        ensureEntriesMutable();
        entries.set(id, { ...entry, status: "exiting" });
        newlyExiting.push(id);
      } else {
        // drop
        ensureEntriesMutable();
        entries.delete(id);
        ensureOrderMutable();
        order = order.filter((oid) => oid !== id);
      }
    }
  }

  // 6. REFRESH CACHED DATA — update article data for entries still in freshMap
  for (const [id, entry] of prev.entries) {
    if (freshMap.has(id)) {
      const fresh = freshMap.get(id)!;
      if (fresh !== entry.article) {
        ensureEntriesMutable();
        entries.set(id, { ...entry, article: fresh });
      }
    }
  }

  // 7. UPDATE TRACKING
  let prevArticles = prev.prevArticles;
  let prevArticleIds = prev.prevArticleIds;
  let prevLimit = prev.prevLimit;

  if (articles) {
    prevLimit = limit;
    if (articles !== prev.prevArticles) {
      prevArticleIds = new Set(articles.map((a) => a.id));
      prevArticles = articles;
      changed = true;
    } else if (limit !== prev.prevLimit) {
      changed = true;
    }
  }

  // 8. SAME-REFERENCE CHECK
  if (!changed && newlyExiting.length === 0) {
    return prev;
  }

  return {
    entries,
    order,
    pendingOrder,
    newlyExiting,
    prevEnabled: enabled,
    prevResetKey: resetKey,
    prevLimit,
    prevArticles,
    prevArticleIds,
  };
}

const EMPTY_SET = new Set<number>();

export function useStableArticleList(
  articles: ArticleListItem[] | undefined,
  enabled: boolean,
  additions: "buffer" | "immediate",
  removals: "retain" | { animate: number } | "drop",
  resetKey: unknown,
  limit: number,
  onExiting?: (
    id: number,
    updateEntry: (article: ArticleListItem) => void,
  ) => void,
): StableListResult {
  // State ref — updated synchronously during render, no setState needed.
  // This eliminates setState-during-render which can trigger React's
  // "Too many re-renders" bailout in components with multiple concurrent
  // setState-during-render patterns.
  const stateRef = useRef<StableState>(
    createEmptyState(false, resetKey, limit),
  );

  // Version counter — only incremented by async mutations (timers, flush,
  // updateEntry) that need to trigger a re-render. The pure state transition
  // (computeNextState) runs during render and writes to the ref directly.
  const [, setVersion] = useState(0);
  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  // Phase A — pure state transition during render (writes to ref, no setState)
  const prevState = stateRef.current;
  const nextState = computeNextState(
    prevState,
    articles,
    enabled,
    additions,
    removals,
    resetKey,
    limit,
  );
  stateRef.current = nextState;

  // Timer ref (Phase B)
  const timersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const clearAllTimers = useCallback(() => {
    for (const timerId of timersRef.current.values()) {
      clearTimeout(timerId);
    }
    timersRef.current.clear();
  }, []);

  // Phase B — side effects
  useLayoutEffect(() => {
    // Timer cleanup on deactivation
    if (!nextState.prevEnabled && prevState.prevEnabled) {
      clearAllTimers();
    }
    // Timer cleanup on resetKey change
    if (nextState.prevResetKey !== prevState.prevResetKey) {
      clearAllTimers();
    }

    // Schedule timers for newly exiting articles
    if (nextState.newlyExiting.length > 0 && typeof removals === "object") {
      const duration = removals.animate;
      for (const id of nextState.newlyExiting) {
        const timerId = setTimeout(() => {
          timersRef.current.delete(id);
          // Mutate ref + bump version to trigger re-render
          const prev = stateRef.current;
          const nextEntries = new Map(prev.entries);
          nextEntries.delete(id);
          const nextOrder = prev.order.filter((oid) => oid !== id);
          stateRef.current = { ...prev, entries: nextEntries, order: nextOrder, newlyExiting: [] };
          bumpVersion();
        }, duration);
        timersRef.current.set(id, timerId);
      }

      // Call onExiting for each newly exiting article
      if (onExiting) {
        for (const id of nextState.newlyExiting) {
          const updateEntry = (article: ArticleListItem) => {
            const prev = stateRef.current;
            const entry = prev.entries.get(id);
            if (!entry) return;
            const nextEntries = new Map(prev.entries);
            nextEntries.set(id, { ...entry, article });
            stateRef.current = { ...prev, entries: nextEntries };
            bumpVersion();
          };
          onExiting(id, updateEntry);
        }
      }
    }
  });

  // Unmount cleanup
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      for (const timerId of timersRef.current.values()) {
        clearTimeout(timerId);
      }
    };
  }, []);

  // Phase C — output builder
  const { displayArticles, pendingCount, exitingIds } = useMemo(() => {
    // Passthrough when not enabled
    if (!nextState.prevEnabled) {
      return { displayArticles: articles, pendingCount: 0, exitingIds: EMPTY_SET };
    }

    // No articles yet
    if (nextState.entries.size === 0) {
      return { displayArticles: undefined as ArticleListItem[] | undefined, pendingCount: 0, exitingIds: EMPTY_SET };
    }

    const display: ArticleListItem[] = [];
    let pending = 0;
    const exiting = new Set<number>();

    for (const id of nextState.order) {
      const entry = nextState.entries.get(id);
      if (entry) {
        if (entry.status === "active" || entry.status === "exiting") {
          display.push(entry.article);
        }
        if (entry.status === "exiting") {
          exiting.add(id);
        }
      }
    }

    for (const [, entry] of nextState.entries) {
      if (entry.status === "pending") {
        pending++;
      }
    }

    return {
      displayArticles: display as ArticleListItem[] | undefined,
      pendingCount: pending,
      exitingIds: exiting.size > 0 ? exiting : EMPTY_SET,
    };
  }, [nextState, articles]);

  // flush() — mutates ref + triggers re-render
  const flush = useCallback(() => {
    const prev = stateRef.current;
    const nextEntries = new Map(prev.entries);

    // Promote pending to active
    for (const [id, entry] of prev.entries) {
      if (entry.status === "pending") {
        nextEntries.set(id, { ...entry, status: "active" });
      }
    }

    // Remove exiting entries and cancel their timers
    for (const [id, entry] of prev.entries) {
      if (entry.status === "exiting") {
        nextEntries.delete(id);
        const timerId = timersRef.current.get(id);
        if (timerId) {
          clearTimeout(timerId);
          timersRef.current.delete(id);
        }
      }
    }

    const nextOrder = prev.order.filter((id) => nextEntries.has(id));

    // Append pending articles in their pendingOrder
    for (const id of prev.pendingOrder) {
      if (nextEntries.has(id)) {
        nextOrder.push(id);
      }
    }

    stateRef.current = {
      ...prev,
      entries: nextEntries,
      order: nextOrder,
      pendingOrder: [],
      newlyExiting: [],
    };
    bumpVersion();
  }, [bumpVersion]);

  return { displayArticles, pendingCount, exitingIds, flush };
}
