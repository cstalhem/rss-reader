---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/app/globals.css
  - frontend/src/app/layout.tsx
  - frontend/src/theme/index.ts
autonomous: false

must_haves:
  truths:
    - "Chakra UI layered recipes apply correctly without being overridden"
    - "All buttons default to orange accent color without explicit colorPalette prop"
    - "Button padding feels slightly more spacious"
    - "HTML/body overflow rules still apply"
  artifacts:
    - path: "frontend/src/app/globals.css"
      provides: "Deleted (no longer needed)"
      should_exist: false
    - path: "frontend/src/theme/index.ts"
      provides: "globalCss overflow rules, button recipe override"
      exports: ["system"]
      contains: "defineRecipe"
  key_links:
    - from: "frontend/src/app/layout.tsx"
      to: "frontend/src/theme/index.ts"
      via: "imports Provider (which uses system)"
      pattern: "import.*Provider"
---

<objective>
Fix design system spacing by removing rogue CSS reset that overrides Chakra UI v3 layered styles, and set sensible button defaults.

Purpose: Restore Chakra's built-in spacing defaults for dialogs/drawers/cards (currently broken by unlayered CSS reset), make buttons orange by default, and improve button padding.

Output:
- Deleted `globals.css` file
- Updated `layout.tsx` (removed globals.css import)
- Updated `theme/index.ts` (added globalCss overflow rules, button recipe override)
</objective>

<execution_context>
@/Users/cstalhem/projects/rss-reader/.claude/get-shit-done/workflows/execute-plan.md
@/Users/cstalhem/projects/rss-reader/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/cstalhem/projects/rss-reader/.planning/PROJECT.md
@/Users/cstalhem/projects/rss-reader/.planning/STATE.md
@/Users/cstalhem/projects/rss-reader/frontend/src/app/globals.css
@/Users/cstalhem/projects/rss-reader/frontend/src/app/layout.tsx
@/Users/cstalhem/projects/rss-reader/frontend/src/theme/index.ts

## Root Cause

The `* { padding: 0; margin: 0; box-sizing: border-box }` reset in `globals.css` is unlayered CSS, which always beats Chakra's `@layer` blocks per CSS spec. This overrides all Chakra recipe styles (dialogs, drawers, cards, etc.).

## Solution

1. Delete `globals.css` entirely (Chakra already handles CSS reset in its own `@layer reset`)
2. Move overflow rules into Chakra's `globalCss` config
3. Override button recipe to set default colorPalette and increase horizontal padding
</context>

<tasks>

<task type="auto">
  <name>Remove rogue CSS reset and migrate overflow rules to Chakra globalCss</name>
  <files>
    frontend/src/app/globals.css
    frontend/src/app/layout.tsx
    frontend/src/theme/index.ts
  </files>
  <action>
1. Delete `frontend/src/app/globals.css` entirely
2. In `frontend/src/app/layout.tsx`, remove the `import "./globals.css"` line (line 5)
3. In `frontend/src/theme/index.ts`, update the `globalCss` object to include overflow rules:

```typescript
globalCss: {
  "html, body": {
    colorScheme: "dark",
    maxWidth: "100vw",
    overflowX: "hidden",
  },
},
```

This restores Chakra's layered recipe styles while preserving the overflow behavior.
  </action>
  <verify>
1. `ls frontend/src/app/globals.css` returns "No such file"
2. `grep -n "globals.css" frontend/src/app/layout.tsx` returns nothing
3. `grep -n "overflowX" frontend/src/theme/index.ts` shows the new globalCss rule
4. `npm run dev` starts without errors
  </verify>
  <done>
- `globals.css` deleted
- `layout.tsx` no longer imports globals.css
- Overflow rules moved to Chakra's `globalCss`
- Dev server starts successfully
  </done>
</task>

<task type="auto">
  <name>Set button defaults: orange colorPalette and increased horizontal padding</name>
  <files>
    frontend/src/theme/index.ts
  </files>
  <action>
1. Import `defineRecipe` from `@chakra-ui/react` at the top of the file
2. Before the `createSystem` call, define a button recipe override:

```typescript
const buttonRecipe = defineRecipe({
  base: {},
  variants: {
    size: {
      sm: {
        px: "4",  // was 3.5 in Chakra default
      },
      md: {
        px: "5",  // was 4 in Chakra default
      },
    },
  },
  defaultVariants: {
    colorPalette: "accent",
  },
})
```

3. Add the button recipe to the theme config:

```typescript
export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: colorTokens,
      fonts: fontTokens,
    },
    semanticTokens: {
      colors: semanticTokens,
    },
    textStyles,
    recipes: {
      button: buttonRecipe,
    },
  },
  globalCss: {
    // ... existing globalCss
  },
})
```

This makes all buttons orange by default and gives them slightly more generous horizontal padding.
  </action>
  <verify>
1. `grep -n "defineRecipe" frontend/src/theme/index.ts` shows the import
2. `grep -n "buttonRecipe" frontend/src/theme/index.ts` shows the recipe definition and usage
3. `grep -n "recipes:" frontend/src/theme/index.ts` shows the recipes object in theme config
4. `npm run dev` starts without errors
5. Visit any page with buttons (feed list, article reader) - buttons should be orange without explicit colorPalette prop
  </verify>
  <done>
- Button recipe override defined with colorPalette: "accent" default
- Button sm/md sizes have increased horizontal padding (4/5 instead of 3.5/4)
- Recipe added to theme config under `recipes: { button: buttonRecipe }`
- All buttons render orange by default
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Verify design system spacing and button defaults</name>
  <what-built>
Removed the rogue CSS reset that was overriding Chakra UI's layered recipe styles, migrated overflow rules to Chakra's globalCss, and configured button defaults (orange accent color, increased padding).
  </what-built>
  <how-to-verify>
1. Start dev server: `cd frontend && npm run dev`
2. Visit http://localhost:3210
3. Check spacing/padding behavior:
   - Click "Add Feed" button in sidebar - dialog should have proper padding (not crushed to edges)
   - Click an article to open the reader drawer - drawer content should have proper padding
   - Observe feed list cards - should have proper padding/spacing
4. Check button defaults:
   - All buttons (Add Feed, Load More, Close, etc.) should be orange without needing explicit colorPalette prop
   - Buttons should have slightly more spacious horizontal padding than before
5. Check overflow behavior:
   - Resize browser horizontally - should not create horizontal scrollbar
   - Page should remain constrained to viewport width

Expected: All Chakra components (dialogs, drawers, cards) now respect their default recipe padding. Buttons are orange by default with comfortable padding. No horizontal overflow.
  </how-to-verify>
  <resume-signal>Type "approved" if spacing/button defaults look correct, or describe any issues</resume-signal>
</task>

</tasks>

<verification>
1. `frontend/src/app/globals.css` deleted
2. No import of globals.css in layout.tsx
3. globalCss in theme/index.ts includes overflow rules
4. Button recipe override exists with colorPalette: "accent" default and increased px values
5. Theme config includes `recipes: { button: buttonRecipe }`
6. Dev server runs without errors
7. UI components (dialogs, drawers, cards) have proper padding
8. All buttons are orange by default
9. No horizontal overflow on page
</verification>

<success_criteria>
- Chakra UI layered recipe styles apply correctly (dialogs/drawers/cards have proper padding)
- All buttons render orange without explicit colorPalette prop
- Button horizontal padding increased (sm: 4, md: 5)
- HTML/body overflow-x: hidden still applies
- Dev server starts and runs without errors
- No rogue CSS reset overriding layered styles
</success_criteria>

<output>
After completion, create `.planning/quick/3-improve-design-system-spacing-defaults-f/3-SUMMARY.md`
</output>
