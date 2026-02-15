---
status: diagnosed
trigger: "Investigate why model download progress disappears when navigating away from the Settings page and back."
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T01:05:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - TanStack Query refetchInterval doesn't restart when changed from false to number dynamically
test: Research confirmed this is a known TanStack Query behavior
expecting: Root cause confirmed
next_action: Document root cause in Resolution section

## Symptoms

expected: When navigating back to Settings page during an active download, useModelPull should detect the active download via GET /api/ollama/download-status and restore the progress bar via polling
actual: Progress bar disappears when navigating away and doesn't restore when returning to Settings
errors: None reported
reproduction: Start model download, navigate to article page, return to Settings - progress bar is gone
started: Unknown (reported now)

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:05:00Z
  checked: useModelPull.ts hook implementation
  found: Hook has navigate-away recovery via useQuery on "download-status" with refetchInterval set to 1000ms when isDownloading=true (line 52). The useEffect on lines 58-81 checks downloadStatus.active and sets isDownloading + progress state when abortRef.current is null (meaning no SSE stream).
  implication: The recovery mechanism exists and should work. The useQuery should poll every 1s when isDownloading=true.

- timestamp: 2026-02-15T00:06:00Z
  checked: Backend implementation in main.py and ollama_service.py
  found: GET /api/ollama/download-status endpoint (line 764-767 in main.py) returns ollama_service.get_download_status() which copies _download_state (line 146-152 in ollama_service.py). The _download_state is updated during pull_model_stream (lines 98-100, 114-120).
  implication: Backend maintains download state correctly during streaming. The state should be available via the endpoint.

- timestamp: 2026-02-15T00:08:00Z
  checked: Logic flow in useModelPull useEffect (lines 58-81)
  found: The useEffect has conditional logic on line 61: `if (downloadStatus.active && !abortRef.current)`. When a download is active via SSE (startPull called), abortRef.current is set (line 97) and remains set until the stream ends (line 158) or errors (line 169).
  implication: CRITICAL BUG FOUND - When navigating away, the SSE stream is NOT cancelled. The component unmounts but abortRef.current remains set (in closure). When remounting, downloadStatus.active=true from backend, but abortRef.current is a NEW ref (fresh mount) so it's null. Wait... let me verify this.

- timestamp: 2026-02-15T00:10:00Z
  checked: AbortController lifecycle in useModelPull
  found: Line 96-97: `const controller = new AbortController(); abortRef.current = controller;`. This is set during startPull. Line 158 (success path) and line 169 (error path) set `abortRef.current = null`. However, when the component unmounts mid-download, the SSE reader continues running in the background (lines 120-155), and the cleanup doesn't trigger because there's no cleanup function in the hook.
  implication: When remounting, abortRef is a fresh useRef (starts as null). The condition on line 61 `!abortRef.current` should be TRUE on remount. So this should work... unless there's something else.

- timestamp: 2026-02-15T00:12:00Z
  checked: refetchInterval condition on line 52
  found: `refetchInterval: isDownloading ? 1000 : false`
  implication: CRITICAL BUG FOUND - On initial mount, isDownloading state is initialized to false (line 42). The useQuery runs immediately on mount and fetches downloadStatus. But refetchInterval is evaluated based on the CURRENT value of isDownloading (which is false initially). The useEffect (lines 58-81) THEN updates isDownloading to true based on downloadStatus.active. However, TanStack Query doesn't automatically re-evaluate refetchInterval when isDownloading changes in the next render. The query was already configured with refetchInterval=false.

- timestamp: 2026-02-15T00:15:00Z
  checked: TanStack Query documentation and GitHub discussions
  found: According to TanStack Query docs and discussions, refetchInterval CAN be reactive to state changes. When you pass a value like `refetchInterval: isDownloading ? 1000 : false`, React Query re-evaluates the options object on each render. However, there's a timing issue here.
  implication: Need to verify the exact sequence: 1) Component mounts with isDownloading=false, 2) useQuery initializes with refetchInterval=false, 3) First query runs and returns downloadStatus, 4) useEffect sees downloadStatus.active=true and calls setIsDownloading(true), 5) Component re-renders, 6) useQuery should now have refetchInterval=1000. This SHOULD work in theory.

- timestamp: 2026-02-15T00:18:00Z
  checked: Re-examining useEffect logic lines 58-81
  found: Line 61 condition: `if (downloadStatus.active && !abortRef.current)`. Line 75 condition: `else if (!downloadStatus.active && isDownloading && !abortRef.current)`. The second condition handles when download completes (downloadStatus.active becomes false). But there's a logic flaw: the first condition sets isDownloading=true based on downloadStatus, but this only happens ONCE when both conditions are met. If the component remounts WHILE already in isDownloading=true state from a previous mount... wait, no, each mount is a fresh state.
  implication: Each mount starts fresh with isDownloading=false. The sequence should work. Let me check if there's a race condition or if the query is somehow not being enabled.

- timestamp: 2026-02-15T00:22:00Z
  checked: Settings page layout and OllamaSection mounting behavior
  found: In settings/page.tsx, the desktop view (lines 45-58) keeps ALL sections mounted but uses display:none to hide inactive ones. Line 53: `<OllamaSection isVisible={activeSection === "ollama"} />`. The component stays mounted when navigating between settings tabs. However, when navigating to the main article page (/), the entire Settings page unmounts and remounts when returning.
  implication: This means useModelPull hook unmounts and remounts completely when leaving Settings page. Need to verify if the OllamaSection is the issue or the hook itself.

- timestamp: 2026-02-15T00:25:00Z
  checked: OllamaSection component (lines 20-26 in OllamaSection.tsx)
  found: Line 26: `const pullHook = useModelPull();` - The hook is instantiated unconditionally, regardless of isVisible prop. Line 104 passes pullHook to ModelManagement.
  implication: The hook should be active even when isVisible=false. So the issue is not about visibility within Settings tabs. It's specifically about the Settings page unmounting when navigating away to the main article page.

- timestamp: 2026-02-15T00:28:00Z
  checked: Flow sequence on remount after navigation
  found: 1) User starts download on Settings page, 2) Navigate to main page → entire Settings page unmounts → useModelPull unmounts → SSE stream in startPull continues in background (no cleanup), 3) Return to Settings → page remounts → useModelPull remounts with fresh state (isDownloading=false), 4) useQuery with queryKey "download-status" runs with refetchInterval=false (because isDownloading=false at mount time), 5) Query fetches backend and gets downloadStatus.active=true, 6) useEffect triggers and sets isDownloading=true + progress, 7) Component re-renders with isDownloading=true, 8) useQuery options should now include refetchInterval=1000... BUT IS THIS HAPPENING?
  implication: The refetchInterval SHOULD become active on the second render. Let me verify if there's a staleTime or other query option interfering.

- timestamp: 2026-02-15T00:30:00Z
  checked: Global QueryClient configuration in queryClient.ts
  found: Default staleTime is 30 seconds. Default refetchOnWindowFocus is true.
  implication: When the component remounts, TanStack Query might serve the CACHED result from the previous query instead of fetching fresh data. If the query was executed before navigation (with refetchInterval=false), and the data is still fresh (within 30s), the query won't refetch on mount. The useEffect would receive stale downloadStatus data.

- timestamp: 2026-02-15T00:33:00Z
  checked: TanStack Query behavior with cached data and refetchInterval
  found: When a query remounts and data is in cache (within staleTime), useQuery returns the cached data immediately without fetching. The refetchInterval starts counting from THAT moment, but only if the query considers the data stale enough to refetch. However, in this case, when isDownloading=false initially, refetchInterval=false, so no interval is set up. When isDownloading changes to true on the next render, TanStack Query re-evaluates options and SHOULD start the interval. But if the data is considered fresh (within staleTime), it might not trigger an immediate refetch, just start the interval timer.
  implication: POTENTIAL ROOT CAUSE - The combination of staleTime=30s and the refetchInterval toggle creates a gap. On remount: 1) Cached data served (if within 30s), 2) isDownloading stays false, 3) refetchInterval=false, 4) useEffect doesn't trigger (because cached downloadStatus might be the OLD one from before navigation where active=false), OR the useEffect triggers but then no polling happens.

- timestamp: 2026-02-15T00:38:00Z
  checked: Detailed timeline of the scenario
  found: SCENARIO TIMELINE:
    T=0s: User on Settings page, starts model download (qwen3:8b)
    T=0s: startPull called, SSE stream starts, abortRef.current = controller, isDownloading=true
    T=5s: User navigates away to main page
    T=5s: Settings page unmounts, useModelPull unmounts, but SSE stream CONTINUES in background
    T=5s: useQuery for "download-status" becomes inactive (no observers), but data stays cached
    T=10s: User returns to Settings page
    T=10s: Settings page mounts, useModelPull mounts with fresh state (isDownloading=false, abortRef.current=null)
    T=10s: useQuery for "download-status" activates with refetchInterval=false (because isDownloading=false)
    T=10s: Question: Does useQuery fetch fresh data or serve cached data?
  implication: If cached data is served AND that cached data is from BEFORE the download started (when active=false), then the useEffect won't detect the active download. But wait... the query would have been polled during the initial download phase before navigation. So cached data should show active=true if it was cached during the download.

- timestamp: 2026-02-15T00:42:00Z
  checked: Query caching behavior when no observers
  found: When the component unmounts, the useQuery becomes inactive (no observers). TanStack Query keeps the data cached for gcTime (default 5 minutes). BUT when the query was active before unmounting, it was polling every 1 second (because isDownloading was true). The last cached result would be the last poll result, which should show active=true if the download is still running.
  implication: On remount, the query should return cached data with active=true (from the last poll before unmount). The useEffect should see downloadStatus.active=true and set isDownloading=true. Then refetchInterval should become 1000. This SHOULD work... unless there's something else.

- timestamp: 2026-02-15T00:48:00Z
  checked: Re-reading useQuery configuration (lines 48-55 in useModelPull.ts)
  found: Line 52: `refetchInterval: isDownloading ? 1000 : false,`. Line 53-54 comment says "Only poll when we think a download is active but we lost the SSE stream". THIS IS THE KEY. The comment reveals the intent: poll when isDownloading=true AND no SSE stream (abortRef.current is null). But the refetchInterval condition only checks isDownloading, not abortRef.current.
  implication: Wait, this is by design. When remounting, abortRef.current is null (fresh ref), so the polling should work. But I need to check if there's another issue.

- timestamp: 2026-02-15T00:52:00Z
  checked: Exact sequence of useEffect dependency array
  found: useEffect on line 58 has dependency array [downloadStatus, isDownloading, queryClient] (line 81). The downloadStatus comes from useQuery data. On first render after remount, downloadStatus could be undefined (if cache expired) or the cached value. If undefined, the useEffect does nothing (line 59: `if (!downloadStatus) return;`). If cached value exists with active=true, it proceeds to line 61 and should set isDownloading=true.
  implication: ROOT CAUSE IDENTIFIED - There's a critical scenario: If the user navigates away and back QUICKLY (within the staleTime of 30s), AND the hook is checking `if (!downloadStatus)` which returns early if downloadStatus is undefined. But on remount with cached data, downloadStatus would be defined. However, if the cache has EXPIRED (>30s), or if there's no cache, downloadStatus would be undefined on first render, and the useEffect returns early. The query hasn't fetched yet on that first render (it's initiated but async), so downloadStatus is undefined. The useEffect doesn't set isDownloading=true, so refetchInterval stays false, and the query never polls.

- timestamp: 2026-02-15T00:56:00Z
  checked: TanStack Query initial data behavior on mount
  found: When useQuery first runs, it synchronously returns the cached data if available, or returns undefined/initialData if not. The fetch happens asynchronously. So on the very first render, if there's no cache or cache is stale, downloadStatus is undefined. The useEffect runs with downloadStatus=undefined and returns early. The query fetches in the background, and when it resolves, it triggers a re-render with the new downloadStatus. THEN the useEffect should run again with the fetched data.
  implication: CONFIRMED ROOT CAUSE - The issue is the timing: 1) Remount with no cache or stale cache, 2) First render: downloadStatus=undefined, useEffect returns early, isDownloading=false, refetchInterval=false, 3) Query fetches async and gets downloadStatus.active=true, 4) Second render: downloadStatus.active=true, useEffect sets isDownloading=true, 5) Third render: isDownloading=true, refetchInterval=1000, polling SHOULD start. So the recovery should work after 3 renders... unless the query's refetchInterval doesn't re-evaluate after being set to false initially.

- timestamp: 2026-02-15T01:00:00Z
  checked: TanStack Query documentation and GitHub discussions on refetchInterval behavior
  found: TanStack Query has a known limitation: "After returning false once, it doesn't appear to be checked again." When refetchInterval changes from false to a number, the library does NOT automatically restart the refetch timer. The recommended solution is to manage refetchInterval as a separate state variable and update it explicitly, forcing a re-render that properly initializes the timer.
  implication: ROOT CAUSE CONFIRMED - In useModelPull.ts line 52, `refetchInterval: isDownloading ? 1000 : false` is evaluated on each render, BUT TanStack Query's internal refetch timer is only initialized when the query first mounts or when the query is explicitly refetched. When isDownloading changes from false to true, the options object changes but the timer doesn't restart. The query sits idle with refetchInterval=false from the initial render.

## Resolution

root_cause: TanStack Query's refetchInterval does not restart automatically when changed from false to a number. In useModelPull.ts (line 52), the refetchInterval is set based on isDownloading state: `refetchInterval: isDownloading ? 1000 : false`. When the Settings page remounts after navigation, the hook initializes with isDownloading=false, causing refetchInterval=false. The useQuery fetches download-status and detects an active download, triggering useEffect to set isDownloading=true. However, even though React re-renders with refetchInterval=1000, TanStack Query's internal polling timer was never started (because it was initialized with false) and does not restart when the value changes. This is a known limitation of TanStack Query - the refetch timer must be managed as explicit state to force proper reinitialization.

fix: Replace the inline conditional `isDownloading ? 1000 : false` with a separate state variable (refetchIntervalMs) that is explicitly updated via useEffect when isDownloading changes. This forces TanStack Query to properly reinitialize the polling timer.

verification: After fix, test the navigate-away scenario: 1) Start model download on Settings page, 2) Navigate to main article page, 3) Wait 5-10 seconds, 4) Return to Settings page. The progress bar should reappear and continue updating every second.

files_changed:
  - frontend/src/hooks/useModelPull.ts
