---
phase: quick-16
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/settings/CategoriesSection.tsx
  - frontend/src/components/settings/CategoryTree.tsx
  - frontend/src/components/settings/CategoryChildRow.tsx
  - frontend/src/components/settings/CategoryUngroupedRow.tsx
  - frontend/src/components/settings/CategoryParentRow.tsx
  - frontend/src/components/settings/WeightPresetStrip.tsx
  - frontend/src/components/settings/CategoryContextMenu.tsx
autonomous: true
requirements: [QUICK-16]

must_haves:
  truths:
    - "Switching to categories section on desktop feels instant (under 200ms perceived)"
    - "Category tree renders without blocking the settings page shell"
    - "All category tree interactions (weight change, checkbox, context menu) remain functional"
  artifacts:
    - path: "frontend/src/components/settings/CategoriesSection.tsx"
      provides: "Optimized category tree with reduced render cost"
  key_links:
    - from: "CategoriesSection"
      to: "CategoryTree"
      via: "props pass-through"
      pattern: "<CategoryTree"
---

<objective>
Investigate WHY the category tree component takes ~870ms to render when data is small (cached by TanStack Query), then implement concrete optimizations to reduce that time significantly.

Purpose: The category tree renders slowly despite small data. Quick-12 fixed callback stability, quick-13 switched to conditional rendering, quick-15 added skeleton deferral -- but these all mask the underlying problem. The tree itself is too expensive to render. This task finds and fixes the root cause.

Output: Faster category tree render, documented findings, optimized components.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/15-move-skeleton-inside-categories-page-lay/15-SUMMARY.md
@.planning/quick/12-fix-slow-checkbox-response-in-settings-c/12-SUMMARY.md
@frontend/src/components/settings/CategoriesSection.tsx
@frontend/src/components/settings/CategoryTree.tsx
@frontend/src/components/settings/CategoryParentRow.tsx
@frontend/src/components/settings/CategoryChildRow.tsx
@frontend/src/components/settings/CategoryUngroupedRow.tsx
@frontend/src/components/settings/WeightPresetStrip.tsx
@frontend/src/components/settings/CategoryContextMenu.tsx
@frontend/src/components/settings/CategoriesTreeSkeleton.tsx
@frontend/src/hooks/useCategories.ts
@frontend/src/app/settings/page.tsx
@.claude/skills/react-hooks/SKILL.md
@.claude/skills/tanstack-query/SKILL.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Profile and diagnose the category tree render bottleneck</name>
  <files>None created/modified -- investigation only</files>
  <action>
Use rodney to measure and diagnose the actual render performance:

1. Run `uvx rodney --help` to confirm available commands. Start rodney with `uvx rodney start --show`.
2. Start the dev servers if not running: backend on port 8912, frontend on port 3210.
3. Navigate to `http://localhost:3210/settings` and switch to the categories tab.
4. Use `uvx rodney js` to measure:
   - Total DOM node count on the categories page: `document.querySelectorAll('*').length`
   - DOM nodes inside the category tree specifically: `document.querySelector('[class*="category-tree"]')` or identify the tree container and count its descendants
   - How many WeightPresetStrip instances render (each has 5 mobile buttons + 5 desktop icon buttons + 5 tooltips = ~15 elements per strip, and there are TWO strips per row -- mobile and desktop): count total button elements and tooltip portals
   - Time the render with Performance API: inject `performance.mark('tree-start')` before and `performance.mark('tree-end')` after to measure
5. Use `uvx rodney js "document.querySelectorAll('button').length"` to count total buttons on the page (WeightPresetStrip renders 10 buttons per row: 5 mobile + 5 desktop)
6. Use `uvx rodney js "document.querySelectorAll('[data-scope=\"menu\"]').length"` to count CategoryContextMenu instances

Key hypothesis to investigate:
- **Each row renders 2x WeightPresetStrip (mobile + desktop via display:none/block)**: With ~70 categories, that is 140 WeightPresetStrip instances, each with 5 Tooltip components = 700 Tooltip components. Each Tooltip likely mounts a Portal with Positioner + Content in the DOM even when hidden.
- **Each row renders a CategoryContextMenu with Menu.Root > Portal > Positioner > Content**: ~70 Menu instances with portals.
- **The Collapsible.Root/Content for each parent** may still be mounting children even when collapsed.

Document findings: note the DOM count, the number of portaled components, and which component type contributes most to render cost.

After profiling, clean up rodney: `uvx rodney stop`.
  </action>
  <verify>
Findings documented with concrete numbers: total DOM nodes, buttons count, portal count, estimated component instances. Clear identification of the top 1-2 bottlenecks.
  </verify>
  <done>Root cause(s) of ~870ms render identified with evidence (DOM counts, component counts). Clear optimization targets established.</done>
</task>

<task type="auto">
  <name>Task 2: Implement optimizations to reduce category tree render time</name>
  <files>
    frontend/src/components/settings/CategoriesSection.tsx
    frontend/src/components/settings/CategoryTree.tsx
    frontend/src/components/settings/CategoryChildRow.tsx
    frontend/src/components/settings/CategoryUngroupedRow.tsx
    frontend/src/components/settings/CategoryParentRow.tsx
    frontend/src/components/settings/WeightPresetStrip.tsx
    frontend/src/components/settings/CategoryContextMenu.tsx
  </files>
  <action>
Based on the profiling results, apply targeted optimizations. The likely optimizations (adjust based on Task 1 findings):

**Optimization 1: Eliminate dual WeightPresetStrip render**
Each row currently renders TWO WeightPresetStrip components -- one for mobile (display base:block, sm:none) and one for desktop (display base:none, sm:block). This doubles the button/tooltip count. Fix: render a single WeightPresetStrip that uses responsive Chakra props internally for mobile vs desktop layout, OR use a single render with responsive styles. The key insight is that both strips receive the same `value` and `onChange` -- there is no need for two component instances.

In `WeightPresetStrip.tsx`, merge the mobile/desktop rendering into a single component instance that uses responsive Chakra props:
- Each weight option renders ONE element that adapts via responsive props (Button with responsive display for mobile label vs icon-only desktop)
- Remove the dual-render pattern from CategoryParentRow, CategoryChildRow, and CategoryUngroupedRow

**Optimization 2: Lazy CategoryContextMenu**
Each row mounts a Menu.Root with Portal > Positioner > Content even though the menu is closed. If Chakra Menu supports `lazyMount` and `unmountOnExit` props, use them. Check Chakra UI v3 docs for Menu lazy mounting. If not available, consider rendering the Menu only on first interaction (e.g., render just the trigger IconButton, mount Menu.Root on first click via state).

**Optimization 3: Collapse truly hides children**
Verify that Collapsible.Content with `open={false}` does NOT render children to the DOM. If it does (display:none but still mounted), switch to conditional rendering: `{isExpanded && <children>}` instead of Collapsible animation. The animation on expand/collapse is nice-to-have but not worth 70+ hidden child rows being mounted.

**What NOT to do:**
- Do not add virtualization (react-window/react-virtualized) -- that is heavy machinery for a list of ~70 items and would complicate DnD integration
- Do not remove React.memo from row components -- those are correct and valuable
- Do not change the useCategories hook or data fetching layer -- the bottleneck is render, not data
- Do not break any existing functionality (weight changes, checkboxes, context menus, rename, drag-and-drop if present, expand/collapse, search filter)

After changes, verify the build passes: `cd frontend && bun run build`
  </action>
  <verify>
1. `cd frontend && bun run build` succeeds with no errors
2. Use rodney to re-measure DOM node count after optimization -- should be significantly lower
3. Use rodney to verify categories page still works: tree renders, weight buttons work, context menu opens, expand/collapse works
4. Compare before/after DOM counts and note the reduction
  </verify>
  <done>
Category tree DOM node count reduced significantly (target: 50%+ reduction). Build passes. All category tree interactions still work (weight change, context menu, expand/collapse, checkbox selection, search filter).
  </done>
</task>

</tasks>

<verification>
1. `cd frontend && bun run build` passes
2. DOM node count on categories page reduced by 40%+ compared to baseline measured in Task 1
3. All category interactions functional: weight presets, context menus, expand/collapse, checkbox selection, search filtering, hidden categories section
4. No TypeScript errors: `cd frontend && npx tsc --noEmit` passes
</verification>

<success_criteria>
- Root cause of slow category tree render is identified with evidence
- Optimizations implemented that reduce DOM complexity significantly
- No regressions in functionality
- Build and type check pass
</success_criteria>

<output>
After completion, create `.planning/quick/16-research-and-optimize-category-tree-comp/16-SUMMARY.md`
</output>
