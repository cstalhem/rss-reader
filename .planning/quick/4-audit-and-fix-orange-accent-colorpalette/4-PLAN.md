---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/theme/colors.ts
  - frontend/src/theme/index.ts
autonomous: true

must_haves:
  truths:
    - "colorPalette.solid resolves to accent.500 across all components"
    - "colorPalette.contrast resolves to white for text on solid backgrounds"
    - "All links in the app use accent color by default"
  artifacts:
    - path: "frontend/src/theme/colors.ts"
      provides: "Complete semantic token set with solid, contrast, focusRing"
      contains: "solid:"
    - path: "frontend/src/theme/index.ts"
      provides: "Global link styling with accent color"
      contains: "a {"
  key_links:
    - from: "colorPalette=\"accent\" props"
      to: "semanticTokens.accent.solid"
      via: "Chakra UI internal resolution"
      pattern: "solid:.*accent\\.500"
    - from: "all <a> tags"
      to: "accent.500 color"
      via: "globalCss styles"
      pattern: "a.*color"
---

<objective>
Fix Chakra UI v3 semantic tokens for proper colorPalette resolution and add global link styling.

Purpose: Components using `colorPalette="accent"` currently fail to resolve `colorPalette.solid` because the semantic token structure is incomplete. Chakra's built-in variants expect specific token names (`solid`, `contrast`, `focusRing`) that we haven't defined.

Output: Complete semantic token structure + global link styles for consistent accent color usage app-wide.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary-minimal.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@frontend/src/theme/colors.ts
@frontend/src/theme/index.ts

## Current Issue

The `semanticTokens.accent` structure has `DEFAULT` but is missing required token names:
- `solid` — used by Chakra's built-in variants when components have `colorPalette="accent"`
- `contrast` — text color on solid backgrounds (white text on orange)
- `focusRing` — focus ring color for interactive elements

Components throughout the app use `colorPalette="accent"` (ArticleReader, FeedRow, AddFeedDialog, etc.) and reference `colorPalette.solid` in styles, but this currently fails to resolve properly.

## Research Findings

From Chakra UI v3 documentation:
- `colorPalette` prop sets the active color palette for a component subtree
- Built-in variants (solid, outline, ghost) expect `{colorPalette}.solid`, `{colorPalette}.contrast`, etc.
- Semantic tokens must follow this naming convention for the resolution pipeline to work

Note: `DEFAULT` and `solid` serve different purposes:
- `DEFAULT` resolves when using `color="accent"` directly
- `solid` resolves when components use `colorPalette.solid` internally
- Both should exist and can point to the same base color (accent.500)
</context>

<tasks>

<task type="auto">
  <name>Add missing semantic tokens to accent color palette</name>
  <files>frontend/src/theme/colors.ts</files>
  <action>
Add three new semantic tokens to `semanticTokens.accent`:

1. `solid` — same value as DEFAULT (accent.500 in both light/dark)
   ```typescript
   solid: {
     value: { _light: "{colors.accent.500}", _dark: "{colors.accent.500}" },
   },
   ```

2. `contrast` — white text for readability on solid backgrounds
   ```typescript
   contrast: {
     value: { _light: "white", _dark: "white" },
   },
   ```

3. `focusRing` — focus ring color for interactive elements
   ```typescript
   focusRing: {
     value: { _light: "{colors.accent.500}", _dark: "{colors.accent.500}" },
   },
   ```

Keep all existing tokens unchanged (`DEFAULT`, `emphasized`, `fg`, `muted`, `subtle`). Insert the new tokens in a logical order (e.g., DEFAULT, solid, contrast, focusRing, then the rest).
  </action>
  <verify>
Run `npx tsc --noEmit` in frontend directory to verify no type errors. Inspect colors.ts to confirm all seven tokens present.
  </verify>
  <done>
semanticTokens.accent contains seven tokens: DEFAULT, solid, contrast, focusRing, emphasized, fg, muted, subtle. TypeScript compilation passes.
  </done>
</task>

<task type="auto">
  <name>Add global link styling to theme</name>
  <files>frontend/src/theme/index.ts</files>
  <action>
Add link styles to the `globalCss` object in the theme configuration:

```typescript
globalCss: {
  "html, body": {
    colorScheme: "dark",
    maxWidth: "100vw",
    overflowX: "hidden",
  },
  a: {
    color: "{colors.accent.500}",
    _hover: {
      color: "{colors.accent.400}",
    },
  },
},
```

This provides consistent link styling app-wide (currently ArticleReader has inline link styles; this makes it global). The token reference syntax `{colors.accent.500}` ensures theme consistency.
  </action>
  <verify>
Run `npx tsc --noEmit` in frontend to verify no type errors. Inspect index.ts to confirm `a:` selector exists in globalCss.
  </verify>
  <done>
globalCss contains `a:` selector with accent color and hover state. TypeScript compilation passes.
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation succeeds with no errors (`cd frontend && npx tsc --noEmit`)
2. All `colorPalette="accent"` components render with orange accent color
3. All links throughout the app use orange accent color with hover effect
4. No visual regressions in existing components

Manual visual check recommended:
- Start dev server: `cd frontend && npm run dev`
- Visit http://localhost:3210
- Verify buttons, links, and feed selection indicators all use orange accent
</verification>

<success_criteria>
- semanticTokens.accent contains all seven required tokens (DEFAULT, solid, contrast, focusRing, emphasized, fg, muted, subtle)
- colorPalette.solid properly resolves to accent.500 across all components
- Global link styling applied via globalCss
- TypeScript compilation passes with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/4-audit-and-fix-orange-accent-colorpalette/4-SUMMARY.md`
</output>
