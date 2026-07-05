---
name: common-mistakes
description: Cross-cutting mistakes discovered during development — useEffect misuse, query key drift, mutation wrappers, and process mistakes
---

# Common Mistakes

Cross-cutting mistakes discovered during development. Check before implementing similar patterns.

## Frontend Mistakes

### 1. `useEffect` for Form Initialization from Async Data

**What went wrong:** `InterestsSection` used `useEffect(() => { setInterests(preferences.interests) }, [preferences])` to initialize form state from server data. Every TanStack Query background refetch triggered the effect, silently overwriting user edits.

**First attempted fix was also wrong:** Using an `initialized` ref guard (`if (!initialized.current)`) still triggered `react-hooks/set-state-in-effect` lint warning.

**Correct fix:** Extract a child component (`InterestsForm`) that renders only when `preferences` is available. The child uses `useState(preferences.interests)` as its initializer — runs once on mount, never re-syncs. See the `react-hooks` skill for the full pattern.

### 2. `useEffect` + Local State to Mirror a Prop

**What went wrong:** `WeightPresetStrip` had `useState(value)` + `useEffect(() => setLocalValue(value), [value])` to track the parent's `value` prop locally. This caused an extra render on every change (render with stale value → effect fires → re-render with new value).

**Why it existed:** The developer assumed the parent's prop update would be async (network round-trip), so local state was needed for responsiveness. In reality, `useCategories` has an optimistic `onMutate` that updates the query cache synchronously — the prop updates instantly.

**Fix:** Remove local state entirely. Read `value` prop directly. Only keep local state for UI-only concerns (like `isExpanded` for hover animation).

**Lesson:** Before adding local state to mirror a prop, check whether the parent provides **optimistic updates**. If so, the prop is already instant.

### 3. Inline Query Key Strings Drifting

**What went wrong:** Most hooks used inline `queryKey: ["articles"]` strings. Over time, some files used slightly different strings for the same data, and invalidation silently missed queries.

**Fix:** Centralized all keys in `queryKeys.ts` factory. Grep for `queryKey: ["` should return zero matches across the codebase.

**Detection:** Any inline query key string is a bug. The grep pattern `queryKey: ["` catches both hooks and components. When doing a codebase-wide migration, grep components too, not just hooks — a `useQuery` called directly in a component (rather than through a custom hook) is easy to miss.

### 4. Thin Wrapper Functions Hiding Mutation State

**What went wrong:** `useCategories` returned `deleteCategory: (id) => deleteMutation.mutate(id)` — a thin wrapper that hid `isPending`, `mutateAsync`, `status`, and other mutation metadata. Consumers couldn't show loading states or handle async flows.

**Fix:** Return mutation objects directly: `deleteCategoryMutation`. Consumers call `deleteCategoryMutation.mutate(id)` and access `deleteCategoryMutation.isPending` for loading states.

**Exception:** Keep a wrapper when it adds **behavior**, not just delegation. `updateCategory` in `useCategories` adds auto-acknowledge logic (`is_seen: true` on weight changes) — that's a business rule worth encapsulating.

## Process Mistakes

### 5. Deferring Lint Errors Instead of Fixing Them

**What went wrong:** When encountering pre-existing lint errors in files not being modified, the instinct was to document them as "out of scope" and move on. This creates a broken window effect — unaddressed errors accumulate and become harder to fix later.

**Better approach:** Surface lint errors immediately. If they're trivial (unused import, missing escape), fix them in the same commit. If they require deeper investigation, create a todo or address them in the current work rather than leaving them for a vague "later".
