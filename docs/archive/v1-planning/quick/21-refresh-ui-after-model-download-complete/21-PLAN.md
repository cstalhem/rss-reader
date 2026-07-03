---
phase: quick-21
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/hooks/useModelPull.ts
  - frontend/src/components/settings/ModelSelector.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "After a model download completes, the newly downloaded model appears in the ModelSelector dropdown"
    - "After a model download completes, the model appears in the Downloaded Models section of ModelManagement"
    - "After a curated model download completes, that model is removed from the Download Models section"
  artifacts:
    - path: "frontend/src/hooks/useModelPull.ts"
      provides: "Reliable post-download model list invalidation"
    - path: "frontend/src/components/settings/ModelSelector.tsx"
      provides: "Download status query with queryFn"
  key_links:
    - from: "frontend/src/hooks/useModelPull.ts"
      to: "queryKeys.ollama.models"
      via: "invalidateQueries on download complete"
      pattern: "invalidateQueries.*ollama\\.models"
---

<objective>
Refresh all Ollama-related UI components when a model download completes successfully.

Purpose: Currently, completing a model download does not visibly update the Model Selector dropdowns, the Downloaded Models list, or remove the entry from the recommended models section. The `invalidateQueries` call exists but may not be sufficient — we need to ensure the model list refetch happens reliably and that the ModelSelector also reflects the change.

Output: Updated `useModelPull.ts` with robust post-download invalidation, and fixed `ModelSelector.tsx` `useQuery` anti-pattern.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/hooks/useModelPull.ts
@frontend/src/hooks/useOllamaModels.ts
@frontend/src/components/settings/ModelSelector.tsx
@frontend/src/components/settings/ModelManagement.tsx
@frontend/src/components/settings/OllamaSection.tsx
@frontend/src/lib/queryKeys.ts
@.claude/skills/tanstack-query/SKILL.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ensure reliable model list refresh on download completion</name>
  <files>frontend/src/hooks/useModelPull.ts</files>
  <action>
The `useModelPull` hook already calls `queryClient.invalidateQueries({ queryKey: queryKeys.ollama.models })` on download completion in both the SSE success path (inside the setTimeout at ~line 240) and the poll-recovery path (~line 103). However, there are issues:

1. **SSE success path timing**: The invalidation fires inside a `setTimeout` with `SCORE_100_PERCENT_DELAY` (500ms). The cached download status is cleared to `active: false` in the same setTimeout, which might cause the models query to refetch before Ollama has fully registered the model. Add a slightly longer delay for the model invalidation (or refetch directly with a retry).

2. **Invalidation also needs `queryKeys.ollama.config`**: The config query drives the ModelSelector dropdown options (which model is selected). It does not need invalidation per se, but the model list does. The key point is `queryKeys.ollama.models` must be invalidated — verify it covers all three UI outcomes (selector, downloaded list, recommended list all derive from the same `models` prop).

3. **Both completion paths should be consistent**: Make sure both the SSE path and the poll-recovery path invalidate identically.

Changes to make:

a) In the SSE success path (inside the `setTimeout` at ~line 229): After clearing the download status cache, call `queryClient.invalidateQueries({ queryKey: queryKeys.ollama.models })` followed by `queryClient.refetchQueries({ queryKey: queryKeys.ollama.models })` to force an immediate refetch rather than relying on invalidation alone. The staleTime on `useOllamaModels` is 30s — invalidation refetches active observers regardless, but `refetchQueries` is more explicit.

b) In the poll-recovery path (~line 91-104): Same approach — use `refetchQueries` instead of just `invalidateQueries` to be explicit.

c) Actually, `invalidateQueries` already forces an immediate refetch on active observers, so the real issue is more likely that the Ollama server needs a moment to register the model after the pull stream ends. Change the approach: instead of calling invalidation inside the existing 500ms setTimeout, increase the delay to 800ms to give Ollama time to register the model. Alternatively, keep 500ms for UI cleanup (progress bar removal) but add a SECOND invalidation after 1500ms as a safety net. This is the simplest fix.

Concrete implementation:
- Keep the existing `setTimeout` at 500ms that clears download state and invalidates models.
- Add a second `setTimeout` at 1500ms that calls `queryClient.invalidateQueries({ queryKey: queryKeys.ollama.models })` again as a safety refetch. This ensures that even if Ollama was slow to register the model, the UI catches up.
- Use the same pattern in the poll-recovery useEffect path: after invalidation, schedule a follow-up invalidation at 1000ms.
  </action>
  <verify>
Read the updated file and confirm:
1. SSE success path has two invalidation calls (immediate at 500ms + safety at 1500ms)
2. Poll-recovery path also has follow-up invalidation
3. No other logic was changed
  </verify>
  <done>Both download completion paths (SSE and poll-recovery) trigger model list invalidation with a safety follow-up refetch to account for Ollama registration delay.</done>
</task>

<task type="auto">
  <name>Task 2: Fix ModelSelector missing queryFn anti-pattern</name>
  <files>frontend/src/components/settings/ModelSelector.tsx</files>
  <action>
The `ModelSelector` component uses `useQuery` for download status without a `queryFn`:

```tsx
const { data: downloadStatus } = useQuery<DownloadStatus>({
  queryKey: queryKeys.ollama.downloadStatus,
});
```

This violates the project rule: "Every `useQuery` must include `queryFn` — cache may be empty on first render regardless of other components writing to the same key." See `.claude/skills/tanstack-query/SKILL.md` anti-pattern: "`useQuery` Without `queryFn` on Shared Cache Keys."

Fix: Add the `queryFn` import and use it:

1. Add `import { fetchDownloadStatus } from "@/lib/api";` to the imports.
2. Update the `useQuery` call to include `queryFn: fetchDownloadStatus`.

This ensures the query is self-sufficient on cold cache and can refetch independently.
  </action>
  <verify>Run `cd /Users/cstalhem/projects/rss-reader/.claude/worktrees/jovial-lumiere/frontend && bun run build` — should compile without errors.</verify>
  <done>ModelSelector's download status query includes `queryFn`, eliminating the cold-cache runtime error risk.</done>
</task>

</tasks>

<verification>
1. `bun run build` in frontend/ passes without errors
2. Manual verification: start the app, go to Ollama settings, download a model, observe:
   - Model appears in "Downloaded Models" section after download completes
   - Model disappears from "Download Models" recommended list (if it was curated)
   - Model appears in the ModelSelector dropdown(s)
</verification>

<success_criteria>
- After a model download finishes, all three UI sections update within 2 seconds: ModelSelector dropdown includes the new model, Downloaded Models shows it, and (if curated) it is removed from Download Models
- ModelSelector no longer has a queryFn-less useQuery
- Build passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/21-refresh-ui-after-model-download-complete/21-SUMMARY.md`
</output>
