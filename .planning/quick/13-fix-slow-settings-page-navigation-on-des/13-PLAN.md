---
phase: quick-13
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/app/settings/page.tsx
autonomous: true
requirements: [QUICK-13]

must_haves:
  truths:
    - "Clicking a sidebar link in settings shows the new section within ~100ms (no perceptible delay)"
    - "Only the active section's component tree is mounted at any time on desktop"
    - "Mobile view still renders all sections stacked (unchanged behavior)"
    - "Navigating away from a section and back loads cached data instantly via TanStack Query"
  artifacts:
    - path: "frontend/src/app/settings/page.tsx"
      provides: "Conditional rendering for desktop settings sections"
      contains: "activeSection ==="
  key_links:
    - from: "frontend/src/app/settings/page.tsx"
      to: "SettingsSidebar"
      via: "activeSection state drives which section component mounts"
      pattern: "activeSection === "
---

<objective>
Fix sluggish settings page navigation on desktop by switching from display-toggle to conditional rendering.

Purpose: The current implementation keeps all 5 settings sections mounted simultaneously using `display: none/block`, causing every sidebar click to re-render all sections (including CategoriesSection's tree building, FeedsSection's DnD setup, OllamaSection's multiple queries). Switching to conditional rendering ensures only the active section is mounted, eliminating unnecessary work.

Output: Settings page with instant section switching on desktop.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/app/settings/page.tsx
@frontend/src/components/settings/SettingsSidebar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnose with Rodney and confirm the performance issue</name>
  <files>None (diagnostic only)</files>
  <action>
Use `uvx rodney` to diagnose the settings page navigation performance:

1. Start rodney: `uvx rodney start --show`
2. Open the settings page: `uvx rodney open http://localhost:3210/settings`
3. Use `uvx rodney js` to measure the time between clicking a sidebar item and the section appearing. For example, measure a React render cycle by timing a click on the Categories link:
   ```
   uvx rodney js "(() => { const start = performance.now(); document.querySelector('[data-section=\"categories\"]')?.click?.() ?? document.querySelectorAll('[role=\"group\"] > div')[2]?.click(); return performance.now() - start; })()"
   ```
   Or use Performance API to measure the scripting time during a section switch.
4. Note the baseline measurement and which sections are heaviest.
5. Stop rodney: `uvx rodney stop`

This step confirms the issue exists and provides a baseline for the fix.
  </action>
  <verify>Rodney reports a measurable delay (scripting time) on section switch.</verify>
  <done>Baseline measurement captured showing the performance issue.</done>
</task>

<task type="auto">
  <name>Task 2: Switch desktop settings from display-toggle to conditional rendering</name>
  <files>frontend/src/app/settings/page.tsx</files>
  <action>
In `frontend/src/app/settings/page.tsx`, replace the desktop section rendering from display-toggle pattern to conditional rendering.

**Current pattern (slow):**
```tsx
<Box display={{ base: "none", md: "block" }}>
  <Box display={activeSection === "feeds" ? "block" : "none"}>
    <FeedsSection />
  </Box>
  <Box display={activeSection === "interests" ? "block" : "none"}>
    <InterestsSection />
  </Box>
  ...
</Box>
```

**Replace with conditional rendering:**
```tsx
<Box display={{ base: "none", md: "block" }}>
  {activeSection === "feeds" && <FeedsSection />}
  {activeSection === "interests" && <InterestsSection />}
  {activeSection === "categories" && <CategoriesSection />}
  {activeSection === "ollama" && <OllamaSection isVisible={true} />}
  {activeSection === "feedback" && <FeedbackPlaceholder />}
</Box>
```

**Why this is safe:**
- TanStack Query caches all server data; remounting a section gets cached data instantly (no loading flash)
- InterestsForm local text edits: losing unsaved edits on nav-away is standard form UX behavior. The form re-initializes from cached server data on remount.
- CategoriesSection: selection state (`selectedIds`) and `searchQuery` are ephemeral -- resetting on nav is fine. `expandedParents` is already persisted in localStorage.
- OllamaSection: `localEdits` overlay for unsaved config changes is ephemeral -- same argument as InterestsForm.
- FeedsSection: dialog states (`showAddDialog`, `feedToDelete`) are ephemeral.
- Mobile view is unchanged (still renders all sections stacked).

Remove the old comment "keep all mounted to preserve state" since it no longer applies.

Do NOT change the mobile section (the `<Box display={{ base: "block", md: "none" }}>` block). That should remain as-is with all sections stacked.
  </action>
  <verify>
1. `cd /Users/cstalhem/projects/rss-reader/frontend && bun run build` succeeds with no type errors.
2. Use `uvx rodney` to verify:
   - Open http://localhost:3210/settings
   - Click each sidebar link and confirm the section displays correctly
   - Confirm the switching feels instant (no perceptible delay)
   - Compare timing to Task 1 baseline
3. Stop rodney.
  </verify>
  <done>Desktop settings page switches sections instantly via conditional rendering. Each section mounts only when active. Mobile view unchanged. Build passes.</done>
</task>

</tasks>

<verification>
- `bun run build` passes in frontend directory
- Settings page loads and all 5 sections display correctly when selected
- Sidebar navigation feels instant (sub-100ms perceived delay)
- Mobile view still shows all sections stacked
- No data loss: switching away and back to a section shows the same server data (from TanStack Query cache)
</verification>

<success_criteria>
Settings page sidebar navigation on desktop switches sections with no perceptible delay. Only the active section's component tree is mounted. Mobile layout unchanged.
</success_criteria>

<output>
After completion, create `.planning/quick/13-fix-slow-settings-page-navigation-on-des/13-SUMMARY.md`
</output>
