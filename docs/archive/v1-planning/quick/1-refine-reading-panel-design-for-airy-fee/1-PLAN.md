---
phase: quick/1-refine-reading-panel-design-for-airy-fee
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/article/ArticleReader.tsx
autonomous: true

must_haves:
  truths:
    - "Reading panel has generous horizontal padding preventing text from feeling cramped"
    - "Header elements have comfortable vertical spacing"
    - "Content begins with breathing room below the header border"
    - "Typography feels more open and readable"
  artifacts:
    - path: "frontend/src/components/article/ArticleReader.tsx"
      provides: "ArticleReader component with refined spacing"
      min_lines: 200
  key_links:
    - from: "Drawer.Body padding"
      to: "content readability"
      via: "horizontal space CSS"
      pattern: "px=|paddingX="
    - from: "Drawer.Header gap"
      to: "header airiness"
      via: "vertical spacing CSS"
      pattern: "gap=|py="
---

<objective>
Refine the ArticleReader drawer component spacing and layout to create a more airy, comfortable reading experience.

Purpose: Improve visual comfort and readability by increasing padding and spacing throughout the reading panel, preventing content from feeling cramped against edges.

Output: Updated ArticleReader.tsx with enhanced spacing that maintains existing structure and functionality.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary-minimal.md
</execution_context>

<context>
@./frontend/src/components/article/ArticleReader.tsx
@./frontend/src/theme/typography.ts

Current implementation uses Chakra UI v3 Drawer with default padding. The drawer is 75vw on desktop with `size="xl"`. Typography uses Lora serif font with `lineHeight: 1.75` for body text and `1.8` for paragraphs.
</context>

<tasks>

<task type="auto">
  <name>Increase spacing throughout reading panel</name>
  <files>frontend/src/components/article/ArticleReader.tsx</files>
  <action>
Update ArticleReader.tsx spacing for a more airy feel:

1. **Drawer.Body horizontal padding**: Add `px={{ base: 6, md: 12 }}` to Drawer.Body (currently uses default ~4). This creates substantial horizontal breathing room on desktop.

2. **Drawer.Body vertical padding**: Add `py={{ base: 6, md: 8 }}` to Drawer.Body for top/bottom spacing, preventing content from starting immediately after header border.

3. **Header vertical spacing**: In Drawer.Header Flex, increase `gap={3}` to `gap={4}` for more spacing between title, metadata, and actions.

4. **Header padding**: Add `py={6}` to Drawer.Header Flex to increase vertical padding within the header itself.

5. **Paragraph spacing**: In the content Box CSS, increase paragraph `mb` from `4` to `5` for more breathing room between paragraphs.

6. **Line height refinement**: Increase paragraph `lineHeight` from `"1.8"` to `"1.85"` for slightly more vertical openness in body text.

All changes are purely additive CSS props — no structural changes, no logic changes, no new imports needed.
  </action>
  <verify>
Run `cd frontend && npx tsc --noEmit` to verify TypeScript compilation.

Visual inspection: Open an article in the reader drawer and confirm:
- Substantial horizontal margins prevent text from feeling cramped
- Header elements have comfortable vertical spacing
- Content begins with clear separation from header border
- Paragraphs feel more open without being excessively spaced
  </verify>
  <done>
ArticleReader.tsx updated with enhanced spacing values. TypeScript compiles without errors. Reading panel feels noticeably more airy and comfortable with generous padding throughout.
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes: `cd frontend && npx tsc --noEmit`
2. Visual check: Reader drawer displays with generous padding and spacing
3. No functionality broken: navigation, close, and link interactions still work
</verification>

<success_criteria>
- Drawer.Body has explicit horizontal (`px`) and vertical (`py`) padding props
- Drawer.Header Flex has increased `gap` and `py` values
- Content CSS has increased paragraph `mb` and `lineHeight` values
- All spacing changes maintain responsive design with base/md breakpoints
- No structural changes to component logic or markup
</success_criteria>

<output>
After completion, create `.planning/quick/1-refine-reading-panel-design-for-airy-fee/1-SUMMARY.md`
</output>
