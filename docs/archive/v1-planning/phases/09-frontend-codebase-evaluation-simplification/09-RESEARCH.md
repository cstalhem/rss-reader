# Phase 9: Frontend Codebase Evaluation & Simplification - Research

**Researched:** 2026-02-19
**Domain:** Frontend technical debt cleanup — React/Next.js patterns, TanStack Query, Chakra UI v3 consistency
**Confidence:** HIGH

## Summary

This phase addresses technical debt accumulated across Phases 6-8.3 in the frontend codebase (`frontend/src/`). The work breaks down into seven distinct workstreams: (1) TanStack Query centralization — query keys, MutationCache global error handling, mutation return contracts; (2) dead code removal — confirmed dead files, dead imports, dead branches; (3) component deduplication — useRenameState hook, ConfirmDialog, ModelRow extraction; (4) useEffect cleanup — three specific anti-patterns; (5) Chakra UI / theme consistency — semantic tokens, Tooltip standardization, Dialog Portal cleanup, react-icons color pattern, FeedRow input; (6) constants & file organization — magic numbers, type/function misplacements, API_BASE_URL deduplication; (7) broader sweep — performance patterns, import hygiene, Next.js patterns.

The codebase currently has ~60 TypeScript files in `frontend/src/` with 14 hooks, 40+ components, and 4 lib files. The primary risk areas are the 11-mutation `useCategories` hook (247 lines of boilerplate), scattered inline query key strings (~60 occurrences across 12 files), and 9 instances of `var(--chakra-colors-*)` on react-icons that bypass the Chakra token system.

**Primary recommendation:** Split into 4-5 sub-plans ordered by dependency: infrastructure changes first (query keys, MutationCache, constants), then consuming code updates (hook refactors, component dedup), then cleanup (dead code, theme tokens, useEffect fixes), then verification sweep.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mutation return contract:**
- Return mutation objects directly from hooks (not thin wrapper functions)
- Consumers destructure what they need: `.mutate()`, `.isPending`, `.mutateAsync()`
- Rationale: thin wrappers hide useful state (isPending, error) that consumers need for button disabling, inline errors, and action chaining. The existing `createCategoryMutation` exposure in useCategories validates this need.

**Centralized error handling:**
- Implement `MutationCache.onError` as global fallback error toast handler
- Individual mutations can override with their own `onError` when needed (e.g., optimistic rollback)
- Global handler skips mutations that have their own `onError` callback
- Use `meta` tags on mutations for custom error message titles
- This automatically covers hooks with no error handling (useFeedMutations, usePreferences, useOllamaConfig)

**Mutation boilerplate:**
- Keep each useMutation call explicit (no factory/helper abstraction)
- After centralizing error handling, per-mutation config is only ~5-6 lines (mutationFn + onSettled + meta)
- Explicit invalidation is preferable to abstraction that hides cache behavior
- Rationale: TkDodo (TanStack core maintainer) recommends visible invalidation over DRY mutation factories

**Query key factory:**
- Create `lib/queryKeys.ts` with a plain object mapping (no library, no queryOptions)
- Pattern: `queryKeys.categories.all`, `queryKeys.articles.list(filters)`, etc.
- Rationale: queryOptions() adds value when the same query is consumed from multiple places with different options -- not our pattern. Each query has exactly one wrapping hook. Centralizing keys eliminates the real problem (inline strings repeated 12+ times).

**Rename logic extraction:**
- Extract `useRenameState` custom hook (not a RenameInput component)
- Hook provides: isRenaming, renameValue, setRenameValue, startRename, handleSubmit, handleCancel, inputRef
- Each component keeps its own render (the 4 implementations differ in visual layout)
- Rationale: share logic via hooks, share UI via components. The rename UIs differ visually.

**Confirmation dialogs:**
- Create general `ConfirmDialog` component with configurable title, body, confirmLabel, onConfirm
- Replace the two inline ungroup dialogs in CategoriesSection
- DeleteCategoryDialog can compose ConfirmDialog as its base (wrapping with category-specific logic)

**Model rows:**
- Extract `ModelRow` component from ModelManagement.tsx
- Handles both curated (has description) and non-curated models via optional prop
- Eliminates ~100 lines of duplicated JSX

**FeedRow input:**
- Replace raw HTML `<input>` with Chakra `Input` component
- Standardize with semantic tokens and theme system (only inline style={{}} in codebase)

**React-icons color pattern:**
- Set `color` on the nearest Chakra parent element, let CSS inheritance flow to SVG `currentColor`
- Where icon is standalone with no parent to piggyback on, wrap in `Box` with `color` prop
- Do NOT create a ThemedIcon wrapper component (over-abstraction)
- Pattern: `<Flex color="fg.muted"><LuFolder size={16} /></Flex>`

**Semantic tokens for hardcoded colors:**
- Create `bg.code` token for code block backgrounds (replaces oklch in ArticleReader)
- Create `fg.success` token (replaces green.600 in AddFeedDialog)
- Create `fg.warning` token (replaces orange.400 in ModelSelector)
- Tokens follow Chakra v3 naming convention: `category.variant`, light/dark aware
- No hardcoded color values anywhere in components -- all must reference semantic tokens

**Tooltip standardization:**
- Use `@/components/ui/tooltip` wrapper everywhere (includes Portal, showArrow support)
- Replace raw Tooltip.Root usage in ScoreBadge with the wrapper
- Rationale: wrapper prevents "forgot to add Portal" bugs. Thin composition, no custom logic.

**Dialog Portal pattern:**
- Remove explicit `Portal` wrappers from Dialog components
- Chakra v3 Dialog.Positioner handles portalling internally
- AddFeedDialog pattern (no Portal) is correct; CategoriesSection pattern (explicit Portal) is redundant

**colorPalette context:**
- Set `colorPalette="accent"` per-component, not as global default
- Fix Sidebar "All Articles" row by adding explicit `colorPalette="accent"` on parent

**Magic number strategy (hybrid):**
- Constants used in 2+ files -> `lib/constants.ts` (e.g., HEADER_HEIGHT, SIDEBAR_WIDTH_*)
- Constants used in 1 file -> named const at top of that file (e.g., AUTO_MARK_READ_DELAY, PAGE_SIZE)
- Rule: shared = centralized, single-use = co-located

**File organization conventions:**
- Types (interface, type) -> `lib/types.ts`
- Runtime utilities (pure functions) -> `lib/utils.ts`
- API client (fetch functions only) -> `lib/api.ts`
- Shared constants (cross-file) -> `lib/constants.ts`
- Query keys -> `lib/queryKeys.ts` (new)
- Fix all current misplacements: ScoringStatus/DownloadStatus to types.ts, parseSortOption to utils.ts, deduplicate API_BASE_URL

**Dead code removal:**
- Delete all confirmed dead files (CategoryRow.tsx, WeightPresets.tsx, SwipeableRow.tsx)
- Remove dead code fragments (redundant filter branch in ArticleList, savedConfig alias in useOllamaConfig)
- Verify DnD package usage with grep before removing from package.json
- Remove unused dependencies only after confirming zero imports remain

**useEffect cleanup -- fix all three flagged patterns:**
1. `ArticleReader` optimistic state reset -> use `key={article?.id}` prop (low risk, straightforward)
2. `WeightPresetStrip` prop->state sync -> handle optimism at mutation level, make controlled component (medium risk, ties into optimistic update work)
3. `InterestsSection` server->form sync -> initialize state from server on mount, don't re-sync on refetch, use key prop to reset after save (low-medium risk)

**Broader sweep (all selected):**
1. Performance patterns -- unnecessary re-renders, missing React.memo on list items, expensive inline computations, list key quality
2. Consistency across features -- same patterns used differently across settings sections
3. Import/export hygiene -- unused exports, circular dependencies, barrel files that defeat tree-shaking
4. Next.js patterns -- unnecessary "use client" directives, server/client boundary correctness

### Claude's Discretion

- How to split Phase 9 into sub-phases if research reveals too much work (present recommendation to user)
- Specific refactoring approach for each useEffect pattern (the direction is locked, implementation details are flexible)
- Whether ArticleRow needs React.memo (evaluate during performance sweep)
- Whether to add `placeholderData: keepPreviousData` to load-more pagination (evaluate during performance sweep)
- Exact structure of `.learning/` topic files (initial scaffold is being set up)

### Deferred Ideas (OUT OF SCOPE)

- **Accessibility audit** -- ArticleRow read/unread dot lacks keyboard accessibility (role=button, tabIndex, onKeyDown). Noted for a future accessibility-focused phase rather than piecemeal fixes.
- **Backend codebase evaluation** -- This phase is frontend-only. Backend patterns (config, models, API structure) could be evaluated in a future phase.
</user_constraints>

## Standard Stack

### Core (already installed, no new dependencies)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@tanstack/react-query` | ^5.90.20 | Server state management | MutationCache API available since v4 |
| `@chakra-ui/react` | ^3.32.0 | UI component library | Semantic tokens, Portal patterns |
| `next` | 16.1.6 | React framework | App Router, --webpack flag required |
| `react` | 19.2.3 | UI framework | React.memo, key prop patterns |
| `@dnd-kit/core` + `@dnd-kit/sortable` | ^6.3.1 / ^10.0.0 | Feed reordering DnD | Still actively used by FeedRow + Sidebar |
| `react-swipeable` | ^7.0.2 | Mobile swipe gestures | Still used by FeedRow; SwipeableRow.tsx is dead |
| `@emotion/react` | ^11.14.0 | CSS-in-JS / keyframes | Required by Chakra v3 |

### No New Dependencies

This phase requires zero new dependencies. All work uses existing libraries and patterns.

### Dependencies to Potentially Remove

| Dependency | Status | Verdict |
|------------|--------|---------|
| `@dnd-kit/core` | Used in Sidebar.tsx, FeedRow.tsx, FeedsSection.tsx | KEEP -- active feed reordering |
| `@dnd-kit/sortable` | Used in Sidebar.tsx, FeedRow.tsx, FeedsSection.tsx, CategoryRow.tsx | KEEP -- CategoryRow.tsx is dead but other files are active |
| `@dnd-kit/utilities` | Used in FeedRow.tsx, FeedsSection.tsx, CategoryRow.tsx | KEEP -- active in non-dead files |
| `@hello-pangea/dnd` | Not in package.json, not in source | ALREADY REMOVED |
| `react-swipeable` | Used in FeedRow.tsx (active) and SwipeableRow.tsx (dead) | KEEP |

## Architecture Patterns

### Pattern 1: Query Key Factory

**What:** Centralized query key definitions in `lib/queryKeys.ts`
**Verified:** TanStack Query docs recommend this pattern; TkDodo's blog explicitly advocates it.

```typescript
// lib/queryKeys.ts
export const queryKeys = {
  articles: {
    all: ["articles"] as const,
    list: (filters: Record<string, unknown>) => ["articles", filters] as const,
  },
  feeds: {
    all: ["feeds"] as const,
  },
  categories: {
    all: ["categories"] as const,
    newCount: ["categories", "new-count"] as const,
  },
  preferences: {
    all: ["preferences"] as const,
  },
  scoringStatus: {
    all: ["scoring-status"] as const,
  },
  ollama: {
    health: ["ollama-health"] as const,
    models: ["ollama-models"] as const,
    config: ["ollama-config"] as const,
    prompts: ["ollama-prompts"] as const,
    downloadStatus: ["download-status"] as const,
    sidebarDownloadStatus: ["sidebar-download-status"] as const,
  },
};
```

**Current state:** 60+ inline query key strings across 12 files. `["categories"]` alone appears ~20 times in useCategories.ts.

**Note on redundant invalidation:** `queryClient.invalidateQueries({ queryKey: ["categories"] })` already covers `["categories", "new-count"]` because TanStack Query matches by prefix. Every mutation in useCategories that invalidates both `["categories"]` AND `["categories", "new-count"]` is doing redundant work. However, the inverse is NOT true -- invalidating `["categories", "new-count"]` does NOT invalidate `["categories"]`. After query key centralization, the planner should evaluate which invalidation calls can be removed vs. which need both (e.g., acknowledgeMutation only invalidates new-count, not all categories -- that's correct and intentional).

### Pattern 2: MutationCache Global Error Handler

**What:** Centralized error toast via `MutationCache.onError` in `queryClient.ts`
**Verified via Context7:** MutationCache global callbacks are **always executed** and "differ from `defaultOptions` because they cannot be overridden by individual mutations." (Source: TanStack Query docs, MutationCache reference)

**Critical implementation detail:** Since the global `onError` always fires, the "skip mutations with their own onError" behavior CANNOT be achieved by the callback system alone. Instead, use a `meta` flag to signal intent:

```typescript
// lib/queryClient.ts
import { QueryClient, MutationCache } from "@tanstack/react-query";
import { toaster } from "@/components/ui/toaster";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Skip if the mutation handles its own errors
      if (mutation.options.meta?.handlesOwnErrors) return;

      const title = (mutation.options.meta?.errorTitle as string) ?? "Operation failed";
      toaster.create({
        title,
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        type: "error",
      });
    },
  }),
});
```

Mutations with optimistic rollback (updateCategoryMutation) set `meta: { handlesOwnErrors: true }` and keep their own `onError`. Mutations that need custom error titles set `meta: { errorTitle: "Failed to create category" }`. Mutations with no error handling at all (useFeedMutations, usePreferences, useOllamaConfig) get automatic toast coverage for free.

**TypeScript registration for meta types:**

```typescript
// At the top of queryClient.ts or in a separate declaration file
import "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      errorTitle?: string;
      handlesOwnErrors?: boolean;
    };
  }
}
```

### Pattern 3: Mutation Object Exposure

**What:** Hooks return mutation objects instead of thin `.mutate()` wrappers
**Current state in useCategories:** 11 mutations wrapped in thin functions (e.g., `updateCategory: (id, data) => updateCategoryMutation.mutate(...)`) that hide `.isPending`, `.mutateAsync()`, `.error`.

**Target pattern:**

```typescript
// Before (current)
return {
  updateCategory: (id, data) => updateCategoryMutation.mutate({ id, data }),
  createCategory: (name, pid) => createCategoryMutation.mutate({ displayName: name, parentId: pid }),
  // ... 9 more wrappers
};

// After
return {
  categories: categoriesQuery.data ?? [],
  newCount: newCountQuery.data?.count ?? 0,
  isLoading: categoriesQuery.isLoading,
  updateCategoryMutation,
  createCategoryMutation,
  deleteCategoryMutation,
  hideMutation,
  unhideMutation,
  acknowledgeMutation,
  mergeMutation,
  batchMoveMutation,
  batchHideMutation,
  batchDeleteMutation,
  ungroupParentMutation,
};
```

**Exception:** The `updateCategory` wrapper adds auto-acknowledge logic (`is_seen: true` when changing weight). This logic should move to the consuming component or stay as a named helper alongside the mutation object.

### Pattern 4: useRenameState Hook

**What:** Extract shared rename state/behavior from 4 component implementations
**Components affected:** CategoryParentRow, CategoryChildRow, CategoryUngroupedRow, FeedRow

**Verified duplication:** All four components have identical state logic:
- `useState(false)` for `isRenaming`
- `useState(category.display_name)` for `renameValue`
- `useRef<HTMLInputElement>(null)` for `inputRef`
- `useEffect` to focus/select on rename start
- `handleRenameSubmit()` -- trim, compare, call onRename, reset
- `handleRenameCancel()` -- reset value and exit rename mode

```typescript
// hooks/useRenameState.ts
export function useRenameState(currentName: string, onRename: (newName: string) => void) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const startRename = () => {
    setRenameValue(currentName);
    setIsRenaming(true);
  };

  const handleSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== currentName) {
      onRename(trimmed);
    }
    setIsRenaming(false);
    setRenameValue(currentName);
  };

  const handleCancel = () => {
    setIsRenaming(false);
    setRenameValue(currentName);
  };

  return { isRenaming, renameValue, setRenameValue, startRename, handleSubmit, handleCancel, inputRef };
}
```

### Pattern 5: ConfirmDialog Component

**What:** Reusable confirmation dialog replacing 2 inline instances in CategoriesSection
**Current state:** CategoriesSection.tsx has two nearly identical Dialog.Root blocks (lines 436-476 for batch ungroup, lines 479-519 for parent ungroup), both wrapped in redundant `<Portal>`.

```typescript
// components/ui/confirm-dialog.tsx (or similar)
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  confirmColorPalette?: string;
  onConfirm: () => void;
}
```

DeleteCategoryDialog already handles complex body content (parent vs child vs bulk). It can optionally compose ConfirmDialog internally, but its existing structure is clean enough that this is discretionary.

### Anti-Patterns to Avoid

- **Mutation factory abstraction:** Do NOT create `createMutation(options)` helpers. Each mutation's invalidation pattern is unique. The 5-6 lines per mutation after MutationCache centralization is the right level of explicitness.
- **queryOptions() for single-consumer queries:** Each query in this codebase has exactly one wrapping hook. queryOptions() adds value when the same query config is reused across multiple places (e.g., prefetching + rendering). Not our pattern.
- **Global colorPalette default:** Setting colorPalette on a top-level provider inverts the maintenance burden (must opt-out on every neutral component). Per-component is correct.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Global mutation error handling | Per-mutation toast boilerplate | `MutationCache.onError` | Eliminates ~50 lines of identical onError blocks |
| Query key management | Inline string literals | `queryKeys.ts` factory object | Single source of truth; enables Find All References |
| Tooltip portalling | Manual Portal > Positioner > Content | `@/components/ui/tooltip` wrapper | Already exists; prevents forgotten Portal bugs |

## Common Pitfalls

### Pitfall 1: MutationCache onError Always Fires

**What goes wrong:** Assuming that per-mutation `onError` prevents the global `onError` from running. It does not. Both always fire.
**Why it happens:** TanStack Query docs explicitly state: global callbacks "cannot be overridden by individual mutations."
**How to avoid:** Use `meta.handlesOwnErrors` flag to let the global handler skip mutations that manage their own errors (e.g., optimistic rollback mutations). The global handler checks `mutation.options.meta?.handlesOwnErrors` and returns early if true.
**Confidence:** HIGH (verified via Context7, TanStack Query MutationCache reference)

### Pitfall 2: Query Key Prefix Invalidation Semantics

**What goes wrong:** Thinking `invalidateQueries({ queryKey: ["categories", "new-count"] })` also invalidates `["categories"]`. It does not. Prefix matching goes in ONE direction: `["categories"]` matches `["categories", "new-count"]`, but not the reverse.
**Why it happens:** Misunderstanding TanStack Query's fuzzy matching (it matches by prefix, left-to-right).
**How to avoid:** When cleaning up redundant invalidation, only remove the MORE SPECIFIC key when the LESS SPECIFIC key is also invalidated. Never remove the less specific key assuming the more specific one covers it.
**Confidence:** HIGH (TanStack Query docs, verified behavior)

### Pitfall 3: WeightPresetStrip useEffect Removal Cascading to Optimistic Updates

**What goes wrong:** Removing the `useEffect` sync from WeightPresetStrip without accounting for the optimistic update flow. The component currently uses `localValue` state + `useEffect` sync so that the UI reflects the optimistic value instantly before the server responds.
**Why it happens:** The prop `value` comes from query data which updates on `onSettled` invalidation. Without local state, the component would flash back to the old value between the mutation call and the query refetch.
**How to avoid:** Two approaches: (a) make WeightPresetStrip fully controlled and push optimistic state management to the parent/mutation, or (b) use the mutation's `isPending` state to determine when to show optimistic vs confirmed value. The planner should define the specific approach.
**Confidence:** MEDIUM (implementation approach is discretionary per user constraints)

### Pitfall 4: InterestsSection Form State Overwrite

**What goes wrong:** Removing the `useEffect` sync in InterestsSection without considering that `preferences` query data can refetch while the user is typing. The current `useEffect` re-syncs form state on every refetch, potentially overwriting unsaved edits.
**Why it happens:** TanStack Query refetches on window focus by default. If the user switches tabs and returns, `preferences` data refetches and the `useEffect` runs, clobbering their form edits.
**How to avoid:** Initialize form state from server data on mount only. Use a `key` prop tied to a save counter to reset the form after successful save. Do NOT re-sync on every refetch.
**Confidence:** HIGH (standard React form pattern)

### Pitfall 5: Dialog Portal Removal in Chakra v3

**What goes wrong:** Removing `<Portal>` from Dialog without checking the Chakra v3 version's actual behavior. Some early v3 versions required it.
**Why it happens:** The convention changed between Chakra versions.
**How to avoid:** The codebase is on `@chakra-ui/react` ^3.32.0 where `Dialog.Positioner` handles portalling internally. The AddFeedDialog (no Portal) and ModelManagement delete dialog (no Portal) both work correctly. The CategoriesSection dialogs and DeleteCategoryDialog have explicit Portal that is redundant.
**Confidence:** HIGH (verified by existing working code in same codebase -- AddFeedDialog has no Portal and works)

### Pitfall 6: Removing "use client" From Hook Files

**What goes wrong:** Hooks that use `useState`, `useEffect`, `useQuery`, `useMutation` etc. require client context. Removing "use client" from a hook file causes a build error if it's imported in a server component chain.
**Why it happens:** In Next.js App Router, hooks that use React state/effects must be in client components. The "use client" directive on hook files is necessary.
**How to avoid:** Only remove "use client" from files that genuinely don't use client-side React APIs. In this codebase, ALL hook files and ALL interactive components correctly have "use client". The only candidates for removal would be pure utility files (lib/api.ts, lib/types.ts, lib/utils.ts, lib/queryClient.ts) -- but they don't have the directive anyway.
**Confidence:** HIGH

## Code Examples

### Confirmed Dead Code Inventory

**Dead files (confirmed by codebase analysis):**

| File | Status | Evidence |
|------|--------|----------|
| `components/settings/CategoryRow.tsx` | DEAD | Old category row from pre-08.2 data model; imports `useSortable`, `WeightPresets` (also dead); no imports found from other files |
| `components/settings/WeightPresets.tsx` | DEAD | Replaced by `WeightPresetStrip.tsx` in Phase 08.1; only imported by dead `CategoryRow.tsx` |
| `components/settings/SwipeableRow.tsx` | DEAD | Phase 08.1-04 created this; Phase 08.3 removed swipe gesture in favor of context menus; only imported by dead code |

**Dead code fragments:**

| Location | What | Fix |
|----------|------|-----|
| `ArticleList.tsx` L168 | `(filter === "unread" \|\| filter === "all") && ... && filter === "unread"` -- the `filter === "all"` branch is dead | Simplify to `filter === "unread" && selectedFeedId && articleCount > 0` |
| `useOllamaConfig.ts` L28 | `savedConfig: query.data` -- alias of `config` (same `query.data`) | Remove `savedConfig` from return, update consumers to use `config` |

**Verification needed before removal:**

| Item | Check |
|------|-------|
| `CategoryRow.tsx` imports | Grep for `from.*CategoryRow` -- expect zero matches in non-dead files |
| `WeightPresets.tsx` imports | Grep for `from.*WeightPresets[^S]` (not WeightPresetStrip) -- expect only CategoryRow.tsx |
| `SwipeableRow.tsx` imports | Grep for `from.*SwipeableRow` -- expect zero matches in non-dead files |

### Hardcoded Color Inventory

| File | Line | Current | Fix |
|------|------|---------|-----|
| `ArticleReader.tsx` | 282 | `bg: "oklch(13% 0.008 55)"` | New token `bg.code` |
| `AddFeedDialog.tsx` | 177 | `color="green.600"` | New token `fg.success` |
| `ModelSelector.tsx` | 186-187 | `color="var(--chakra-colors-orange-400)"` and `color="orange.400"` | New token `fg.warning` |
| `ModelManagement.tsx` | 340 | `color="red.400"` | New token `fg.error` (or use existing Chakra error color) |
| `OllamaHealthBadge.tsx` | 26, 36 | `bg="red.500"`, `bg="green.500"` | New tokens `status.error`, `status.success` (or `fg.error`, `fg.success`) |

### var(--chakra-colors-*) on React-Icons Inventory

| File | Line | Current | Fix |
|------|------|---------|-----|
| `FeedRow.tsx` | 180 | `border: "1px solid var(--chakra-colors-border-subtle)"` | Replace with Chakra `Input` component |
| `ModelSelector.tsx` | 186 | `color="var(--chakra-colors-orange-400)"` | Set `color="fg.warning"` on parent Flex |
| `OllamaSection.tsx` | 100 | `color="var(--chakra-colors-fg-subtle)"` | Set `color="fg.subtle"` on parent Flex |
| `OllamaPlaceholder.tsx` | 15 | `color="var(--chakra-colors-fg-subtle)"` | Set `color="fg.subtle"` on parent |
| `FeedbackPlaceholder.tsx` | 15 | `color="var(--chakra-colors-fg-subtle)"` | Set `color="fg.subtle"` on parent |
| `CategoryParentRow.tsx` | 93 | `color="var(--chakra-colors-fg-muted)"` | Set `color="fg.muted"` on parent (already present for chevron, add for folder) |
| `FeedsSection.tsx` | 227 | `color="var(--chakra-colors-fg-subtle)"` | Set `color="fg.subtle"` on parent |
| `SettingsSidebar.tsx` | 104 | `color="var(--chakra-colors-accent-solid)"` | Set `color="accent.solid"` on parent Box |
| `CategoriesSection.tsx` | 350 | `color="var(--chakra-colors-fg-subtle)"` | Set `color="fg.subtle"` on parent Flex |

### Magic Number Inventory

**Cross-file (need `lib/constants.ts`):**

| Constant | Value | Used In |
|----------|-------|---------|
| `HEADER_HEIGHT` | `"64px"` | Header.tsx (height), Sidebar.tsx (top), AppShell.tsx (pt) |
| `SIDEBAR_WIDTH_COLLAPSED` | `"48px"` | Sidebar.tsx (width), AppShell.tsx (ml) |
| `SIDEBAR_WIDTH_EXPANDED` | `"240px"` | Sidebar.tsx (width), AppShell.tsx (ml) |

**Single-file (named const at top of file):**

| Constant | Value | File |
|----------|-------|------|
| `AUTO_MARK_READ_DELAY` | `12000` | useAutoMarkAsRead.ts |
| `PAGE_SIZE` | `50` | useArticles.ts |
| `SCORING_ACTIVE_POLL_INTERVAL` | `10000` | useArticles.ts |
| `SCORING_TAB_POLL_INTERVAL` | `5000` | useArticles.ts |
| `SCORING_STATUS_ACTIVE_INTERVAL` | `2500` | useScoringStatus.ts |
| `SCORING_STATUS_IDLE_INTERVAL` | `30000` | useScoringStatus.ts |
| `DOWNLOAD_STATUS_POLL_INTERVAL` | `1000` | useModelPull.ts |
| `SIDEBAR_DOWNLOAD_POLL_INTERVAL` | `3000` | SettingsSidebar.tsx |
| `NEW_COUNT_POLL_INTERVAL` | `30000` | SettingsSidebar.tsx, Header.tsx, useCategories.ts |
| `HIGH_SCORE_THRESHOLD` | `15` | ArticleRow.tsx, ScoreBadge.tsx |
| `MAX_VISIBLE_TAGS` | `3` | ArticleRow.tsx |
| `COMPLETING_ARTICLE_DURATION` | `3000` | useCompletingArticles.ts |
| `HEALTH_POLL_INTERVAL` | `20000` | useOllamaHealth.ts |
| `SCORE_100_PERCENT_DELAY` | `500` | useModelPull.ts |

**Note on `NEW_COUNT_POLL_INTERVAL`:** Used in 3 places (Header.tsx, SettingsSidebar.tsx, useCategories.ts) -- should go in `lib/constants.ts`.

### Dialog Portal Cleanup Inventory

Dialogs with redundant `<Portal>` wrapper that should be removed:

| File | Lines | Dialog |
|------|-------|--------|
| `CategoriesSection.tsx` | 442-475 | Ungroup batch confirmation |
| `CategoriesSection.tsx` | 485-518 | Ungroup parent confirmation |
| `DeleteCategoryDialog.tsx` | 26-79 | Delete category dialog |
| `MoveToGroupDialog.tsx` | 69-174 | Move to group dialog |

Dialogs WITHOUT Portal (correct pattern):

| File | Dialog |
|------|--------|
| `AddFeedDialog.tsx` | Add feed dialog |
| `DeleteFeedDialog.tsx` | Delete feed dialog |
| `ModelManagement.tsx` | Delete model dialog |

### Tooltip Inconsistency

| File | Pattern | Status |
|------|---------|--------|
| `ScoreBadge.tsx` | Raw `Tooltip.Root` / `Tooltip.Trigger` / `Tooltip.Positioner` / `Tooltip.Content` | WRONG -- no Portal |
| `WeightPresetStrip.tsx` | `@/components/ui/tooltip` wrapper | CORRECT |

### File Organization Misplacements

| Item | Current Location | Correct Location |
|------|-----------------|------------------|
| `ScoringStatus` interface | `lib/api.ts` L295-304 | `lib/types.ts` |
| `DownloadStatus` interface | `lib/api.ts` L389-395 | `lib/types.ts` |
| `parseSortOption` function | `lib/types.ts` L87-94 | `lib/utils.ts` (it's a runtime function, not a type) |
| `API_BASE_URL` constant | `lib/api.ts` L13-14 AND `hooks/useModelPull.ts` L7-8 | Single definition in `lib/api.ts`, imported by useModelPull |
| `FetchArticlesParams` interface | `lib/api.ts` L16-25 | Could stay in api.ts (it's API-specific) or move to types.ts |

### Sidebar "All Articles" colorPalette Fix

The "All Articles" row in Sidebar.tsx (L174-196) uses `colorPalette.subtle` and `colorPalette.solid` but never sets `colorPalette="accent"`. This causes it to resolve to the default gray palette instead of the orange accent. Fix: add `colorPalette="accent"` to the Flex element.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-mutation onError toasts | MutationCache.onError global handler | TanStack Query v4+ (MutationCache) | Eliminates ~50 lines of identical onError boilerplate |
| Inline query key strings | Query key factory objects | Community best practice (TkDodo 2021+) | Single source of truth, IDE autocomplete, type safety |
| useState + useEffect for server-to-form sync | key prop for form reset, initialize once on mount | React team recommendation (2023+) | Eliminates stale-data overwrite bugs |
| wrapper functions hiding mutation state | Direct mutation object exposure | TanStack Query v5 improved types | Consumers get full isPending/error/mutateAsync access |

## Open Questions

1. **WeightPresetStrip controlled vs uncontrolled after useEffect removal**
   - What we know: The current useEffect syncs `localValue` from `value` prop for optimistic feedback. Removing it means the component needs a different optimism strategy.
   - What's unclear: Should the parent manage optimistic state (pass the optimistic value as `value`), or should the mutation's onMutate set cache data that flows through?
   - Recommendation: Make WeightPresetStrip fully controlled (no local state). The parent/mutation already manages optimistic cache updates in useCategories via `onMutate`. The `value` prop will reflect the optimistic cache data, eliminating the need for component-level local state. Test this assumption during implementation -- if there's a visible flash, add local state back.

2. **ArticleRow React.memo assessment**
   - What we know: ArticleRow renders in lists of 50+ items. It receives `article`, `feedName`, callbacks, `isCompleting`, `scoringPhase` props.
   - What's unclear: Whether re-renders are actually a problem (no profiling data).
   - Recommendation: Add React.memo to ArticleRow defensively. The component's props are either primitive (string, boolean) or stable references (article object from query cache, memoized callbacks). Low risk, potential upside for large lists.

3. **Sub-phase split recommendation**
   - The scope fits in a single phase (estimated 4-5 plans). The work items have natural dependency order but no item is so large it needs its own phase.
   - Recommendation: Keep as single Phase 9 with 4-5 well-ordered plans, not split into sub-phases.

## Recommended Plan Structure

Based on dependency analysis:

**Plan 1: Infrastructure -- Query keys, MutationCache, constants, file organization**
- Create `lib/queryKeys.ts` with all query key definitions
- Add `MutationCache.onError` to `queryClient.ts` with meta type registration
- Create `lib/constants.ts` with cross-file constants (HEADER_HEIGHT, SIDEBAR_WIDTH_*, NEW_COUNT_POLL_INTERVAL)
- Move types from api.ts to types.ts, parseSortOption to utils.ts
- Deduplicate API_BASE_URL (useModelPull imports from api.ts)
- Single-file constants named at top of their files
- ~8 files touched, foundational for Plans 2-3

**Plan 2: Hook refactors -- useCategories, useFeedMutations, usePreferences, useOllamaConfig**
- Replace all inline query key strings with queryKeys.* references
- Remove per-mutation onError boilerplate (covered by MutationCache now)
- Add `meta` tags for error titles and `handlesOwnErrors` flags
- Expose mutation objects directly from useCategories (remove 11 wrapper functions)
- Remove `savedConfig` alias from useOllamaConfig
- Extract `useRenameState` hook
- Fix useEffect patterns (ArticleReader key prop, InterestsSection init-once, WeightPresetStrip controlled)
- Update all consuming components for new hook return shapes
- ~15 files touched, highest-risk plan

**Plan 3: Component cleanup -- dedup, tokens, patterns**
- Extract ConfirmDialog, replace 2 inline dialogs in CategoriesSection
- Extract ModelRow from ModelManagement (~100 lines saved)
- Replace FeedRow raw `<input>` with Chakra Input
- Add semantic tokens (bg.code, fg.success, fg.warning, status.error, status.success)
- Replace all hardcoded colors with tokens
- Fix all var(--chakra-colors-*) on react-icons (9 instances)
- Standardize Tooltip usage (ScoreBadge)
- Remove redundant Portal from Dialog components (4 instances)
- Fix Sidebar "All Articles" colorPalette
- ~15 files touched

**Plan 4: Dead code removal and broader sweep**
- Delete dead files: CategoryRow.tsx, WeightPresets.tsx, SwipeableRow.tsx
- Fix dead filter branch in ArticleList.tsx
- Performance sweep: React.memo on ArticleRow, evaluate inline computations
- Import/export hygiene audit
- Verify no functional regressions (build check, lint check)
- Update `.learning/` files with findings from the phase
- ~5-8 files touched

## Sources

### Primary (HIGH confidence)
- Context7: `/tanstack/query` -- MutationCache global callbacks, meta type registration, useMutation API
- Codebase analysis: All 60 frontend/src TypeScript files read and analyzed
- AGENTS.md and .learning/INDEX.md -- project conventions and patterns

### Secondary (MEDIUM confidence)
- TkDodo's blog (via TanStack Query docs references) -- query key factory pattern, mutation best practices
- React documentation -- key prop for state reset, useEffect anti-patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns verified against existing codebase
- Architecture patterns: HIGH -- MutationCache verified via Context7, query keys are well-documented community pattern
- Pitfalls: HIGH -- MutationCache "always fires" behavior explicitly documented; prefix matching confirmed
- Dead code identification: HIGH -- every file physically read and cross-referenced
- Theme/token analysis: HIGH -- every hardcoded color instance found via grep

**Research date:** 2026-02-19
**Valid until:** indefinite (internal codebase analysis, no external API dependencies)
