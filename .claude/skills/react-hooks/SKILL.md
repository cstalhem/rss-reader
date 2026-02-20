---
name: react-hooks
description: React hook patterns — key prop reset, controlled components, async data init, useDeferredValue vs useTransition, React.memo, useEffect anti-patterns
---

# React Hooks

Deep reference for the React hook patterns used in this project. For concise rules, see `.claude/rules/frontend.md`.

## Key Patterns

### `key` Prop for Component State Reset

When a component needs to reset all internal state when a prop changes, use `key` on the parent instead of `useEffect`:

```tsx
// In ArticleList.tsx (parent):
<ArticleReader key={selectedArticle?.id} article={selectedArticle} />
```

When `selectedArticle.id` changes, React unmounts the old `ArticleReader` and mounts a new one. All `useState` hooks reinitialize to their defaults. No `useEffect` needed.

**Why this works better than useEffect:**

- Zero intermediate renders (no render-with-stale-state → effect-fires → re-render-with-reset-state)
- Impossible to forget a state variable — unmounting resets everything
- No dependency array to maintain

**When to use:** When the component has multiple pieces of internal state that all need resetting on a prop change. If only one value needs updating, derived state or a controlled prop is simpler.

### Fully Controlled Components (No Local State Sync)

When a parent provides optimistic updates (e.g., via TanStack Query's `onMutate`), child components don't need local state copies:

```tsx
// WeightPresetStrip — fully controlled, no local value state
const WeightPresetStripComponent = ({ value, onChange }: Props) => {
  const [isExpanded, setIsExpanded] = React.useState(false); // only UI state

  return (
    <Flex>
      {WEIGHT_OPTIONS.map((option) => (
        <IconButton
          variant={value === option.value ? "outline" : "ghost"} // reads prop directly
          onClick={() => onChange(option.value)} // parent updates cache optimistically
        />
      ))}
    </Flex>
  );
};
```

**Before:** `WeightPresetStrip` had `localValue` state + `useEffect(() => setLocalValue(value), [value])` to sync. This caused an extra render on every change and was fragile (what if useEffect runs late?).

**After:** The `value` prop comes from TanStack Query cache, which updates **synchronously** via `onMutate` optimistic update. No flash, no lag. The component just reads the prop.

**Rule:** If the parent guarantees instant prop updates (optimistic cache, controlled form), don't duplicate state in the child.

### Extract Child Component for Async Data Initialization

When a form needs to initialize from async data (e.g., server preferences), extract a child component that renders only when data is available:

```tsx
// InterestsSection.tsx — parent handles loading state
export function InterestsSection() {
  const { preferences, isLoading, updatePreferencesMutation } =
    usePreferences();

  if (isLoading || !preferences) return <Skeleton />;

  // InterestsForm renders only when preferences exists
  return (
    <InterestsForm
      preferences={preferences}
      updatePreferencesMutation={updatePreferencesMutation}
    />
  );
}

// InterestsForm — useState initializer runs once on mount with guaranteed data
function InterestsForm({ preferences, updatePreferencesMutation }: Props) {
  const [interests, setInterests] = useState(preferences.interests || "");
  const [antiInterests, setAntiInterests] = useState(
    preferences.anti_interests || "",
  );
  // No useEffect needed — useState initializer captures the value on mount
}
```

**Why not `useEffect` for initialization?**

- `useEffect(() => setInterests(preferences.interests), [preferences])` re-syncs on every TanStack Query refetch, silently overwriting the user's unsaved edits
- An `initialized` ref guard (`if (!initialized.current)`) still triggers lint warnings (`react-hooks/set-state-in-effect`)
- The extracted component pattern is the cleanest solution — `useState` initializer runs exactly once at mount

### Extracting Shared Stateful Logic (`useRenameState`)

When 4+ components have identical state management (useState + useRef + useEffect + handlers), extract a custom hook:

```typescript
// useRenameState.ts — shared by CategoryParentRow, CategoryChildRow, CategoryUngroupedRow, FeedRow
export function useRenameState(
  currentName: string,
  onRename: (newName: string) => void,
) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  // ... focus/select on mount, submit with trim+compare, cancel with reset
}
```

**Extraction criteria:** The pattern must be truly identical across consumers — same state shape, same handlers, same side effects. If consumers need different behaviors, parameterize via callback props (like `onRename`) rather than adding config flags.

### `useDeferredValue` vs `useTransition` for Deferred Rendering

Both defer expensive renders, but they control different things:

- **`useDeferredValue(value)`** — defers the *read*. Urgent readers (e.g., sidebar highlighting) see the new value instantly; expensive readers (e.g., content area) lag behind with the old value. Use when different parts of the UI need different urgency from the same state.
- **`useTransition`** — defers the *write*. All readers see the old value until the transition completes. Use for self-contained deferred work within a component.

**When the expensive component is a child mounting on tab switch**, prefer `useTransition` inside the child over `useDeferredValue` in the parent:

```tsx
// GOOD — component owns its loading story
function CategoriesSection() {
  const { isLoading } = useCategories();
  const [treeReady, setTreeReady] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => setTreeReady(true));
  }, [startTransition]);

  return (
    <Stack>
      {/* Shell renders instantly — real title, badge, action bar, search */}
      <Header />
      <ActionBar />
      <SearchInput />
      {isLoading || !treeReady ? <Skeleton /> : <ExpensiveTree />}
    </Stack>
  );
}

// BAD — parent duplicates child's shell for skeleton
function Page() {
  const deferred = useDeferredValue(activeSection);
  const isPending = activeSection !== deferred;

  // Parent must maintain a fake shell copy that drifts from reality
  {isPending && activeSection === "categories" ? (
    <CategoriesShellSkeleton /> // missing badge, noop handlers, disabled inputs
  ) : (
    <CategoriesSection />
  )}
}
```

**How the `useTransition` on-mount pattern works:**
1. Component mounts with `treeReady=false` → shell + skeleton paints (~50ms)
2. `useEffect` fires after paint, wraps `setTreeReady(true)` in `startTransition`
3. React renders the heavy tree in the background, shell stays visible and responsive
4. When ready, React swaps in the real tree
5. Handles both cold cache (`isLoading=true`) and warm cache (`isLoading=false`, `treeReady=false`)

### Conditional Rendering over `display: none` for Mounted Subtrees

When switching between views (tabs, accordion panels, mobile/desktop layouts), prefer conditional rendering over CSS hiding:

```tsx
// GOOD — inactive sections unmounted, TanStack Query cache prevents reload flash
{activeSection === "feeds" && <FeedsSection />}
{activeSection === "categories" && <CategoriesSection />}

// BAD — all sections mounted, each with hooks, portals, event listeners
<Box display={activeSection === "feeds" ? "block" : "none"}><FeedsSection /></Box>
<Box display={activeSection === "categories" ? "block" : "none"}><CategoriesSection /></Box>
```

**Why it matters:** `display: none` hides visually but keeps the full React subtree alive — hooks run, context subscriptions fire, portals mount. In a list of N items where each has tooltips/menus/buttons, this means N hidden subtrees contributing to DOM size and re-render cost.

**Real impact:** Settings page went from 8131 → 4215 DOM nodes (48% reduction) by switching desktop sections from display-toggle to conditional rendering.

**Applies to Chakra `Collapsible` too:** `Collapsible.Content` renders children to DOM even when `data-state="closed"` (CSS hidden). For lists where collapsed groups have many children, use `{isExpanded && <children>}` instead. Trade-off: no expand/collapse CSS animation.

**When `display: none` is fine:** Single static elements, or components with no hooks/portals (pure layout wrappers). The problem is mounted *component trees*, not hidden *DOM nodes*.

### `React.memo` on List Item Components

Wrap list item components in `React.memo` when they render in lists of 50+ items:

```typescript
export const ArticleRow = React.memo(function ArticleRow(
  props: ArticleRowProps,
) {
  // ...
});
```

**When it helps:** ArticleRow renders in lists of 50. When any article updates (e.g., one is marked as read), React re-renders the parent list, which re-renders all 50 rows. `React.memo` skips rows whose props haven't changed.

**When to skip:** Components rendered once or in small lists (< 10 items). The shallow comparison cost isn't worth it.

**Callback stability chains:** `React.memo` only works when ALL props are referentially stable. One unstable callback prop defeats the entire memoization. Instability cascades:

1. Hook returns inline function → consumer's `useCallback` dep is unstable → `useCallback` recreates → child memo sees new prop → full re-render

To verify memo is working, check prop stability at every link: hook return values → parent `useCallback` deps → props passed to memo'd children. Use React DevTools profiler or fiber inspection (`__reactFiber` on DOM nodes → walk up → compare `memoizedProps`) to identify which props break memo.

**Inline closures in `.map()` loops:** A common cause of broken memo. When a parent maps over items and creates inline callbacks like `onClick={() => handler(item.id)}`, every child gets a new function reference each render. Fix: pass a stable callback that accepts the ID, and let each child bind its own ID internally via `useCallback`.

## Anti-Patterns

### `useEffect` for State Reset on Prop Change

```typescript
// BAD — extra render, fragile dependency array
useEffect(() => {
  setOptimisticWeights({});
  setLocalState(initialValue);
}, [article?.id]);

// GOOD — key prop resets everything
<ArticleReader key={article?.id} article={article} />
```

### `useEffect` for Data Sync (Local Copy of Server Data)

```typescript
// BAD — overwrites user edits on every refetch
useEffect(() => {
  if (preferences) setInterests(preferences.interests);
}, [preferences]);

// GOOD — extract child, initialize once via useState
function Form({ preferences }) {
  const [interests, setInterests] = useState(preferences.interests);
}
```

### `useEffect` + `useState` to Mirror a Prop

```typescript
// BAD — extra render cycle, stale for one frame
const [localValue, setLocalValue] = useState(value);
useEffect(() => setLocalValue(value), [value]);

// GOOD — read the prop directly (controlled component)
// or use key prop on parent if full reset is needed
```

## Decision Aids

### Which pattern for "reset state when X changes"?

| Scenario                           | Pattern                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| Multiple states need resetting     | `key` prop on parent                                                |
| Single derived value               | Compute during render (no state at all)                             |
| Form initialized from async data   | Extract child, guard with loading check, use `useState` initializer |
| Parent provides optimistic updates | Fully controlled (read prop directly)                               |
