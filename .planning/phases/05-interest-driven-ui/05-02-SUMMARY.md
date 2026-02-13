---
phase: 05-interest-driven-ui
plan: 02
subsystem: ui-components
tags: [score-badges, sorting-ui, filtering-ui, visual-hierarchy]
dependency_graph:
  requires: [05-01-summary]
  provides: [ScoreBadge-component, SortSelect-component, filter-bar-ui]
  affects: [ArticleList, ArticleRow, ArticleReader]
tech_stack:
  added: [Chakra-Tooltip, emotion-keyframes, useScoringStatus-hook]
  patterns: [color-coded-badges, accent-tint-rows, filter-tabs, localStorage-sort]
key_files:
  created:
    - frontend/src/components/article/ScoreBadge.tsx
    - frontend/src/components/article/SortSelect.tsx
    - frontend/src/hooks/useScoringStatus.ts
  modified:
    - frontend/src/components/article/ArticleList.tsx
    - frontend/src/components/article/ArticleRow.tsx
    - frontend/src/components/article/ArticleReader.tsx
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useArticles.ts
    - backend/src/backend/main.py
decisions:
  - key: score-badge-color-tiers
    summary: "Three color tiers: >=15 accent solid, >=8 gray subtle, <8 gray outline"
    rationale: "Visual hierarchy emphasizes high-value content without overwhelming medium/low scores"
  - key: accent-tint-threshold
    summary: "Subtle accent.subtle background for rows with score >= 15"
    rationale: "High-scored articles stand out at a glance, reinforces visual hierarchy"
  - key: blocked-article-visibility
    summary: "Blocked articles hidden from Unread/All views by default via exclude_blocked param"
    rationale: "Keep main views clean, blocked content available in dedicated tab"
  - key: scoring-tab-counts
    summary: "Scoring tab shows sum of unscored+queued+scoring, Blocked tab shows blocked count"
    rationale: "Users see pending work at a glance, tabs disabled when count is 0"
metrics:
  duration_minutes: 3
  completed_at: "2026-02-13T22:08:16Z"
  tasks_completed: 2
  files_modified: 9
  commits: 2
---

# Phase 05 Plan 02: Interest-Driven UI Components Summary

**One-liner:** Color-coded score badges with tooltips, 4-tab filter bar (Unread/All/Scoring/Blocked), sort dropdown with localStorage persistence, and accent-tinted high-scored rows.

## What Was Built

### Task 1: ScoreBadge and SortSelect Components

**ScoreBadge.tsx** — Visual score indicator with three color tiers:
- **High (>=15)**: Accent solid badge (orange in current theme) — stands out prominently
- **Medium (>=8)**: Gray subtle badge — neutral, visible but not emphasized
- **Low (<8)**: Gray outline badge — muted, de-emphasized
- Returns null for unscored articles (scoring_state != "scored" or score == null)
- Wraps badge in Chakra v3 Tooltip.Root/Trigger/Content pattern showing exact score on hover
- Size prop: "sm" for article rows, "md" for reader header

**SortSelect.tsx** — Sort dropdown with Chakra v3 custom Select:
- 4 options: "Highest score", "Lowest score", "Newest first", "Oldest first"
- Maps to SortOption type: score_desc, score_asc, date_desc, date_asc
- Uses createListCollection pattern for Chakra v3 SelectRoot
- Size: sm, minWidth: 160px for stable layout
- onChange callback extracts value from details.value[0]

### Task 2: Backend and Frontend Integration

#### Backend Changes (main.py)

**1. list_articles endpoint — exclude_blocked parameter:**
```python
exclude_blocked: bool = True  # Default parameter
```
- When true and scoring_state != "blocked": filters out articles where `scoring_state == "scored" AND composite_score == 0`
- Automatically overridden to false when viewing blocked tab (scoring_state == "blocked")
- Keeps Unread and All views clean by hiding blocked content by default

**2. get_scoring_status endpoint — blocked count:**
```python
blocked_count = session.exec(
    select(func.count(Article.id))
    .where(Article.scoring_state == "scored")
    .where(Article.composite_score == 0)
).one()
counts["blocked"] = blocked_count
```
- Adds "blocked" field to status response
- Counts articles with composite_score == 0 and scoring_state == "scored"

#### Frontend Data Layer

**api.ts:**
- Added `exclude_blocked?: boolean` to FetchArticlesParams
- Added fetchScoringStatus function returning ScoringStatus interface
- ScoringStatus includes: unscored, queued, scoring, scored, failed, blocked counts

**useScoringStatus hook:**
- Wraps useQuery for /api/scoring/status endpoint
- staleTime: 30s, refetchInterval: 30s to keep counts current
- Used by ArticleList to calculate Scoring and Blocked tab counts

**useArticles hook:**
- Added `excludeBlocked?: boolean` option (defaults to true)
- Includes exclude_blocked in queryKey and queryFn for cache correctness

#### ArticleRow Component

**ScoreBadge integration:**
- Replaced inline score display with `<ScoreBadge score={article.composite_score} scoringState={article.scoring_state} size="sm" />`
- Badge only renders for scored articles (internal null check)
- Scoring state indicators (Spinner, LuClock, dash, X) still shown for non-scored states

**Accent tint for high-scored rows:**
```typescript
const isHighScored = article.scoring_state === "scored" &&
  article.composite_score !== null &&
  article.composite_score >= 15;

// Applied to Flex
bg={isHighScored ? "accent.subtle" : undefined}
```
- Subtle orange tint for rows with score >= 15
- Hover state (_hover={{ bg: "bg.subtle" }}) overrides tint on hover

#### ArticleReader Component

**ScoreBadge in header:**
- Replaced inline "Score: {value}/20" text with `<ScoreBadge score={article.composite_score} scoringState={article.scoring_state} size="md" />`
- Score badge placed in Flex with "/20" suffix and quality score
- Badge size="md" for better visibility in reader context
- Score reasoning text still shown below badge

#### ArticleList Component (Most Complex Changes)

**Filter tabs (4-tab system):**
```typescript
type FilterTab = "unread" | "all" | "scoring" | "blocked";
const [filter, setFilter] = useState<FilterTab>("unread");
```

Tab behaviors:
- **Unread**: showAll=false, no scoringState, excludeBlocked=true
- **All**: showAll=true, no scoringState, excludeBlocked=true
- **Scoring**: showAll=true, scoringState="pending", excludeBlocked=true
- **Blocked**: showAll=true, scoringState="blocked", excludeBlocked=false (override)

**Tab counts and disabled states:**
- Scoring tab: `scoringCount = unscored + queued + scoring` from useScoringStatus
- Blocked tab: `blockedCount = blocked` from useScoringStatus
- Tabs disabled when count === 0
- Count displayed in tab label: "Scoring (5)", "Blocked (2)"

**Sort dropdown integration:**
- Uses useSortPreference hook for localStorage persistence
- `parseSortOption(sortOption)` derives sort_by and order for backend
- Passed to useArticles: `sortBy: sort_by, order: order`

**Tab-specific empty states:**
- Unread: "No unread articles. You're all caught up!"
- All: "No articles yet. Add some feeds to get started."
- Scoring: "No articles awaiting scoring."
- Blocked: "No blocked articles."

**Mark all read button:**
- Only shown for Unread tab (filter === "unread")
- Hidden for All, Scoring, Blocked tabs

**Count label:**
- "X unread article(s)" for Unread
- "X article(s)" for All
- "X pending article(s)" for Scoring
- "X blocked article(s)" for Blocked

## Verification Results

✅ TypeScript compilation passes (npx tsc --noEmit)
✅ ScoreBadge renders with correct color tiers (accent/gray solid/gray outline)
✅ SortSelect fires onChange with correct SortOption values
✅ Filter bar shows 4 tabs with counts
✅ Scoring/Blocked tabs disabled when count is 0
✅ High-scored rows have accent.subtle background tint
✅ Backend exclude_blocked parameter works as expected
✅ Backend scoring status includes blocked count

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chakra v3 Tooltip pattern incorrect**
- **Found during:** Task 1, initial ScoreBadge implementation
- **Issue:** Used `<Tooltip content="...">` which doesn't exist in Chakra v3
- **Fix:** Switched to Chakra v3 Tooltip.Root/Trigger/Positioner/Content pattern
- **Files modified:** frontend/src/components/article/ScoreBadge.tsx
- **Commit:** b625e63 (included in Task 1 commit)

No other deviations — plan executed as written.

## Dependencies Satisfied

**Required from Phase 05-01:**
- Sort/filter data layer functional (sort_by, order, scoring_state params)
- useSortPreference hook available
- parseSortOption helper in types.ts
- Backend handles NULL composite_scores correctly

**Provides to Phase 05-03:**
- ScoreBadge component for reuse in other views
- SortSelect component for reuse
- Complete filter bar pattern (Unread/All/Scoring/Blocked)
- Visual hierarchy established (color tiers + accent tints)

## Visual Hierarchy Achieved

The UI now communicates article relevance at multiple levels:

1. **Score badges** — Immediate numeric feedback with color coding
2. **Row backgrounds** — High-scored articles (>=15) have subtle accent tint
3. **Color intensity** — Accent (high) > Gray (medium) > Muted gray (low)
4. **Tooltips** — Exact score on hover for precision
5. **Filter tabs** — Separate content by state (main, pending, blocked)
6. **Sort control** — User can reorder by score or date at will

Users can now:
- Spot high-value content instantly (orange badges + tint)
- Distinguish medium vs low scores (gray subtle vs outline)
- Sort articles by relevance or chronology
- Review pending scoring work (Scoring tab)
- Manage blocked content separately (Blocked tab)

## Next Steps (Phase 05-03)

With the visual UI complete, the final plan will:
1. Add keyboard shortcuts for navigation (j/k for next/prev article, numbers for score assignment)
2. Add bulk actions (mark multiple as read, adjust weights for category)
3. Polish animations and transitions (smooth score badge appearance, tab transitions)

## Commits

- `b625e63`: feat(05-02): add ScoreBadge and SortSelect components
- `20c1dda`: feat(05-02): integrate score badges, sort dropdown, and extended filter bar

## Self-Check: PASSED

**Created files verified:**
- ✅ frontend/src/components/article/ScoreBadge.tsx exists
- ✅ frontend/src/components/article/SortSelect.tsx exists
- ✅ frontend/src/hooks/useScoringStatus.ts exists

**Modified files verified:**
- ✅ frontend/src/components/article/ArticleList.tsx modified
- ✅ frontend/src/components/article/ArticleRow.tsx modified
- ✅ frontend/src/components/article/ArticleReader.tsx modified
- ✅ frontend/src/lib/api.ts modified
- ✅ frontend/src/hooks/useArticles.ts modified
- ✅ backend/src/backend/main.py modified

**Commits verified:**
- ✅ b625e63 exists in git history
- ✅ 20c1dda exists in git history
