---
phase: quick-20
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/hooks/useModelPull.ts
  - frontend/src/lib/queryKeys.ts
  - frontend/src/components/settings/SettingsSidebar.tsx
  - frontend/src/components/settings/ModelManagement.tsx
  - frontend/src/components/settings/ModelSelector.tsx
  - frontend/src/components/settings/OllamaSection.tsx
  - frontend/src/components/settings/ModelPullProgress.tsx
autonomous: true
requirements: [QUICK-20]

must_haves:
  truths:
    - "Download progress bar visible on the Ollama settings page while downloading"
    - "Pulsing download icon + model name visible in settings sidebar during download"
    - "When navigating away from Ollama settings and back, progress bar resumes showing real progress"
    - "Model selector dropdowns show inline download indicator under the currently-downloading model name"
  artifacts:
    - path: "frontend/src/hooks/useModelPull.ts"
      provides: "Download hook that writes progress to TanStack Query cache for cross-component access"
    - path: "frontend/src/components/settings/SettingsSidebar.tsx"
      provides: "Sidebar with model name + progress under Ollama nav item"
    - path: "frontend/src/components/settings/ModelManagement.tsx"
      provides: "Model library with progress bars on downloading model rows"
  key_links:
    - from: "frontend/src/hooks/useModelPull.ts"
      to: "queryKeys.ollama.downloadStatus"
      via: "setQueryData writes SSE progress to cache"
      pattern: "queryClient\\.setQueryData"
    - from: "frontend/src/components/settings/SettingsSidebar.tsx"
      to: "queryKeys.ollama.downloadStatus"
      via: "useQuery reads cached download status"
      pattern: "useQuery.*downloadStatus"
---

<objective>
Persist Ollama model download progress across navigation and show it in multiple locations.

Purpose: Currently, download progress only shows on the Ollama settings page and is lost when navigating away. Users should see download status in the sidebar and model selector, and progress should survive navigation.

Output: Download progress visible in sidebar (with model name), model library rows, and model selector; progress persists across settings page navigation.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/hooks/useModelPull.ts
@frontend/src/lib/queryKeys.ts
@frontend/src/lib/types.ts
@frontend/src/components/settings/SettingsSidebar.tsx
@frontend/src/components/settings/OllamaSection.tsx
@frontend/src/components/settings/ModelManagement.tsx
@frontend/src/components/settings/ModelSelector.tsx
@frontend/src/components/settings/ModelPullProgress.tsx
@frontend/src/app/settings/layout.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Investigate and unify download state into TanStack Query cache</name>
  <files>
    frontend/src/hooks/useModelPull.ts
    frontend/src/lib/queryKeys.ts
    frontend/src/components/settings/SettingsSidebar.tsx
  </files>
  <action>
The root problem: `useModelPull` stores all download state in local `useState` (progress, isDownloading, pullingModel in ModelManagement). When OllamaSection unmounts on navigation, this state is lost. The sidebar has a separate polling query with a different key (`sidebarDownloadStatus`) that only provides a boolean active indicator.

Changes needed:

1. **queryKeys.ts**: Remove `sidebarDownloadStatus` key. There should be ONE download status key used everywhere.

2. **useModelPull.ts** — Restructure to write progress into the TanStack Query cache:
   - Keep the SSE streaming logic for the component that initiates the pull (fastest updates).
   - After each SSE progress update, call `queryClient.setQueryData(queryKeys.ollama.downloadStatus, ...)` to write a `DownloadStatus`-shaped object (with `active: true`, `model`, `completed`, `total`, `status` fields) into the cache. This makes progress available to ANY component reading that query key.
   - The existing polling query (refetchInterval on `downloadStatus`) already handles recovery when the SSE stream is not active (navigate-away case). Keep this. But unify it: the sidebar and useModelPull should use the SAME query key.
   - Remove `pullingModel` state from this hook. Instead, the `model` field from `DownloadStatus` (returned by backend `GET /api/ollama/downloads`) provides the model name. When starting a pull via SSE, include the model name in the `setQueryData` call.
   - Export a derived `modelName` from the hook (from the download status data).
   - On pull complete/cancel, set `active: false` in the cache via `setQueryData`, then invalidate to let the backend confirm.

3. **SettingsSidebar.tsx** — Switch from `sidebarDownloadStatus` query key to `queryKeys.ollama.downloadStatus`. Now it reads the same cache that `useModelPull` writes to, getting richer data including model name and progress percentage. Show the model name below the "Ollama" label when a download is active. Keep the pulsing download icon. Add a small percentage text next to or below the download icon (e.g., "qwen3:4b 45%").

Key constraint: The sidebar polls at 3s intervals via `refetchInterval`. When `useModelPull` is mounted (user is on Ollama page), it writes SSE data to the cache more frequently. When unmounted, the sidebar's own 3s polling takes over seamlessly via the backend endpoint. This is the persistence mechanism -- no React context or global store needed, just TanStack Query's cache.
  </action>
  <verify>
    Navigate to Ollama settings, start a model pull. Verify progress shows. Navigate to Feeds settings. Verify sidebar still shows pulsing icon with model name and percentage. Navigate back to Ollama. Verify progress bar resumes from the correct position (not restarting from 0).
  </verify>
  <done>Download progress persists across navigation via unified TanStack Query cache. Sidebar shows model name + percentage during active downloads.</done>
</task>

<task type="auto">
  <name>Task 2: Show download indicator in ModelManagement rows and ModelSelector</name>
  <files>
    frontend/src/components/settings/ModelManagement.tsx
    frontend/src/components/settings/ModelSelector.tsx
    frontend/src/components/settings/OllamaSection.tsx
    frontend/src/components/settings/ModelPullProgress.tsx
  </files>
  <action>
Now that download status lives in the TanStack Query cache with model name, update the Ollama page components:

1. **OllamaSection.tsx** — The `useModelPull` hook return shape may have changed (model name now derived from cache rather than local state). Update how `pullHook` is passed to `ModelManagement`. If `pullingModel` was tracked in ModelManagement, remove that local state and derive it from `pullHook` (which gets it from the cache).

2. **ModelManagement.tsx**:
   - Remove the `pullingModel` local state (`useState<string | null>(null)`). Instead, read the downloading model name from `pullHook` (which derives it from the download status cache).
   - The `isPulling` check on each row (`pullingModel === name`) becomes `pullHook.modelName === name && pullHook.isDownloading`.
   - Remove the `setPullingModel(null)` cleanup that fires when `!pullHook.isDownloading`. The cache-based approach handles this.
   - When `handlePull` is called, the model name is passed to `startPull` which writes it to the cache immediately.

3. **ModelSelector.tsx** — Add a compact download indicator below the model dropdown when the currently-selected model is being downloaded:
   - Accept an optional `downloadStatus` prop (or read from the download status query directly via `useQuery`).
   - When `downloadStatus?.active && downloadStatus?.model === config.categorization_model` (or scoring_model), show a compact progress bar below that dropdown. Use a slimmer version of ModelPullProgress or just a simple progress bar (height 4px) with percentage text.
   - Keep it subtle -- just a thin bar + "Downloading... 45%" text in `fg.muted` xs font.

4. **ModelPullProgress.tsx** — No changes expected unless a compact variant is needed for the ModelSelector. If so, add an optional `compact` prop that renders just the bar + percentage (no cancel button, no speed).

Ensure the `clearPullingModel` on download finish is handled by the cache going `active: false`, not by local state comparison.
  </action>
  <verify>
    Start a model download. Verify: (1) progress bar shows on the model row in Model Library, (2) if that model is selected in Model Configuration, a compact progress indicator appears under the dropdown, (3) navigating away and back preserves both indicators.
    Run `cd /Users/cstalhem/projects/rss-reader/frontend && bun run build` to confirm no TypeScript errors.
  </verify>
  <done>Download progress shows in Model Library rows, Model Selector dropdowns, and sidebar -- all reading from the same TanStack Query cache. Build passes.</done>
</task>

</tasks>

<verification>
- Start a model pull on the Ollama settings page
- Progress bar visible on the pulling model row in Model Library
- Pulsing icon + model name + percentage visible in sidebar
- Compact progress shown under model selector if downloading model is the active model
- Navigate to Feeds, then back to Ollama -- progress resumes at correct percentage
- Cancel a download -- all indicators clear immediately
- Download completes -- all indicators clear, model list refreshes
- `bun run build` passes with no errors
</verification>

<success_criteria>
- Download progress persists across settings page navigation (no reset to 0)
- Sidebar shows downloading model name and percentage (not just a generic icon)
- Model Library rows show progress bar on the downloading model
- Model Selector shows compact indicator when active model is being downloaded
- Single source of truth: all components read from queryKeys.ollama.downloadStatus
- No regressions: starting, cancelling, and completing downloads all work correctly
</success_criteria>

<output>
After completion, create `.planning/quick/20-persist-ollama-download-indicator-across/20-SUMMARY.md`
</output>
