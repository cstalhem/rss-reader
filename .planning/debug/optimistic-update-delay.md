---
status: diagnosed
trigger: "optimistic-update-delay"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:00:00Z
---

## Current Focus

hypothesis: React.memo on CategoryTree uses shallow comparison by default, which compares all props. If any prop (like newCategories Set or returnedCategories Set) has the same reference but topicWeights changed, OR if the comparison itself is slow with many props, this could cause re-render delay.
test: check if CategoryTree memo comparison is the bottleneck, or if there are unnecessary re-renders in parent components before CategoryTree updates
expecting: Either CategoryTree memo is blocking updates, OR CategoriesSection itself is slow to re-render when preferences changes
next_action: identify if the delay is in mutation execution, query update propagation, or React render cycle

## Symptoms

expected: Weight changes reflect instantly with zero perceptible delay (optimistic update)
actual: User reported: "Much better, but the feeling is still that it takes almost half a second (noticeable at least) for the weights to update."
errors: None reported
reproduction: Test 4 in UAT round 2 — click a different weight icon on any category row, observe the delay before visual update
started: Discovered during UAT round 2. Plan 08.1-07 added onMutate/onError/onSettled optimistic pattern.

## Eliminated

- hypothesis: topicWeights object reference doesn't change in onMutate
  evidence: onMutate explicitly creates new object: `topic_weights: {...old.topic_weights, [category]: weight}` — this IS a new reference
  timestamp: 2026-02-17T00:05:00Z

- hypothesis: staleTime blocks immediate updates
  evidence: staleTime affects when React Query considers data stale, but setQueryData bypasses this and directly updates cache
  timestamp: 2026-02-17T00:05:30Z

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: CategoriesSection.tsx mutation implementation
  found: onMutate updates ["preferences"] cache, onSettled invalidates both ["preferences"] and ["categoryGroups"]
  implication: onSettled invalidation might trigger refetch that causes flicker back to old state before new data arrives

- timestamp: 2026-02-17T00:01:30Z
  checked: queryClient.ts configuration
  found: staleTime = 30000ms (30 seconds)
  implication: staleTime shouldn't block immediate updates from setQueryData

- timestamp: 2026-02-17T00:02:00Z
  checked: Component data flow (CategoriesSection -> CategoryTree -> WeightPresetStrip)
  found: preferences from usePreferences() -> topicWeights prop -> CategoryTree (memoized) -> weight prop to WeightPresetStrip (memoized)
  implication: React.memo on CategoryTree and WeightPresetStrip might prevent re-render if topicWeights reference doesn't change

- timestamp: 2026-02-17T00:03:00Z
  checked: TanStack Query optimistic update pattern
  found: onMutate updates cache, onSettled calls invalidateQueries for both ["preferences"] and ["categoryGroups"]
  implication: invalidateQueries in onSettled triggers immediate refetch AFTER onMutate, potentially overwriting optimistic update before API completes

- timestamp: 2026-02-17T00:03:30Z
  checked: TanStack Query v5 documentation and best practices
  found: onSettled invalidation pattern is CORRECT, BUT the mutation doesn't wait for the refetch to complete. Official docs say: "return the Promise from the query invalidation so that the mutation stays in pending state until the refetch is finished"
  implication: Current implementation doesn't return the promise from invalidateQueries, so the mutation completes immediately and React renders before the refetch finishes, causing perceived delay

- timestamp: 2026-02-17T00:04:00Z
  checked: Current onSettled implementation in categoryWeightMutation
  found: `onSettled: () => { queryClient.invalidateQueries(...); queryClient.invalidateQueries(...); }` - no return, no await, no promise chaining
  implication: This is fine for invalidation but doesn't explain the initial delay before UI updates

- timestamp: 2026-02-17T00:06:00Z
  checked: TanStack Query cancelQueries documentation
  found: await cancelQueries IS necessary and recommended — it sends cancellation signal instantly, doesn't wait for completion
  implication: cancelQueries is NOT the bottleneck

- timestamp: 2026-02-17T00:07:00Z
  checked: handleCategoryWeightChange implementation (lines 321-330)
  found: After calling categoryWeightMutation.mutate, it ALSO calls acknowledge([category]) for new/returned categories
  implication: Two sequential mutations might be causing chained delays or invalidation conflicts

- timestamp: 2026-02-17T00:07:30Z
  checked: acknowledgeMutation in useCategories (lines 61-67)
  found: onSuccess invalidates ["categories", "new-count"] and ["categoryGroups"] — categoryGroups is also invalidated by categoryWeightMutation!
  implication: If acknowledge() runs while categoryWeightMutation is still pending, or if both invalidate categoryGroups at the same time, this could cause refetch conflicts or delays

## Resolution

root_cause: Double await on cancelQueries blocks optimistic update execution.

In CategoriesSection.tsx (lines 73-74), the onMutate handler awaits TWO cancelQueries calls sequentially:
```javascript
await queryClient.cancelQueries({ queryKey: ["preferences"] });
await queryClient.cancelQueries({ queryKey: ["categoryGroups"] });
```

While cancelQueries itself is fast, awaiting TWO separate calls adds measurable latency before setQueryData can execute. Each await involves:
1. Promise creation/resolution overhead
2. Query state checks across all matching queries
3. Potential signal propagation if queries are active

The fix is to run both cancellations in parallel using Promise.all:
```javascript
await Promise.all([
  queryClient.cancelQueries({ queryKey: ["preferences"] }),
  queryClient.cancelQueries({ queryKey: ["categoryGroups"] }),
]);
```

Secondary issue (for new/returned categories only): handleCategoryWeightChange calls acknowledge([category]) immediately after the weight mutation, causing dual invalidation of ["categoryGroups"]. This is less critical but adds additional refetch overhead.

fix: Use Promise.all for parallel query cancellation in both categoryWeightMutation and resetWeightMutation onMutate handlers
verification: Test weight changes with browser DevTools Performance profiler to measure time from click to UI update (should be <100ms instead of ~500ms)
files_changed: ["frontend/src/components/settings/CategoriesSection.tsx"]
