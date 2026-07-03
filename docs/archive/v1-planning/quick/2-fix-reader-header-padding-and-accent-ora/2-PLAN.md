---
phase: quick/2-fix-reader-header-padding-and-accent-ora
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/article/ArticleReader.tsx
autonomous: true

must_haves:
  truths:
    - "Header content aligns horizontally with body content"
    - "Open original link has visible accent hover effect"
    - "In-content links have accent hover effect"
    - "Navigation arrows have accent hover effect"
  artifacts:
    - path: "frontend/src/components/article/ArticleReader.tsx"
      provides: "Article reader drawer with aligned padding and accent hover states"
      min_lines: 200
  key_links:
    - from: "Drawer.Header px prop"
      to: "Drawer.Body px prop"
      via: "matching responsive values"
      pattern: "px=\\{\\{ base: 6, md: 12 \\}\\}"
---

<objective>
Fix header-body padding misalignment and add accent orange hover states to interactive elements in the article reader.

Purpose: Visual polish — align header content with body content for clean layout, and provide clear interactive feedback on links and buttons using the theme's accent color.

Output: ArticleReader.tsx with consistent horizontal padding and accent hover effects.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary-minimal.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@frontend/src/theme/colors.ts
@frontend/src/components/article/ArticleReader.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Align header padding and add accent hover states</name>
  <files>frontend/src/components/article/ArticleReader.tsx</files>
  <action>
**1. Fix header padding alignment (lines 75-76):**

Current state:
- `Drawer.Header` has no horizontal padding (line 75)
- Inner `Flex` has `pr={8}` which was meant for the close button, not content alignment (line 76)
- `Drawer.Body` has `px={{ base: 6, md: 12 }}` (line 140)

Change:
- Add `px={{ base: 6, md: 12 }}` to `Drawer.Header` at line 75 to match body padding
- Update inner `Flex` at line 76: change `pr={8}` to `pr={16}` to accommodate the absolutely positioned navigation arrows (which are at `right={12}`) while maintaining the new header padding

**2. Add accent hover states:**

- **"Open original →" link (lines 102-111):** Add `_hover={{ color: "accent.emphasized" }}` to brighten on hover

- **In-content links (line 153):** Change the `& a` CSS rule from:
  ```
  "& a": {
    color: "colorPalette.solid",
    textDecoration: "underline",
  },
  ```
  to:
  ```
  "& a": {
    color: "colorPalette.solid",
    textDecoration: "underline",
    _hover: {
      color: "colorPalette.emphasized",
    },
  },
  ```

- **Navigation IconButtons (lines 116-133):** Add `colorPalette="accent"` and `_hover={{ bg: "accent.subtle" }}` to both prev/next buttons for subtle accent hover feedback

These changes use the theme's semantic tokens:
- `accent.emphasized` = accent.400 in dark mode (brighter orange)
- `accent.subtle` = accent.900 in dark mode (very dark orange background)
  </action>
  <verify>
Run dev server and test:
1. Open an article in the reader drawer
2. Verify header title aligns horizontally with body content (both should have same left edge)
3. Hover over "Open original →" link — should brighten to accent.emphasized
4. Hover over in-content links — should brighten from accent.500 to accent.400
5. Hover over prev/next navigation arrows — should show subtle accent.900 background
  </verify>
  <done>
- `Drawer.Header` has `px={{ base: 6, md: 12 }}` matching body padding
- Inner Flex has `pr={16}` to accommodate navigation arrows
- "Open original →" link has `_hover={{ color: "accent.emphasized" }}`
- In-content links have `_hover: { color: "colorPalette.emphasized" }` in CSS
- Navigation IconButtons have `colorPalette="accent"` and `_hover={{ bg: "accent.subtle" }}`
- Visual alignment confirmed: header content and body content have same left edge
- Hover states confirmed: all interactive elements show accent feedback
  </done>
</task>

</tasks>

<verification>
Run `cd frontend && npm run dev` and open http://localhost:3210:
1. Click any article to open reader drawer
2. Measure/observe: header title and body paragraph should align at the same left edge
3. Hover interactions: all links and navigation buttons show accent orange feedback
</verification>

<success_criteria>
- Header content horizontally aligned with body content
- All interactive elements (link, in-content links, nav buttons) have visible accent hover states
- No layout shift or visual regressions
</success_criteria>

<output>
After completion, create `.planning/quick/2-fix-reader-header-padding-and-accent-ora/2-01-SUMMARY.md`
</output>
