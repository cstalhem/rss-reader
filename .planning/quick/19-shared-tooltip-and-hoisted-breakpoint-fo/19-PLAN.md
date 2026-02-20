---
phase: quick-19
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/settings/WeightPresetStrip.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "WeightPresetStrip renders with no Tooltip wrappers around weight buttons"
    - "Hovering a weight button on desktop shows a native browser tooltip with the weight label"
    - "No useBreakpointValue call exists in WeightPresetStrip"
    - "TypeScript build passes with no errors in WeightPresetStrip"
  artifacts:
    - path: "frontend/src/components/settings/WeightPresetStrip.tsx"
      provides: "Simplified weight preset strip with native title tooltips"
  key_links:
    - from: "Button"
      to: "title prop"
      via: "title={option.label} attribute"
      pattern: "title=\\{option\\.label\\}"
---

<objective>
Remove 350 Zag state machines and 70 MediaQueryList listeners from the category tree by replacing Chakra Tooltip wrappers with native HTML title attributes in WeightPresetStrip, and removing the useBreakpointValue call that only existed to disable those tooltips on mobile.

Purpose: The WeightPresetStrip renders 5 Tooltip components per instance, each creating 2 Zag machines. With 35 categories, that is 350 machines and 70 MediaQueryList listeners for no meaningful UX benefit over a native title attribute.
Output: Simplified WeightPresetStrip.tsx with Tooltip and useBreakpointValue fully removed.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Tooltip and useBreakpointValue from WeightPresetStrip</name>
  <files>frontend/src/components/settings/WeightPresetStrip.tsx</files>
  <action>
Edit `frontend/src/components/settings/WeightPresetStrip.tsx` with these precise changes:

1. Remove `useBreakpointValue` from the `@chakra-ui/react` import line.

2. Remove the entire `import { Tooltip } from "@/components/ui/tooltip"` line.

3. Remove the `tooltipDisabled` variable declaration:
   ```
   const tooltipDisabled = useBreakpointValue({ base: true, md: false });
   ```

4. Replace the `<Tooltip>` wrapper around each `<Button>` with just the `<Button>` directly. The Tooltip currently wraps the Button like this:
   ```tsx
   <Tooltip content={option.label} openDelay={300} disabled={tooltipDisabled}>
     <Button ... >
       ...
     </Button>
   </Tooltip>
   ```
   Change to:
   ```tsx
   <Button ... title={option.label}>
     ...
   </Button>
   ```
   Add `title={option.label}` to the Button's existing props. The Button already has `aria-label={option.label}` so accessibility is preserved; `title` provides the native browser tooltip on hover.

No other changes. The rest of the file stays identical.
  </action>
  <verify>Run `cd /Users/cstalhem/projects/rss-reader/frontend && bunx tsc --noEmit 2>&1 | head -20` to confirm no TypeScript errors in the file.</verify>
  <done>
- `Tooltip` import is gone
- `useBreakpointValue` import is gone
- `tooltipDisabled` variable is gone
- Each of the 5 weight Buttons has `title={option.label}` prop
- `bunx tsc --noEmit` passes with no errors related to WeightPresetStrip
  </done>
</task>

</tasks>

<verification>
After the task completes:
1. `bunx tsc --noEmit` in `frontend/` reports no errors
2. Search confirms no `Tooltip` or `useBreakpointValue` references remain in WeightPresetStrip.tsx
3. Each Button in the WEIGHT_OPTIONS map has `title={option.label}`
</verification>

<success_criteria>
WeightPresetStrip renders 5 plain Buttons per instance with no Tooltip wrappers or breakpoint listeners. Native browser title tooltip works on desktop hover. TypeScript build clean.
</success_criteria>

<output>
After completion, create `.planning/quick/19-shared-tooltip-and-hoisted-breakpoint-fo/19-SUMMARY.md`
</output>
