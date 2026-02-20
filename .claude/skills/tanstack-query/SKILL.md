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

## Decision Aids

### When to use `handlesOwnErrors: true`

Use it when the mutation has **optimistic rollback** that needs to show its own error state. Currently two mutations use it:

- `updateCategoryMutation` — optimistic cache update + rollback + custom toast
- `useReorderFeeds` — optimistic reorder + silent rollback (visual snap-back is sufficient feedback)

For all other mutations, let the global handler provide the toast.
