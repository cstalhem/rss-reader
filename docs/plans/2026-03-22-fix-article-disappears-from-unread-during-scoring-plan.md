---
title: "fix: Article disappears from unread list when scored during reading"
type: fix
status: active
date: 2026-03-22
issue: 63
---

# fix: Article disappears from unread list when scored during reading

## Overview

When an article is open in the reader view and scoring is active, the article disappears from the unread list after the 12-second auto-mark-as-read timer fires. The reader closes abruptly because its container is unmounted.

## Root Cause

Three systems interact in a way that causes the bug:

1. **`useMarkAsRead`** sets `is_read: true` in the TanStack cache and uses `refetchType: "none"` to prevent immediate refetch -- keeping the article visible.
2. **`useArticles` polling** fires every 10s while scoring is active (`scoringActive = true`). This poll is independent of the invalidation above.
3. The poll hits `GET /api/articles?is_read=false` -- the backend excludes the now-read article from the response.
4. **`useBufferedArticles`** iterates the server response and keeps only articles whose IDs are in the snapshot `Set<number>`. Since the snapshot stores only **IDs** (not data), it cannot fill in articles that disappeared from the response.

The reader is rendered conditionally inside `displayArticles.map()`, so when the article drops out of `displayArticles`, the `Collapsible.Root` unmounts and the reader closes.

## Design: Unified Stable List

Rather than patching `useBufferedArticles`, replace both `useBufferedArticles` and `useCompletingArticles` with a single `useStableArticleList` hook. Both hooks solve the same fundamental problem -- "the server response no longer contains an article that should still be visible" -- but with completely different data models. Unifying them fixes the bug, eliminates a class of future bugs, and roughly halves the code (~305 lines across two hooks → ~150-180 lines for one).

### Core insight

"Buffer new articles" (Unread tab) and "retain removed articles" (both tabs) are two policies on the same stable-list primitive, not separate features. The current codebase treats them as independent problems, which is why their interaction has a bug.

### Key design decisions

Each decision below was researched and evaluated against alternatives. The rationale
is captured here so future readers understand *why*, not just *what*.

**D1 — State management: hybrid pattern.**
Pure state derivation (additions/removals detection, display list filtering, cache refresh)
uses **setState-during-render** — the React-endorsed pattern for derived state, already
proven in `useBufferedArticles`. Side effects (scheduling removal timers, calling
`onExiting`) use **useLayoutEffect** — fires before paint, preventing visual flash, already
proven in `useCompletingArticles`. Pattern C (useRef + useMemo) was ruled out: it violates
React's render purity contract and breaks under Strict Mode double-invocation.

**D2 — Display order: stored order array.**
An explicit `order: number[]` preserves article positions. This is the only approach that
prevents the open reader from being unmounted when a retained article changes array
position — React's key-based reconciliation destroys and recreates Fragments that move in
the rendered array, which would close the reader mid-read. Alternatives evaluated:
server-order-first with append (reader closes on jump), Map insertion order (diverges from
server order over time), neighbor-anchored insertion (over-engineered, fragile).

**D3 — Timer management: `Map<number, NodeJS.Timeout>` in a useRef.**
Matches the existing single-timer pattern in `useAutoMarkAsRead.ts`, extended to multiple
timers. Fixes a real bug in the current `useCompletingArticles` where raw `setTimeout` has
no cleanup — timers fire after disable/unmount and create ghost entries. Cleanup points:
unmount (useEffect return), `enabled` goes false, individual expiry, flush while exiting.

**D4 — Pagination detection: keep `limit > prevLimit` heuristic.**
The current heuristic in `useBufferedArticles` is the best available given the API contract.
The one edge case (scoring completes a new article in the same response as a pagination
bump — new article appears immediately instead of behind the pill) has low probability
(scoring must complete within ~200ms between click and response) and low impact.

**D5 — Hook interface: destructured primitives, not options object.**
Every hook in this codebase accepts individual parameters or immediately destructures
objects. No hook uses reference comparison of an options object. Following the same pattern
eliminates a whole class of bugs (stale reference, forgotten useMemo, unstable closure).

**D6 — Tab transitions: hard reset via resetKey.**
Extend `resetKey` to include the filter tab: `${selection}:${sortOption}:${filter}`.
Tab switches produce a different TanStack Query key, so `articles` arrives fresh. Any
carried-over snapshot from the previous tab would be stale. Hard reset (clear map, cancel
timers, rebuild from fresh articles) is the clean approach — no special-case logic.

**D7 — Reader staleness: derive selectedArticle from displayArticles.**
Replace `useState<ArticleListItem | null>` with `useState<number | null>` (just the ID) and
derive the full object via `displayArticles?.find(...)`. This ensures the reader always sees
the freshest data. A defensive guard clears ghost state if the article disappears from the
display list despite retention.

### What stays the same

- `useArticles` — fetching, polling, pagination. Unchanged.
- `useScoringStatus` — drives `scoringCount`. Unchanged.
- `useMarkAsRead` — optimistic cache updates. `refetchType: "none"` kept (harmless). Unchanged.
- `NewArticlesPill` — receives count and onFlush. Unchanged (prop rename at call site only).
- `ArticleRow` / `ArticleReader` — unchanged.
- Backend — unchanged.

## Scope

### Files created
- `frontend/src/hooks/useStableArticleList.ts` -- the unified hook
- `frontend/src/hooks/useStableArticleList.test.ts` -- tests

### Files modified
- `frontend/src/components/article/ArticleList.tsx` -- replace two hook calls with one

### Files deleted
- `frontend/src/hooks/useBufferedArticles.ts`
- `frontend/src/hooks/useBufferedArticles.test.ts`
- `frontend/src/hooks/useCompletingArticles.ts`

No backend changes.

## Proposed Changes

### 1. `useStableArticleList` — hook signature

Per D5, individual parameters instead of an options object:

```ts
function useStableArticleList(
  articles: ArticleListItem[] | undefined,
  enabled: boolean,
  additions: "buffer" | "immediate",
  removals: "retain" | { animate: number } | "drop",
  resetKey: unknown,
  limit: number,
  onExiting?: (id: number, updateEntry: (article: ArticleListItem) => void) => void,
): StableListResult

interface StableListResult {
  displayArticles: ArticleListItem[] | undefined;
  pendingCount: number;
  exitingIds: Set<number>;
  flush: () => void;
}
```

### 2. `useStableArticleList` — internal data model

```ts
type EntryStatus = "active" | "pending" | "exiting";

type StableEntry = {
  article: ArticleListItem;
  status: EntryStatus;
};

// Internal state (per D1 — setState-during-render for pure derivation):
type StableState = {
  entries: Map<number, StableEntry>;   // article data + status
  order: number[];                      // display order (per D2)
  newlyExiting: number[];               // IDs that transitioned to "exiting" this render
                                        // (consumed by useLayoutEffect for side effects)
  prevEnabled: boolean;
  prevResetKey: unknown;
  prevLimit: number;
  prevArticles: ArticleListItem[] | undefined;
  prevArticleIds: Set<number> | null;   // used by D4 pagination heuristic
};

// Timer tracking (per D3 — useRef, not state):
const timersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
```

### 3. `useStableArticleList` — update logic

Per D1, the pure state transition runs during render via a `computeNextState` function.
Must return the same reference if nothing changed (prevents infinite re-render loops).
`computeNextState` accepts the full parameter set: `(prev, articles, enabled, additions,
removals, resetKey, limit)`.

**Important:** `computeNextState` is pure — no side effects. Timer scheduling and
`onExiting` callbacks are handled by the useLayoutEffect (step 7), which reads
`state.newlyExiting` to know what to act on. Timer cleanup for deactivation and reset
is also handled by the useLayoutEffect, not by `computeNextState`.

```
PHASE A — PURE STATE TRANSITION (computeNextState, runs during render)

1. EARLY EXITS — check before doing any work:

   a. DEACTIVATION — if enabled went false (enabled === false && prev.prevEnabled):
      → Return passthrough state: clear entries, order, newlyExiting.
        (Timer cleanup happens in useLayoutEffect phase B, not here.)

   b. RESET KEY CHANGE — if resetKey changed while enabled:
      → If articles is defined: rebuild entries + order from current articles
        (all as "active"). If articles is undefined: clear entries + order
        (step 2 will initialize when articles arrive).
        Clear newlyExiting. (Timer cleanup happens in useLayoutEffect phase B.)

   c. NOT ENABLED — if !enabled:
      → Return prev (passthrough, no state management).

   d. NO ARTICLES — if articles is undefined:
      → Return prev (waiting for data; deferred snapshot case handled in step 2).

2. INITIALIZATION — if enabled and entries is empty and articles arrived:
   → This is the "deferred snapshot" case: enabled activated before articles loaded,
     or this is the first render after activation.
   → Add all articles as { status: "active" }. Set order from articles array.
     Set newlyExiting to [].
   → This prevents articles from being incorrectly classified as additions
     (which would hide them behind the pill if additions === "buffer").

3. BUILD FRESH LOOKUP: freshMap<id, ArticleListItem>

4. DETECT ADDITIONS — IDs in freshMap not in entries:

   a. PAGINATION (per D4) — if limit > prevLimit:
      → Identify pagination articles: IDs in freshMap but NOT in prevArticleIds.
        Add these as { status: "active" }, append to order[].
      → IDs in freshMap but not in entries that ARE in prevArticleIds are impossible
        (they would already be in entries from a prior render).

   b. NON-PAGINATION — if limit === prevLimit (or no prevArticleIds):
      → If additions === "buffer":
           Add as { status: "pending" }. Do NOT append to order[] (invisible).
      → If additions === "immediate":
           Add as { status: "active" }, append to order[].

5. DETECT REMOVALS — "active" entries in entries not in freshMap:

   - removals === "retain"       → keep entry with cached data, status stays "active"
   - removals === { animate: N } → set status to "exiting", add ID to newlyExiting[]
   - removals === "drop"         → remove from entries and order[]

6. REFRESH CACHED DATA — for IDs present in both entries and freshMap:
   → Update entry.article from freshMap (picks up is_read: true, score updates, etc.)

7. UPDATE TRACKING — set prevArticles, prevArticleIds, prevLimit, prevResetKey,
   prevEnabled from current values. Only update when articles is defined (avoid
   swallowing limit bumps during TanStack Query key transitions).

8. SAME-REFERENCE CHECK — if nothing changed, return prev (prevents infinite loop).


PHASE B — SIDE EFFECTS (useLayoutEffect, runs after commit, before paint)

9. TIMER CLEANUP on state transitions:
   - If prev.prevEnabled && !state.prevEnabled (just deactivated): clearAll(timersRef)
   - If prev.prevResetKey !== state.prevResetKey (reset key changed): clearAll(timersRef)

10. EXITING SIDE EFFECTS — for each ID in state.newlyExiting:
    a. Schedule removal timer (per D3):
       const timerId = setTimeout(() => {
         remove entry from state, remove from order, delete timer from timersRef
       }, animateDuration);
       timersRef.current.set(id, timerId);
    b. Call onExiting(id, updateEntry) if provided

11. UNMOUNT CLEANUP — useEffect(() => () => clearAll(timersRef), [])
    (Separate from the useLayoutEffect. Empty deps = runs once on unmount.)


PHASE C — DERIVED OUTPUTS (useMemo, runs during render)

12. BUILD DISPLAY LIST:
    - Walk order[], for each ID:
      - If entries has it AND status is "active" or "exiting" → include
      - (Pending entries are never in order[], so they are never encountered here.)
    - displayArticles: the filtered result
    - pendingCount: count entries in the entries Map where status === "pending"
      (NOT derived from the order[] walk — pending entries are only in the Map)
    - exitingIds: Set of entries in the entries Map where status === "exiting"
```

`flush()` promotes all `"pending"` entries to `"active"`, appends their IDs to `order[]`.
If any entries have status `"exiting"`, cancel their timers and remove them from entries
and order (they should not survive a flush — the user is asking to see the current state).

### 4. `ArticleList.tsx` — integration

Per D5 (destructured primitives) and D6 (filter in resetKey):

```tsx
const isScoring = scoringCount > 0;

// Per D6: include filter in resetKey so tab switches trigger hard reset
const resetKey = `${selection.kind}:${
  selection.kind === "feed" ? selection.feedId
  : selection.kind === "folder" ? selection.folderId
  : "all"
}:${sortOption}:${filter}`;

const { displayArticles, pendingCount, exitingIds, flush } =
  useStableArticleList(
    articles,
    /* enabled */   filter === "unread" ? isScoring : filter === "scoring",
    /* additions */ filter === "unread" ? "buffer" : "immediate",
    /* removals */  filter === "unread" && isScoring ? "retain"
                    : filter === "scoring" ? { animate: 3000 }
                    : "drop",
    resetKey,
    limit,
    /* onExiting */ filter === "scoring" ? handleArticleExiting : undefined,
  );

// Note: on the Scoring tab, `enabled` is always true regardless of `isScoring`.
// This is intentional — the hook must stay active to complete exit animations
// after scoring finishes. It deactivates only when the user leaves the tab
// (resetKey change per D6).
```

Where `handleArticleExiting` is defined above with `useCallback`:

```tsx
const handleArticleExiting = useCallback(
  (id: number, updateEntry: (article: ArticleListItem) => void) => {
    fetchArticle(id).then((updated) => {
      if (updated.scoring_state === "scored") {
        updateEntry(toArticleListItem(updated));
      }
    });
  },
  [],
);
```

### 5. `ArticleList.tsx` — reader staleness fix

Per D7:

```tsx
// Replace useState<ArticleListItem | null> with just the ID
const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

// Derive the full object from the display list
const selectedArticle = useMemo(
  () => displayArticles?.find((a) => a.id === selectedArticleId) ?? null,
  [displayArticles, selectedArticleId],
);

// Defensive guard: if selected article disappeared, close the reader
if (selectedArticleId && !selectedArticle && isReaderOpen) {
  setIsReaderOpen(false);
  setSelectedArticleId(null);
}
```

Touch points:
- `handleSelect` → `setSelectedArticleId(article.id)` / `setSelectedArticleId(null)`
- `handleExitComplete` → `setSelectedArticleId(null)`
- `openArticle` → `setSelectedArticleId(article.id)`

### 6. Helper: `toArticleListItem`

Inline in `ArticleList.tsx` (single use site, not worth a separate file):

```ts
function toArticleListItem(article: Article): ArticleListItem {
  return {
    id: article.id,
    feed_id: article.feed_id,
    title: article.title,
    url: article.url,
    author: article.author,
    published_at: article.published_at,
    is_read: article.is_read,
    categories: article.categories,
    interest_score: article.interest_score,
    quality_score: article.quality_score,
    composite_score: article.composite_score,
    score_reasoning: article.score_reasoning,
    summary_preview: null,
    scoring_state: article.scoring_state,
    scored_at: article.scored_at,
  };
}
```

### 7. Tests

#### Ported from `useBufferedArticles.test.ts` (adapted)

- Passes articles through unchanged when not enabled
- Snapshots current articles when enabled activates
- Counts pending articles and excludes them from display (additions: "buffer")
- Preserves stored order for active articles (not server re-sort order)
- **Retains articles that disappear from server response** (removals: "retain") — the fix for issue #63
- Retained article stays at its original position in the order (not appended)
- Shows all articles and resets pendingCount after flush
- Resets state when resetKey changes (including filter tab change per D6)
- Handles undefined articles gracefully
- Deferred snapshot: enabled before articles load
- Expands snapshot on pagination (limit increase) without inflating pendingCount
- Resumes passthrough when enabled deactivates

#### Ported from `useCompletingArticles` behavior (adapted)

- Immediately retains disappeared articles with cached data (removals: { animate: N })
- Removes exiting articles after animation duration (via fake timers in test)
- Reports exitingIds for animation CSS
- Calls onExiting callback when article enters exiting state
- Updates exiting article data when onExiting callback fires updateEntry
- Cancels timers on unmount (no leaked setTimeout)
- Cancels timers when enabled goes false
- Cancels timers when resetKey changes (e.g., tab switch per D6)

#### Data refresh while retained

- Enable with `removals: "retain"`, article 2 in snapshot
- Rerender with article 2 updated (`is_read: true`) still in server response
- Assert step 6 refreshes cached data — article 2 in displayArticles has `is_read: true`
- Then rerender with article 2 removed from server response
- Assert retained article 2 still has `is_read: true` (cached from prior refresh)

#### Regression test for issue #63

- Enable with `additions: "buffer", removals: "retain"`
- Update article to `is_read: true` (simulating TanStack optimistic update)
- Remove article from server response (simulating next poll with `is_read=false`)
- Assert article remains in displayArticles with `is_read: true`
- Assert article stays at its original position in the order

## Edge Cases

| Scenario | Behavior |
|---|---|
| Enabled deactivates | Step 1a clears entries + order (pure). Step 9 cancels timers (side effect). Passthrough. |
| Flush | All "pending" → "active", appended to order. Exiting entries removed + timers cancelled. |
| Pagination (limit increase) | Step 4a: new IDs (not in `prevArticleIds`) added as "active" per D4 heuristic. |
| Reset key change (incl. tab switch per D6) | Step 1b rebuilds map from current articles. Step 9 cancels timers. |
| First articles arrive while enabled | Step 2: all articles initialized as "active" (not classified as additions). |
| Cache data freshness | Step 6 updates cached entries with fresh server data each render. |
| Article marked read while retained | Optimistic update refreshes cached entry via step 6 → shows read styling. |
| onExiting fetch fails | Entry stays with original cached data. Animation timer still completes. |
| Memory | Map + order hold at most ~50-100 lightweight items. Negligible. |
| selectedArticle disappears (D7) | Defensive guard closes reader and clears ID. |
| Scoring completes during pagination (D4 edge case) | New scored article appears immediately (low probability, acceptable). |

## What This Eliminates

| Current code | Status |
|---|---|
| `useBufferedArticles.ts` (155 lines) | Deleted |
| `useBufferedArticles.test.ts` (287 lines) | Deleted (tests ported) |
| `useCompletingArticles.ts` (150 lines) | Deleted |
| `BufferState` type + `computeBufferState` (100 lines) | Replaced by `StableEntry` map + `computeNextState` |
| Dual-pipeline selection in ArticleList (lines 141-160) | Single hook call |
| `prevOrder` + `prevDataRef` + `detectedRef` in completing hook | Single `StableState` |
| Timer leak in `useCompletingArticles` | Fixed via D3 timer cleanup |

## Reader Staleness Fix

**Problem:** `selectedArticle` is a stale snapshot stored in `useState`. When the
buffer refreshes cached article data (e.g., `is_read: true` from optimistic update),
`selectedArticle` still holds the old version. The `ArticleReader` receives stale props.

**Fix (in this PR, per D7):** Derive `selectedArticle` from `displayArticles` instead of
holding a separate copy. A defensive guard using setState-during-render (same React-endorsed
pattern as D1) clears ghost state if the article disappears from the display list.

## Commit Strategy

### Phase 1: Bug fix + reader staleness (commits 1-2)

Execute these first. They fix the user-facing bug and are safe to ship independently.

**Commit 1 — `useStableArticleList` hook + tests**

Create the new hook and its test suite. Does not modify any existing component yet.

Files created:
- `frontend/src/hooks/useStableArticleList.ts`
- `frontend/src/hooks/useStableArticleList.test.ts`

Verification: `bun run vitest run src/hooks/useStableArticleList.test.ts`

**Commit 2 — Wire up `ArticleList` + fix reader staleness + delete old hooks**

Replace the two hook calls with `useStableArticleList`. Fix `selectedArticle`
staleness by deriving it from `displayArticles`. Delete old hooks.

Files modified:
- `frontend/src/components/article/ArticleList.tsx`

Files deleted:
- `frontend/src/hooks/useBufferedArticles.ts`
- `frontend/src/hooks/useBufferedArticles.test.ts`
- `frontend/src/hooks/useCompletingArticles.ts`

Verification:
- `bun run build` — no type errors
- `bun run vitest run` — all tests pass
- Manual: open reader on Unread tab while scoring active, wait >12s, article stays
- Manual: Scoring tab articles animate out correctly

### Phase 2: Reassess before proceeding (commit 3)

**Stop after Phase 1.** Verify the fix works in practice, then reassess whether
commit 3 (shared engine refinements, if any emerge from testing) is needed or
whether the hook is clean enough as-is.

Potential commit 3 topics (only if needed after reassessment):
- Performance tuning (if Map rebuild is measurable in profiling)
- Order array pruning optimization
- Additional edge cases discovered during manual testing

## Verification

1. `cd frontend && bun run vitest run src/hooks/useStableArticleList.test.ts` -- all tests pass
2. `cd frontend && bun run build` -- no type errors
3. Manual test (Unread tab): open reader while scoring active, wait >12s, confirm article stays visible
4. Manual test (Scoring tab): watch articles animate out when scoring completes, confirm score/categories appear in exit animation
5. Manual test (tab switching): switch between Unread/Scoring/All during active scoring, confirm no visual glitches
6. Manual test (reader staleness): open article, wait for auto-mark-as-read, confirm read styling updates in both row and reader
