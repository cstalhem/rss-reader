---
phase: quick-17
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/backend/schemas.py
  - backend/src/backend/routers/articles.py
  - frontend/src/lib/types.ts
  - frontend/src/components/article/ArticleReader.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/queryKeys.ts
  - frontend/src/lib/queryClient.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Article list loads without content/summary fields (lighter payloads)"
    - "Opening an article in the reader drawer fetches full content on demand"
    - "Article reader still displays content, summary, score reasoning correctly"
    - "Navigating between articles in the reader fetches each article individually"
    - "TanStack Query cache does not accumulate unbounded stale entries"
  artifacts:
    - path: "backend/src/backend/schemas.py"
      provides: "ArticleListItem schema without content/summary"
      contains: "class ArticleListItem"
    - path: "backend/src/backend/routers/articles.py"
      provides: "List endpoint returns ArticleListItem, detail endpoint returns ArticleResponse"
    - path: "frontend/src/components/article/ArticleReader.tsx"
      provides: "Fetches full article on demand via useQuery"
    - path: "frontend/src/lib/queryClient.ts"
      provides: "Reduced gcTime for article queries"
  key_links:
    - from: "frontend/src/components/article/ArticleReader.tsx"
      to: "/api/articles/{id}"
      via: "useQuery with article detail key"
      pattern: "queryKeys\\.articles\\.detail"
    - from: "backend/src/backend/routers/articles.py"
      to: "ArticleListItem"
      via: "list endpoint response_model"
      pattern: "response_model.*ArticleListItem"
---

<objective>
Reduce frontend RAM usage by eliminating bulk content transfer in the article list endpoint and adding cache size controls.

**Root cause analysis (from code review):**
1. **Bulk content transfer**: The `GET /api/articles` list endpoint returns full `content` (HTML body) and `summary` for all 50 articles. Content fields are potentially 10-50KB each. With 50 articles, that is 500KB-2.5MB per query. When switching tabs/feeds, TanStack Query accumulates multiple such payloads in its cache (default 5-min gcTime).
2. **No cache size limits**: The QueryClient uses default gcTime (5 minutes), meaning every distinct query key variant (different filter/sort combinations) keeps its full payload in memory until GC runs.
3. **Content only needed on demand**: The `content` field is only read when the ArticleReader drawer opens for a single article. The list view only displays title, categories, scores, and metadata.

**Fix strategy:**
- Create a lightweight `ArticleListItem` schema (no content/summary/score_reasoning) for the list endpoint
- Keep the full `ArticleResponse` for the single-article detail endpoint (`GET /api/articles/{id}`)
- Have ArticleReader fetch the full article on demand via `useQuery` instead of reading from the list cache
- Reduce gcTime for article list queries to limit stale cache accumulation

Purpose: Reduce frontend memory footprint from ~1.5GB to a reasonable level for a personal RSS reader
Output: Lighter API payloads, on-demand content fetching, bounded cache
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/lib/api.ts
@frontend/src/lib/types.ts
@frontend/src/lib/queryKeys.ts
@frontend/src/lib/queryClient.ts
@frontend/src/hooks/useArticles.ts
@frontend/src/components/article/ArticleReader.tsx
@frontend/src/components/article/ArticleList.tsx
@frontend/src/components/article/ArticleRow.tsx
@backend/src/backend/schemas.py
@backend/src/backend/routers/articles.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create lightweight ArticleListItem schema and update list endpoint</name>
  <files>
    backend/src/backend/schemas.py
    backend/src/backend/routers/articles.py
  </files>
  <action>
    1. In `schemas.py`, create `ArticleListItem` as a copy of `ArticleResponse` but WITHOUT `content`, `summary`, and `score_reasoning` fields. Keep all other fields (id, feed_id, title, url, author, published_at, is_read, categories, interest_score, quality_score, composite_score, scoring_state, scored_at). Keep `ArticleResponse` unchanged for the detail endpoint.

    2. In `routers/articles.py`:
       - Create a helper `_article_to_list_item(article: Article) -> ArticleListItem` that builds the lightweight response (same as `_article_to_response` but skipping content/summary/score_reasoning).
       - Change `list_articles` endpoint: `response_model=list[ArticleListItem]` and use `_article_to_list_item`.
       - Keep `get_article` and `update_article` endpoints using `ArticleResponse` (they return full content).
       - IMPORTANT: The list query still loads categories_rel via selectinload -- that is needed for the list view's TagChip rendering.
  </action>
  <verify>
    Run `cd /Users/cstalhem/projects/rss-reader/backend && uv run pytest` to confirm all tests pass.
    Run `cd /Users/cstalhem/projects/rss-reader/backend && uv run ruff check .` for lint.
    Manually verify with `curl http://localhost:8912/api/articles?limit=2 | python3 -m json.tool` that the response does NOT contain `content`, `summary`, or `score_reasoning` fields.
  </verify>
  <done>
    List endpoint returns articles without content/summary/score_reasoning. Detail endpoint still returns full article. All backend tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update frontend types, fetch article on demand in reader, add cache controls</name>
  <files>
    frontend/src/lib/types.ts
    frontend/src/lib/api.ts
    frontend/src/lib/queryKeys.ts
    frontend/src/lib/queryClient.ts
    frontend/src/components/article/ArticleReader.tsx
    frontend/src/components/article/ArticleList.tsx
  </files>
  <action>
    1. In `types.ts`:
       - Create `ArticleListItem` type matching the new lightweight schema (everything from `Article` except `content`, `summary`, `score_reasoning`). Use `Omit<Article, 'content' | 'summary' | 'score_reasoning'>` or a standalone interface -- whichever is cleaner.
       - Keep the full `Article` type for detail responses.

    2. In `queryKeys.ts`:
       - Add `detail: (id: number) => ["articles", "detail", id] as const` under `articles`.

    3. In `api.ts`:
       - Update `fetchArticles` return type to `Promise<ArticleListItem[]>`.
       - Ensure `fetchArticle(id)` exists and returns `Promise<Article>` (it already does -- just verify the type).

    4. In `queryClient.ts`:
       - Add a `gcTime` of 2 minutes (120_000) to the default query options. This bounds how long stale query data persists after components unmount. The default 5 minutes is too generous when each article list payload is large.

    5. In `ArticleReader.tsx`:
       - Instead of receiving the full `Article` from props and reading `article.content`, change the component to accept only the article ID (or a lightweight `ArticleListItem`).
       - Add a `useQuery` call: `useQuery({ queryKey: queryKeys.articles.detail(articleId), queryFn: () => fetchArticle(articleId), enabled: !!articleId })`. This fetches the full article (with content) only when the reader opens.
       - Use the fetched full article data for rendering content, summary, and score_reasoning.
       - Show a loading spinner/skeleton while the detail query is loading.
       - Update the `ArticleReaderProps` interface: change `article` from `Article | null` to `ArticleListItem | null` (the list item is enough for the header info while the full content loads).
       - The `articles` prop (used for prev/next navigation) should also change to `ArticleListItem[]`.
       - For prev/next navigation via `onNavigate`, pass `ArticleListItem` objects (the reader will fetch full content for each on demand).

    6. In `ArticleList.tsx`:
       - Update types to use `ArticleListItem` where `Article` was used for the list.
       - The `selectedArticle` state should store `ArticleListItem | null`.
       - The `handleSelect` and `handleToggleRead` callbacks should accept `ArticleListItem`.
       - The `ArticleReader` component call should pass `ArticleListItem` objects.

    7. In `ArticleRow.tsx`:
       - Update the `article` prop type from `Article` to `ArticleListItem`. The row component never reads `content`, `summary`, or `score_reasoning`, so this is a type-only change.

    8. Also update any other components that import `Article` and only use list-level fields (check `useCompletingArticles`, `useArticles`, `useAutoMarkAsRead`). Change them to `ArticleListItem` where appropriate. The full `Article` type should only be used where content/summary/score_reasoning are accessed.
  </action>
  <verify>
    Run `cd /Users/cstalhem/projects/rss-reader/frontend && bun run build` to verify no TypeScript errors.
    Run `cd /Users/cstalhem/projects/rss-reader/frontend && bun run lint` for lint.
    Start the dev server (`bun dev --port 3210`) and verify:
    - Article list loads normally (titles, scores, categories visible)
    - Clicking an article opens the reader drawer and shows a brief loading state before content appears
    - Article content renders correctly in the reader
    - Prev/next navigation works in the reader
    - Score reasoning appears in the reader
    - Auto-mark-as-read still works (12-second timer)
  </verify>
  <done>
    Frontend uses lightweight ArticleListItem for list views. ArticleReader fetches full content on demand. gcTime reduced to 2 minutes. Build passes with no type errors. All article reading functionality preserved.
  </done>
</task>

</tasks>

<verification>
1. Backend tests pass: `cd backend && uv run pytest`
2. Frontend builds: `cd frontend && bun run build`
3. List endpoint excludes content: `curl http://localhost:8912/api/articles?limit=1` should NOT have content/summary/score_reasoning
4. Detail endpoint includes content: `curl http://localhost:8912/api/articles/1` should have all fields
5. Full flow test: open app, browse articles, open reader, verify content loads, navigate between articles
</verification>

<success_criteria>
- Article list API responses are significantly smaller (no content/summary/score_reasoning)
- Article content fetched on demand only when reader drawer opens
- TanStack Query cache bounded with 2-minute gcTime
- All existing functionality preserved (reading, navigation, scoring display, auto-mark-as-read)
- Frontend builds without errors
- Backend tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/17-investigate-and-reduce-frontend-ram-usag/17-SUMMARY.md`
</output>
