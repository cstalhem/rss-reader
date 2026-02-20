---
phase: 05-interest-driven-ui
plan: 01
subsystem: api-data-layer
tags: [sorting, filtering, data-layer, persistence]
dependency_graph:
  requires: [04-05-summary]
  provides: [sort-filter-api, useSortPreference-hook]
  affects: [articles-endpoint, useArticles-hook]
tech_stack:
  added: [nulls_last-sqlalchemy, SortOption-type]
  patterns: [server-side-sorting, localStorage-persistence, queryKey-caching]
key_files:
  created:
    - frontend/src/hooks/useSortPreference.ts
  modified:
    - backend/src/backend/main.py
    - frontend/src/lib/api.ts
    - frontend/src/lib/types.ts
    - frontend/src/hooks/useArticles.ts
decisions:
  - key: default-sort-order
    summary: "Composite score descending is default sort (highest interest first)"
    rationale: "User decision: score-first is the primary workflow"
  - key: null-handling
    summary: "NULL composite_scores pushed to end with nulls_last() regardless of sort direction"
    rationale: "Unscored articles should appear after scored ones in both asc/desc views"
  - key: pending-tab-sort-override
    summary: "Scoring tab defaults to oldest-first (published_at ASC) when sort is default"
    rationale: "Catch-up workflow: process oldest unscored articles first"
  - key: secondary-sort-tiebreaker
    summary: "Score sort uses published_at ASC as secondary, date sort uses id"
    rationale: "Stable ordering for equal scores, consistent pagination"
metrics:
  duration_minutes: 2
  completed_at: "2026-02-13T22:02:19Z"
  tasks_completed: 2
  files_modified: 5
  commits: 2
---

# Phase 05 Plan 01: Sort and Filter Data Layer Summary

**One-liner:** Server-side sorting by composite_score/date with NULL handling, scoring_state filters (pending/blocked), and localStorage sort persistence via useSortPreference hook.

## What Was Built

### Backend: list_articles Endpoint Enhancements

Updated `/api/articles` to accept three new query parameters:

1. **sort_by** (`composite_score` | `published_at`) — Controls primary sort field. Defaults to `composite_score` (score-first workflow).

2. **order** (`desc` | `asc`) — Controls sort direction. Defaults to `desc`.

3. **scoring_state** (optional) — Filters articles by scoring state:
   - `"pending"` → Filters to `unscored`, `queued`, or `scoring` states (for Scoring tab)
   - `"blocked"` → Filters to `scored` articles with `composite_score == 0` (for Blocked tab)
   - Any other value → Exact match on scoring_state field

#### Sorting Logic

**Composite Score Sort:**
- Primary: `composite_score` in requested order, wrapped with `nulls_last()` to push NULL scores to end
- Secondary: `published_at ASC` (oldest-first tiebreaker for equal scores)
- Import from `sqlalchemy`: `desc, nulls_last`

**Published Date Sort:**
- Primary: `published_at` in requested order
- Secondary: `Article.id` for stable ordering

**Pending Tab Override:**
When `scoring_state == "pending"` and `sort_by` is still default (`composite_score`), the backend automatically switches to `published_at ASC` (oldest-first). This supports the "catch up on unscored articles" workflow without requiring the frontend to explicitly set date sort.

### Frontend: Data Layer Updates

**1. types.ts — SortOption Type**

Added `SortOption` type to encode sort field + direction in a single value:

```typescript
export type SortOption = "score_desc" | "score_asc" | "date_desc" | "date_asc";
```

Added `parseSortOption()` helper to map from dropdown values to backend params:

```typescript
parseSortOption("score_desc") → { sort_by: "composite_score", order: "desc" }
```

**2. api.ts — fetchArticles Params**

Extended `FetchArticlesParams` interface with:
- `sort_by?: string`
- `order?: string`
- `scoring_state?: string`

Updated `fetchArticles()` to append these params to the query string when defined.

**3. useSortPreference Hook**

Created new hook wrapping `useLocalStorage` for sort preference persistence:

```typescript
export function useSortPreference() {
  const [sortOption, setSortOption] = useLocalStorage<SortOption>(
    "rss-sort-preference",
    "score_desc"
  );
  return { sortOption, setSortOption };
}
```

- Key: `"rss-sort-preference"`
- Default: `"score_desc"` (composite score descending)
- Persists across sessions via localStorage

**4. useArticles Hook Updates**

Extended `UseArticlesOptions` interface:
- `sortBy?: string`
- `order?: string`
- `scoringState?: string`

Updated both `queryKey` and `queryFn` to include these params. This is critical — TanStack Query uses queryKey for cache lookup, so changing sort/filter must produce a different key to trigger a new fetch.

## Verification Results

✅ Backend imports successfully (syntax verified)
✅ TypeScript compilation passes (`npx tsc --noEmit`) — no errors on modified files
✅ All must-have files created/modified as specified
✅ queryKey includes sort/filter params for cache correctness
✅ useSortPreference defaults to "score_desc" per user decision

## Deviations from Plan

None — plan executed exactly as written.

## Dependencies Satisfied

**Required from Phase 04:**
- Article model with `composite_score`, `scoring_state`, `categories` fields (04-01)
- Scoring pipeline functional (04-02)
- Articles have scored/unscored/blocked states (04-05)

**Provides to Phase 05:**
- Backend sort/filter API ready for UI consumption
- Frontend data layer prepared for dropdown/tab integration
- Sort preference persistence mechanism in place

## Next Steps (Phase 05-02)

With the data pipeline complete:
1. Add sort dropdown to article list header (integrates useSortPreference + parseSortOption)
2. Add tab navigation for All/Scoring/Blocked views (passes scoring_state to useArticles)
3. Wire up dropdown changes to trigger re-fetch via useArticles params

## Commits

- `eeaaf08`: feat(05-01): add sort and filter params to articles endpoint
- `dd65a44`: feat(05-01): add frontend data layer for sort and filter

## Self-Check: PASSED

**Created files verified:**
- ✅ frontend/src/hooks/useSortPreference.ts exists

**Modified files verified:**
- ✅ backend/src/backend/main.py modified
- ✅ frontend/src/lib/api.ts modified
- ✅ frontend/src/lib/types.ts modified
- ✅ frontend/src/hooks/useArticles.ts modified

**Commits verified:**
- ✅ eeaaf08 exists in git history
- ✅ dd65a44 exists in git history
