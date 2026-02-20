---
name: tanstack-query
description: TanStack Query patterns — query key factory, MutationCache error handler, mutation object exposure, cache invalidation, and anti-patterns
---

# TanStack Query

Deep reference for the TanStack Query patterns used in this project. For concise rules, see `.claude/rules/frontend.md`.

## Key Patterns

### Query Key Factory (`lib/queryKeys.ts`)

All query keys are defined in a single factory object with `as const` assertions. This gives:

- **Type safety** — TypeScript infers exact tuple types, so `queryKeys.categories.all` is `readonly ["categories"]`, not `string[]`
- **Single source of truth** — grep for `queryKeys.categories` to find every query touching categories
- **Prefix invalidation** — `invalidateQueries({ queryKey: queryKeys.categories.all })` matches both `["categories"]` and `["categories", "new-count"]` because TanStack uses prefix matching by default

```typescript
// queryKeys.ts — plain object, no class or function wrapper
export const queryKeys = {
  categories: {
    all: ["categories"] as const,
    newCount: ["categories", "new-count"] as const,
  },
  articles: {
    all: ["articles"] as const,
    list: (filters: Record<string, unknown>) => ["articles", filters] as const,
  },
  // ...
};
```

**Why plain object, not a class?** A class adds a constructor, `this` binding, and instantiation for zero benefit. The object is simpler, tree-shakeable, and `as const` gives the same type narrowing.

### MutationCache Global Error Handler (`lib/queryClient.ts`)

Instead of repeating `onError: () => toaster.create(...)` in every mutation, a single `MutationCache.onError` handler catches all unhandled mutation errors:

```typescript
mutationCache: new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.options.meta?.handlesOwnErrors) return;
    const title = mutation.options.meta?.errorTitle ?? "Operation failed";
    toaster.create({ title, description: error.message, type: "error" });
  },
}),
```

Each mutation opts in via `meta`:

- `meta: { errorTitle: "Failed to delete feed" }` — global handler shows a toast with this title
- `meta: { handlesOwnErrors: true }` — global handler skips it (mutation has optimistic rollback with its own toast)

**Type-safe meta** via module augmentation (Register interface):

```typescript
declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { errorTitle?: string; handlesOwnErrors?: boolean };
  }
}
```

This eliminates `as string` casts when accessing `mutation.options.meta?.errorTitle`.

### Exposing Mutation Objects Directly

Hooks return mutation objects instead of thin wrapper functions:

```typescript
// Before (hides isPending, mutateAsync, status, etc.)
return { deleteCategory: (id) => deleteMutation.mutate(id) };

// After (consumer gets full mutation API)
return { deleteCategoryMutation };
// Consumer: deleteCategoryMutation.mutate(id), deleteCategoryMutation.isPending
```

**Exception:** Keep a wrapper when it adds behavior. `updateCategory` in `useCategories` auto-sets `is_seen: true` when changing weight — that's logic, not delegation. The raw mutation is also exposed alongside it.

### `onSettled` vs `onSuccess` for Cache Invalidation

Use `onSettled` (runs on both success AND error) for cache invalidation, not `onSuccess`. If a mutation fails, the server state may have partially changed, or the optimistic update needs reverting. Invalidating on settled ensures the cache re-fetches fresh data either way.

```typescript
useMutation({
  mutationFn: deleteCategory,
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
  },
  meta: { errorTitle: "Failed to delete category" },
});
```

## Anti-Patterns

### Over-Fetching in List Queries (Cache Memory Explosion)

**What went wrong:** The `GET /api/articles` list endpoint returned full HTML `content`, `summary`, and `score_reasoning` for all 50 articles (~10-50KB each). The list view only displays titles, scores, and categories — it never reads `content`. With TanStack Query's default 5-minute `gcTime`, switching between feeds/filters/sort combinations accumulated multiple full-payload cache entries simultaneously, pushing the frontend to ~1.5GB RAM.

**Why it's insidious:** Each individual query looks reasonable (50 articles). But TanStack Query caches by exact query key — `["articles", {feed: 1, sort: "score"}]` and `["articles", {feed: 2, sort: "date"}]` are separate entries. Browse 5 different filter combos and you have 5× the payload sitting in memory until GC runs.

**Fix — dual-type pattern:**

```typescript
// types.ts — list view gets lightweight type
export type ArticleListItem = Omit<Article, "content" | "summary" | "score_reasoning">;

// queryKeys.ts — separate keys for list vs detail
articles: {
  all: ["articles"] as const,
  list: (filters) => ["articles", filters] as const,
  detail: (id: number) => ["articles", "detail", id] as const,
},
```

The backend returns `ArticleListItem` from the list endpoint. The detail endpoint returns the full `Article`. The reader component fetches full content on demand via `useQuery({ queryKey: queryKeys.articles.detail(id) })`.

**Secondary lever — reduce `gcTime`:** When payloads are large, the default 5-minute gcTime is too generous. This project uses 2 minutes (`gcTime: 120_000` in default query options) to evict stale entries faster.

### Redundant Invalidation (Prefix Matching)

```typescript
// BAD — .all prefix already covers .newCount
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.categories.newCount });
};

// GOOD — prefix matching handles it
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
};
```

TanStack Query uses **prefix matching** by default. `["categories"]` matches `["categories"]`, `["categories", "new-count"]`, and any other key starting with `"categories"`. Only use a more specific key if you want to invalidate a subset.

### Silent Error Swallowing

Every mutation MUST have either `meta.errorTitle` (for global toast) or `meta.handlesOwnErrors: true` (for custom handling). A mutation with neither silently fails — the user sees nothing. The MutationCache's fallback title is "Operation failed", which is vague. Always provide a specific `errorTitle`.

### Inline Query Key Strings

Never use `queryKey: ["articles"]` in a hook or component. Always use `queryKeys.articles.all`. Inline strings drift — one hook uses `"articles"`, another uses `"article"`, and invalidation silently misses one.

### `useCallback` Depending on Mutation Object (Not `.mutate`)

**What went wrong:** `CategoriesSection` had `useCallback((id) => { hideMutation.mutate(id) }, [hideMutation])`. The `hideMutation` result object is a new reference on every render (TanStack Query creates a new result spread each time), so the callback was recreated every render despite `useCallback`. This defeated `React.memo` on 70+ category rows, causing a 577ms long task on every checkbox click.

**Fix:** Depend on `mutation.mutate` instead of the whole mutation object. The `.mutate` function is bound to the mutation observer and is referentially stable across renders.

```typescript
// BAD — hideMutation is a new object each render
const handleHide = useCallback(
  (id: number) => { hideMutation.mutate(id); },
  [hideMutation]  // unstable!
);

// GOOD — .mutate is stable
const handleHide = useCallback(
  (id: number) => { hideMutation.mutate(id); },
  [hideMutation.mutate]  // stable
);
```

### Inline Functions in Hook Return Values

**What went wrong:** `useCategories()` returned an inline `updateCategory` function (not `useCallback`-wrapped). Every consumer's `useCallback` that depended on `updateCategory` was recreated every render, cascading instability through the entire component tree and defeating `React.memo` on all category rows.

**Fix:** Wrap helper functions with business logic in `useCallback` inside the hook:

```typescript
// BAD — new function every render
return {
  updateCategory: (id, data) => {
    const payload = data.weight ? { ...data, is_seen: true } : data;
    mutation.mutate({ id, data: payload });
  },
};

// GOOD — stable reference
const updateCategory = useCallback((id, data) => {
  const payload = data.weight ? { ...data, is_seen: true } : data;
  mutation.mutate({ id, data: payload });
}, [mutation.mutate]);

return { updateCategory };
```

**Note:** This doesn't contradict "return mutation objects directly" — the raw mutation is still exposed alongside the helper. The helper exists because it adds auto-acknowledge logic, and it must be `useCallback`-wrapped so consumers get a stable reference.

## Decision Aids

### When to use `handlesOwnErrors: true`

Use it when the mutation has **optimistic rollback** that needs to show its own error state. Currently two mutations use it:

- `updateCategoryMutation` — optimistic cache update + rollback + custom toast
- `useReorderFeeds` — optimistic reorder + silent rollback (visual snap-back is sufficient feedback)

For all other mutations, let the global handler provide the toast.
