# Phase 5: Interest-Driven UI - Research

**Researched:** 2026-02-13
**Domain:** UI state management, sorting/filtering UX, visual indicators
**Confidence:** HIGH

## Summary

Phase 5 adds visual interest score indicators and sorting/filtering controls to the article list. The core technical challenge is choosing between client-side vs server-side sorting (recommendation: server-side for scalability) and managing filter/sort state (recommendation: URL parameters for shareability).

The existing stack (Chakra UI v3, TanStack Query, FastAPI + SQLModel) already provides all necessary primitives. Implementation requires:
1. Backend API changes to accept sort/filter query parameters and implement multi-column ORDER BY with NULL handling
2. Frontend UI controls (Select dropdown for sorting, Button group for filtering retained from existing read/unread toggle)
3. Visual score badges using Chakra Badge component with color-coded intensity
4. State management via Next.js useSearchParams for shareable filter states

**Primary recommendation:** Server-side sorting with URL parameter state management. Chakra Badge with colorPalette="accent" for high scores, "gray" for medium/low.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chakra UI v3 | (current) | Badge, Select, Menu components for score indicators and controls | Already in use, provides accessible primitives with colorPalette support |
| TanStack Query | v5 | Data fetching with queryKey invalidation on filter/sort changes | Already in use, natural fit for parameterized queries |
| Next.js | v15+ | useSearchParams for URL-based state management | Already in use, standard for shareable filter states |
| SQLAlchemy 2.0+ | via SQLModel | Multi-column ORDER BY with nulls_last()/nulls_first() | Backend dependency, supports complex sorting |
| FastAPI | (current) | Query parameter parsing for sort/filter options | Backend framework, already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-icons | (current) | Arrow icons for sort direction indicators | Already in use, no additional dependency |
| lodash | (if needed) | debounce for search input (future enhancement) | Only if adding text search later |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side sort | Client-side sort | Client-side only works for loaded data (pagination breaks it), server-side scales |
| URL params | useState only | useState loses state on refresh, URL params enable sharing/bookmarking |
| Badge | Custom score display | Badge provides semantic meaning and accessible contrast out of box |

**Installation:**
No new dependencies required. All components available in current stack.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── article/
│   │   ├── ArticleList.tsx      # Add sort/filter controls to top bar
│   │   ├── ArticleRow.tsx       # Add Badge for composite_score display
│   │   └── SortSelect.tsx       # New: Sort dropdown component
│   └── ui/
│       └── badge.tsx            # Chakra Badge wrapper (if customization needed)
├── hooks/
│   ├── useArticles.ts           # Update queryKey to include sort/order params
│   └── useSortParams.ts         # New: Hook for reading/writing sort URL params
└── lib/
    ├── api.ts                   # Update fetchArticles to accept sort/order params
    └── types.ts                 # Add SortOption, SortOrder types

backend/src/backend/
└── main.py                      # Update /api/articles endpoint with sort/order query params
```

### Pattern 1: Server-Side Sorting with URL State
**What:** Backend accepts `sort_by` and `order` query params, frontend stores them in URL searchParams
**When to use:** When dataset is paginated or too large for efficient client-side sorting

**Backend example:**
```python
# Source: SQLAlchemy 2.0 Documentation - https://docs.sqlalchemy.org/en/20/core/sqlelement.html
from sqlmodel import select
from sqlalchemy import desc, nulls_last

@app.get("/api/articles")
def list_articles(
    sort_by: str = "published_at",  # "published_at", "composite_score"
    order: str = "desc",             # "asc", "desc"
    # ... existing params
):
    statement = select(Article)

    # Apply sorting with NULL handling for composite_score
    if sort_by == "composite_score":
        sort_col = Article.composite_score
        if order == "desc":
            statement = statement.order_by(nulls_last(desc(sort_col)))
        else:
            statement = statement.order_by(nulls_last(sort_col.asc()))
    elif sort_by == "published_at":
        sort_col = Article.published_at
        statement = statement.order_by(
            desc(sort_col) if order == "desc" else sort_col.asc()
        )

    # Apply filters (is_read, feed_id) - existing logic
    # Apply pagination - existing logic
    return session.exec(statement).all()
```

**Frontend example:**
```typescript
// Source: Next.js Documentation - https://nextjs.org/docs/app/api-reference/functions/use-search-params
"use client";
import { useSearchParams, useRouter } from "next/navigation";

export function useSortParams() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sortBy = searchParams.get("sort") || "published_at";
  const order = searchParams.get("order") || "desc";

  const setSortParams = (newSort: string, newOrder: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("sort", newSort);
    params.set("order", newOrder);
    router.push(`?${params.toString()}`);
  };

  return { sortBy, order, setSortParams };
}

// In ArticleList.tsx
const { sortBy, order, setSortParams } = useSortParams();
const { data: articles } = useArticles({
  showAll,
  feedId: selectedFeedId,
  sortBy,  // Add to queryKey
  order,   // Add to queryKey
});
```

### Pattern 2: Visual Score Indicators with Chakra Badge
**What:** Use Badge component with colorPalette based on score thresholds
**When to use:** Displaying numeric scores with semantic meaning (high/medium/low interest)

**Example:**
```typescript
// Source: Chakra UI v3 Badge - https://www.chakra-ui.com/docs/components/badge
import { Badge } from "@chakra-ui/react";

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Text color="fg.muted">—</Text>;

  // Color intensity based on score thresholds (from Phase 4 decisions)
  const colorPalette = score >= 15 ? "accent" : "gray";
  const variant = score >= 10 ? "solid" : "subtle";

  return (
    <Badge colorPalette={colorPalette} variant={variant} size="sm">
      {score.toFixed(1)}
    </Badge>
  );
}
```

### Pattern 3: Accessible Sort Dropdown
**What:** Use Chakra Select or NativeSelect for sort options
**When to use:** 3-5 sort options where all are visible without nesting

**Example:**
```typescript
// Source: Chakra UI v3 Select - https://www.chakra-ui.com/docs/components/select
import { NativeSelectRoot, NativeSelectField } from "@chakra-ui/react";

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <NativeSelectRoot size="sm" width="auto">
      <NativeSelectField
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="score_desc">Highest Score</option>
        <option value="score_asc">Lowest Score</option>
        <option value="date_desc">Newest First</option>
        <option value="date_asc">Oldest First</option>
      </NativeSelectField>
    </NativeSelectRoot>
  );
}
```

### Anti-Patterns to Avoid
- **Client-side sorting with server-side pagination:** Only sorts visible page, not entire dataset. Always pair client sort with client pagination or use server sort.
- **Mixing useState and URL params for same state:** Pick one. URL params are better for shareability, useState for ephemeral UI state (like drawer open/closed).
- **Large Badge components competing for attention:** Keep badges small (sm size) and reserve accent color for truly high scores. Overuse of accent color reduces visual hierarchy.
- **Forgetting NULL handling in SQL ORDER BY:** composite_score is nullable until scoring completes. Use nulls_last() to push unscored articles to the end.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debouncing search input | Custom setTimeout logic | lodash.debounce or useDeferredValue (React 18+) | Edge cases: component unmount, cleanup, changing delay |
| URL parameter parsing | Manual URLSearchParams manipulation | Next.js useSearchParams hook | Handles SSR/hydration, provides router integration |
| Sort state synchronization | Manual queryClient.invalidateQueries calls | TanStack Query queryKey with params | Automatic cache invalidation when params change |
| Accessible dropdown menu | Custom div with click handlers | Chakra Select or Menu | ARIA attributes, keyboard navigation, focus management |
| Badge color thresholds | Hard-coded hex colors | Chakra colorPalette tokens | Consistent with theme, supports dark mode automatically |

**Key insight:** URL state management has non-obvious complexity (SSR hydration mismatches, browser back button behavior, type coercion). Next.js useSearchParams handles these edge cases. Similarly, accessible dropdowns require ARIA attributes and keyboard navigation that Chakra components provide out of box.

## Common Pitfalls

### Pitfall 1: Forgetting to Add Sort Params to TanStack Query Key
**What goes wrong:** User changes sort order, but UI doesn't update because query key hasn't changed, so cached data is returned.
**Why it happens:** queryKey must include ALL parameters that affect the query result. Easy to forget when adding new filter/sort params.
**How to avoid:**
```typescript
// BAD: Sort params not in queryKey
const { data } = useQuery({
  queryKey: ["articles", { is_read: false }],
  queryFn: () => fetchArticles({ is_read: false, sort: "score" }),
});

// GOOD: All query params in queryKey
const { data } = useQuery({
  queryKey: ["articles", { is_read: false, sort: "score", order: "desc" }],
  queryFn: () => fetchArticles({ is_read: false, sort: "score", order: "desc" }),
});
```
**Warning signs:** Sort dropdown changes value but article order doesn't update until manual refresh.

### Pitfall 2: Not Handling Nullable composite_score in SQL ORDER BY
**What goes wrong:** Articles with NULL composite_score appear first when sorting descending, pushing high-scored articles down. Users see unscored articles at top instead of interesting ones.
**Why it happens:** SQL default NULL ordering varies by database. SQLite puts NULLs first in DESC sorts.
**How to avoid:** Explicitly use nulls_last() wrapper around desc():
```python
# BAD: NULLs appear first in descending sort
statement = statement.order_by(desc(Article.composite_score))

# GOOD: NULLs pushed to end
from sqlalchemy import desc, nulls_last
statement = statement.order_by(nulls_last(desc(Article.composite_score)))
```
**Warning signs:** Unscored articles (scoring_state != "scored") appear at top of list when sorting by score descending.

### Pitfall 3: URL Param Type Coercion
**What goes wrong:** URL params are always strings. Comparing `"10"` (string) with `10` (number) can cause bugs in sort logic or React key generation.
**Why it happens:** URLSearchParams returns strings, but backend/comparison logic expects specific types.
**How to avoid:** Parse params with explicit type conversion:
```typescript
// BAD: String comparison
const limit = searchParams.get("limit"); // "50" (string)
if (limit > 20) { ... } // String comparison, not numeric

// GOOD: Parsed to number
const limit = parseInt(searchParams.get("limit") || "50", 10);
if (limit > 20) { ... } // Numeric comparison
```
**Warning signs:** Unexpected sort behavior when params come from URL vs initial state.

### Pitfall 4: Overusing Accent Color for Badges
**What goes wrong:** If every score uses accent color, visual hierarchy is lost. Users can't quickly distinguish high-interest articles.
**Why it happens:** Accent color is visually prominent, tempting to use everywhere for consistency.
**How to avoid:** Reserve accent colorPalette for genuinely high values. Use gray for medium/low scores:
```typescript
// BAD: Everything is accent
<Badge colorPalette="accent">{score.toFixed(1)}</Badge>

// GOOD: Color intensity reflects score value
const colorPalette = score >= 15 ? "accent" : "gray";
<Badge colorPalette={colorPalette}>{score.toFixed(1)}</Badge>
```
**Warning signs:** User feedback that "everything looks the same" or difficulty scanning for high-interest articles.

### Pitfall 5: Empty State After Applying Filters
**What goes wrong:** User filters to "highest score first" but sees empty state because all articles are unscored. No guidance on how to resolve.
**Why it happens:** Filters can legitimately return zero results, but empty state doesn't explain why or how to fix.
**How to avoid:** Contextual empty state messaging based on active filters:
```typescript
// Context-aware empty state
const emptyMessage = sortBy === "composite_score" && articles?.length === 0
  ? "No scored articles yet. Scoring is in progress."
  : showAll
    ? "No articles yet. Add some feeds to get started."
    : "No unread articles. You're all caught up!";
```
**Warning signs:** User applies filter, sees empty state, doesn't understand why or how to recover.

## Code Examples

Verified patterns from official sources:

### Multi-Column Sorting with NULL Handling
```python
# Source: SQLAlchemy 2.0 Documentation
# https://docs.sqlalchemy.org/en/20/core/sqlelement.html
from sqlmodel import select, Session
from sqlalchemy import desc, asc, nulls_last, nulls_first
from backend.models import Article

def get_sorted_articles(
    session: Session,
    sort_by: str = "published_at",
    order: str = "desc",
) -> list[Article]:
    statement = select(Article)

    # Primary sort by requested column
    if sort_by == "composite_score":
        sort_col = Article.composite_score
        if order == "desc":
            # High scores first, NULLs (unscored) at end
            statement = statement.order_by(nulls_last(desc(sort_col)))
        else:
            # Low scores first, NULLs at end
            statement = statement.order_by(nulls_last(asc(sort_col)))
    elif sort_by == "published_at":
        sort_col = Article.published_at
        if order == "desc":
            statement = statement.order_by(desc(sort_col))
        else:
            statement = statement.order_by(asc(sort_col))

    # Secondary sort by ID for stable ordering
    statement = statement.order_by(Article.id)

    return session.exec(statement).all()
```

### URL-Based Sort/Filter State Management
```typescript
// Source: Next.js useSearchParams Documentation
// https://nextjs.org/docs/app/api-reference/functions/use-search-params
"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export function useSortParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const sortBy = searchParams.get("sort") || "published_at";
  const order = searchParams.get("order") || "desc";

  const setSortParams = useCallback((newSort: string, newOrder: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", newSort);
    params.set("order", newOrder);
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  return { sortBy, order, setSortParams };
}
```

### Score Badge with Color Intensity
```typescript
// Source: Chakra UI v3 Badge Component
// https://www.chakra-ui.com/docs/components/badge
import { Badge, Text } from "@chakra-ui/react";

interface ScoreBadgeProps {
  score: number | null;
  scoringState: string;
}

export function ScoreBadge({ score, scoringState }: ScoreBadgeProps) {
  // Handle unscored states
  if (scoringState !== "scored" || score === null) {
    return <Text fontSize="xs" color="fg.muted">—</Text>;
  }

  // Threshold-based styling (from Phase 4 decisions)
  const getColorPalette = (score: number) => {
    if (score >= 15) return "accent";  // High interest
    return "gray";                     // Medium/low interest
  };

  const getVariant = (score: number) => {
    if (score >= 10) return "solid";   // Medium-high: solid background
    return "subtle";                   // Low: subtle background
  };

  return (
    <Badge
      colorPalette={getColorPalette(score)}
      variant={getVariant(score)}
      size="sm"
    >
      {score.toFixed(1)}
    </Badge>
  );
}
```

### TanStack Query with Sort Parameters
```typescript
// Source: TanStack Query Documentation
// Derived from project's existing useArticles.ts pattern
"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchArticles } from "@/lib/api";

interface UseArticlesOptions {
  showAll?: boolean;
  feedId?: number;
  sortBy?: string;
  order?: string;
}

export function useArticles(options: UseArticlesOptions = {}) {
  const { showAll = false, feedId, sortBy = "published_at", order = "desc" } = options;
  const [limit, setLimit] = useState(50);

  const query = useQuery({
    // CRITICAL: All query params must be in queryKey
    queryKey: [
      "articles",
      {
        is_read: showAll ? undefined : false,
        limit,
        feed_id: feedId,
        sort_by: sortBy,
        order,
      },
    ],
    queryFn: () =>
      fetchArticles({
        is_read: showAll ? undefined : false,
        limit,
        feed_id: feedId,
        sort_by: sortBy,
        order,
      }),
    // Existing polling logic for scoring states unchanged
    refetchInterval: (query) => {
      const articles = query.state.data;
      if (!articles) return false;
      const hasActiveScoring = articles.some(
        (a) => a.scoring_state === "queued" || a.scoring_state === "scoring"
      );
      return hasActiveScoring ? 5000 : false;
    },
  });

  // Existing loadMore/hasMore logic unchanged
  return { ...query };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hidden/disabled sort options | Always visible, with empty state guidance | ~2024-2025 | Better UX: users understand why filtering yields no results |
| Rainbow gradients for scores | Subtle intensity with limited palette | 2025-2026 | Reduces visual noise, improves scanability |
| Client-side filtering for all list sizes | Server-side filtering for paginated lists | Ongoing | Scales to large datasets without performance degradation |
| Segmented control for 5+ options | Dropdown select for 3-5 options | UX best practice | Saves space, clearer hierarchy |
| Manual debounce with setTimeout | React 18 useDeferredValue or lodash | React 18+ (2022+) | Avoids memory leaks, cleaner code |

**Deprecated/outdated:**
- **Chakra UI v2 colorScheme:** Replaced with colorPalette in v3 (migration guide: https://chakra-ui.com/migration)
- **nullsfirst()/nullslast():** Deprecated in SQLAlchemy 2.0+, use nulls_first()/nulls_last()
- **useState for shareable state:** URL params are now standard for filter/sort state

## Open Questions

1. **Should sorting be animated?**
   - What we know: FLIP animations (0.25s) are standard for list reordering, but add complexity
   - What's unclear: Whether instant reorder is sufficient given server-side rendering resets scroll position anyway
   - Recommendation: Start without animation (keep it simple), add if user testing shows confusion

2. **How many sort options should be exposed?**
   - What we know: Initial requirements specify "newest, highest score, category" but category sorting isn't defined
   - What's unclear: Does "category" mean filter by category (existing tag chips) or sort alphabetically by first category?
   - Recommendation: Start with 4 options (score desc/asc, date desc/asc), defer category sorting until user clarifies need

3. **Should composite_score display format change?**
   - What we know: Current format is decimal (e.g., "12.5"), Badge component supports any content
   - What's unclear: Whether users prefer decimal precision or rounded integer for quick scanning
   - Recommendation: Keep one decimal place for now (12.5), collect feedback after phase deployment

## Sources

### Primary (HIGH confidence)
- [SQLAlchemy 2.0 Documentation - nulls_last/nulls_first](https://docs.sqlalchemy.org/en/20/core/sqlelement.html)
- [Next.js useSearchParams Documentation](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Chakra UI v3 Badge Component](https://www.chakra-ui.com/docs/components/badge)
- [Chakra UI v3 Select Component](https://www.chakra-ui.com/docs/components/select)
- [TanStack Query Documentation](https://tanstack.com/query/)

### Secondary (MEDIUM confidence)
- [LogRocket: URL State with useSearchParams](https://blog.logrocket.com/url-state-usesearchparams/) - URL params vs useState tradeoffs
- [Medium: Server-Side Pagination with TanStack Table and Query](https://medium.com/@clee080/how-to-do-server-side-pagination-column-filtering-and-sorting-with-tanstack-react-table-and-react-7400a5604ff2) - Server-side sorting patterns
- [UXPin: Filter UI and UX Best Practices](https://www.uxpin.com/studio/blog/filter-ui-and-ux/) - Filter UI patterns and empty states
- [Material Design 3: Badge Guidelines](https://m3.material.io/components/badges) - Badge placement and sizing
- [Mobbin: Badge UI Design Best Practices](https://mobbin.com/glossary/badge) - Badge design patterns

### Tertiary (LOW confidence)
- [UI Color Trends 2026](https://updivision.com/blog/post/ui-color-trends-to-watch-in-2026) - Color intensity gradients trend
- [Frontend Masters: View Transition List Reordering](https://frontendmasters.com/blog/view-transition-list-reordering-with-a-kick-flip/) - List animation techniques
- [Developer Way: Debouncing in React](https://www.developerway.com/posts/debouncing-in-react) - Debounce best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, official docs verified
- Architecture: HIGH - Patterns verified with official SQLAlchemy and Next.js docs
- Pitfalls: MEDIUM-HIGH - Based on documented issues and community best practices, some from project experience
- Visual design: MEDIUM - Chakra v3 Badge API confirmed, color thresholds from Phase 4 context

**Research date:** 2026-02-13
**Valid until:** ~2026-03-15 (30 days, stable domain - core patterns unlikely to change)
