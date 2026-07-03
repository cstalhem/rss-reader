---
created: 2026-02-17T21:25:59.356Z
title: Adopt article reader weight pattern in settings view
area: ui
files:
  - frontend/src/components/article/ArticleReader.tsx
  - frontend/src/components/article/TagChip.tsx
  - frontend/src/components/settings/WeightPresetStrip.tsx
  - frontend/src/components/settings/CategoryChildRow.tsx
  - frontend/src/components/settings/CategoryParentRow.tsx
---

## Problem

The weight preset buttons in the category settings view have a noticeable delay between click and visual update, while the weight change on tag chips in the article reader header updates instantly ("snappy"). Both use optimistic local state, but the article reader pattern (optimisticWeights Record + immediate setState) achieves faster visual feedback than the settings pattern (localValue + useEffect sync from prop).

## Solution

Compare the two implementations side by side:
- **Article reader** (`ArticleReader.tsx`): `optimisticWeights` state dict, set immediately on click, read via `optimisticWeights[cat.id] ?? cat.effective_weight`
- **Settings** (`WeightPresetStrip.tsx`): `localValue` state, set on click, but synced from `value` prop via `useEffect`

The `useEffect` sync in settings adds a render cycle delay. Consider adopting the article reader's direct state pattern in `WeightPresetStrip`, or investigate if the extra render cycle comes from the TanStack Query optimistic update + invalidation chain in `useCategories` causing unnecessary re-renders before the local state settles.
