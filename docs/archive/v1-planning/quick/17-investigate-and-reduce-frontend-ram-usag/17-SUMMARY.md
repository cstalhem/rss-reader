---
phase: quick-17
plan: 01
subsystem: api, ui
tags: [fastapi, tanstack-query, pydantic, react, cache-management]

# Dependency graph
requires: []
provides:
  - ArticleListItem backend schema (no content/summary/score_reasoning)
  - On-demand article content fetching in ArticleReader
  - Bounded TanStack Query cache (2-minute gcTime)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lightweight list schema + full detail schema for API endpoints"
    - "On-demand content fetching via useQuery in reader drawer"

key-files:
  created: []
  modified:
    - backend/src/backend/schemas.py
    - backend/src/backend/routers/articles.py
    - frontend/src/lib/types.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/queryKeys.ts
    - frontend/src/lib/queryClient.ts
    - frontend/src/components/article/ArticleReader.tsx
    - frontend/src/components/article/ArticleList.tsx
    - frontend/src/components/article/ArticleRow.tsx
    - frontend/src/hooks/useCompletingArticles.ts

key-decisions:
  - "ArticleListItem as Omit<Article, content | summary | score_reasoning> for structural subtyping"
  - "gcTime reduced from default 5 minutes to 2 minutes for all queries"

patterns-established:
  - "Lightweight list schema + full detail schema: list endpoints return minimal fields, detail endpoints return full content"
  - "On-demand content loading: reader drawer fetches content via useQuery, shows spinner while loading"

requirements-completed: []

# Metrics
duration: 4.6min
completed: 2026-02-20
---

# Quick Task 17: Reduce Frontend RAM via Lightweight Article List Endpoint

**ArticleListItem schema excludes content/summary/score_reasoning from list API; ArticleReader fetches full content on demand via useQuery; gcTime reduced to 2 minutes**

## Performance

- **Duration:** 4.6 min
- **Started:** 2026-02-20T18:03:24Z
- **Completed:** 2026-02-20T18:08:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- List endpoint payload reduced significantly by excluding content, summary, and score_reasoning fields (potentially 500KB-2.5MB savings per query with 50 articles)
- ArticleReader now fetches full article content on demand when the drawer opens, with loading spinner
- TanStack Query cache bounded to 2-minute gcTime (was 5-minute default) to limit stale cache accumulation
- All existing functionality preserved: article list, reader drawer, navigation, scoring display, auto-mark-as-read

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lightweight ArticleListItem schema and update list endpoint** - `34899f5` (feat)
2. **Task 2: Update frontend types, fetch article on demand in reader, add cache controls** - `77f837c` (feat)

## Files Created/Modified
- `backend/src/backend/schemas.py` - Added ArticleListItem schema without content/summary/score_reasoning
- `backend/src/backend/routers/articles.py` - Added _article_to_list_item helper, changed list endpoint response_model
- `frontend/src/lib/types.ts` - Added ArticleListItem type via Omit
- `frontend/src/lib/api.ts` - Updated fetchArticles return type to ArticleListItem[]
- `frontend/src/lib/queryKeys.ts` - Added articles.detail(id) query key
- `frontend/src/lib/queryClient.ts` - Added gcTime: 2 minutes to default query options
- `frontend/src/components/article/ArticleReader.tsx` - Added useQuery for on-demand content fetch, loading spinner, updated props to ArticleListItem
- `frontend/src/components/article/ArticleList.tsx` - Updated state and callbacks to use ArticleListItem
- `frontend/src/components/article/ArticleRow.tsx` - Updated props to ArticleListItem (type-only change)
- `frontend/src/hooks/useCompletingArticles.ts` - Updated type annotations to ArticleListItem

## Decisions Made
- Used `Omit<Article, "content" | "summary" | "score_reasoning">` for ArticleListItem type to maintain structural subtyping with the full Article type (Article satisfies ArticleListItem)
- Reduced gcTime globally to 2 minutes rather than per-query-key, since the list payloads were the primary memory concern and a shorter global gcTime is reasonable for a personal app
- score_reasoning is shown from the fullArticle detail fetch rather than the list item, since it was removed from the list schema

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failures in `tests/test_api.py` (6 failures) confirmed unrelated to changes by running tests on clean `main` branch
- Pre-existing lint errors in multiple frontend files confirmed unrelated to changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- RAM reduction active immediately for all article list queries
- Article detail endpoint unchanged, full content available on demand
- No migration needed

---
*Quick Task: 17*
*Completed: 2026-02-20*
