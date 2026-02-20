---
name: react-hooks
description: React hook patterns — key prop reset, controlled components, async data initialization, custom hook extraction, React.memo, and useEffect anti-patterns
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
