---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/layout/Sidebar.tsx
  - frontend/src/components/layout/MobileSidebar.tsx
  - frontend/src/components/article/ArticleReader.tsx
autonomous: true

must_haves:
  truths:
    - Add feed buttons use accent colorPalette for visual consistency
    - Article content links inherit global theme styling without redundant overrides
  artifacts:
    - path: frontend/src/components/layout/Sidebar.tsx
      provides: Desktop add-feed button with accent colorPalette
      contains: 'colorPalette="accent"'
    - path: frontend/src/components/layout/MobileSidebar.tsx
      provides: Mobile add-feed button with accent colorPalette
      contains: 'colorPalette="accent"'
    - path: frontend/src/components/article/ArticleReader.tsx
      provides: Article content with underlined links only
      contains: 'textDecoration: "underline"'
  key_links:
    - from: frontend/src/components/layout/Sidebar.tsx
      to: Chakra Button recipe
      via: colorPalette prop
      pattern: 'colorPalette="accent"'
    - from: frontend/src/components/article/ArticleReader.tsx
      to: Global link styling
      via: globalCss in theme
      pattern: "& a"
---

<objective>
Apply accent colorPalette to add-feed buttons and remove redundant link styling from ArticleReader.

Purpose: Complete the design system consistency work started in quick-4 by ensuring add-feed buttons use accent colors, and remove duplicate link color definitions that override the global theme.

Output: Three component files with corrected styling that properly leverages the design system.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

## Background

Quick task 4 completed the semantic token set for the accent colorPalette (solid, contrast, focusRing) and added global link styling via globalCss (accent.500 default, accent.400 on hover).

Three components need updates to fully leverage this system:

1. **Sidebar.tsx** (desktop): IconButton at line 153 needs `colorPalette="accent"`
2. **MobileSidebar.tsx**: Button at line 132 needs `colorPalette="accent"`
3. **ArticleReader.tsx**: Box at line 146 has redundant link color overrides that conflict with global theme

## Source Files

@frontend/src/components/layout/Sidebar.tsx
@frontend/src/components/layout/MobileSidebar.tsx
@frontend/src/components/article/ArticleReader.tsx
</context>

<tasks>

<task type="auto">
  <name>Add accent colorPalette to add-feed buttons</name>
  <files>
    frontend/src/components/layout/Sidebar.tsx
    frontend/src/components/layout/MobileSidebar.tsx
  </files>
  <action>
In Sidebar.tsx (line 153-160), add `colorPalette="accent"` to the IconButton:

```tsx
<IconButton
  aria-label="Add feed"
  onClick={onAddFeedClick}
  size="sm"
  variant="ghost"
  colorPalette="accent"
>
  <LuPlus />
</IconButton>
```

In MobileSidebar.tsx (line 132), add `colorPalette="accent"` to the Button:

```tsx
<Button variant="outline" width="100%" onClick={onAddFeedClick} colorPalette="accent">
  <LuPlus /> Add feed
</Button>
```

These changes ensure add-feed buttons use the accent color system consistently with other interactive elements.
  </action>
  <verify>
Grep for the updated buttons to confirm colorPalette is present:

```bash
grep -A2 "Add feed" frontend/src/components/layout/Sidebar.tsx
grep -A1 "Add feed" frontend/src/components/layout/MobileSidebar.tsx
```

Both should show `colorPalette="accent"` in the button props.
  </verify>
  <done>
Both add-feed buttons (desktop IconButton and mobile Button) have `colorPalette="accent"` prop added.
  </done>
</task>

<task type="auto">
  <name>Remove redundant link styling from ArticleReader</name>
  <files>
    frontend/src/components/article/ArticleReader.tsx
  </files>
  <action>
In ArticleReader.tsx (line 146), the Box css prop has a link styling block that redundantly overrides global theme link colors. The `colorPalette.solid` reference doesn't resolve properly because the parent Box doesn't set a colorPalette context.

Replace the entire `"& a"` block (lines 157-163) with just the underline declaration:

```tsx
"& a": {
  textDecoration: "underline",
},
```

This keeps underlined links in article content (appropriate for rendered HTML) while letting the global theme handle colors (accent.500 default, accent.400 on hover from globalCss).

Why: The color and hover styles are now redundant because quick-4 added comprehensive global link styling. The only ArticleReader-specific need is underlined links (not all links in the app are underlined, but article content links should be).
  </action>
  <verify>
Check the updated ArticleReader link styling:

```bash
grep -A3 '"& a"' frontend/src/components/article/ArticleReader.tsx
```

Should show only `textDecoration: "underline"` inside the `"& a"` block, with no color or _hover properties.
  </verify>
  <done>
ArticleReader link styling reduced to just `textDecoration: "underline"`, with colors handled by global theme.
  </done>
</task>

</tasks>

<verification>
1. Grep confirms all three files have expected changes
2. No TypeScript errors: `cd frontend && npx tsc --noEmit`
3. Visual verification: Load app, check add-feed buttons use accent color, check article links use global theme colors
</verification>

<success_criteria>
- Add-feed buttons (desktop + mobile) have `colorPalette="accent"` prop
- ArticleReader link styling contains only `textDecoration: "underline"`
- No TypeScript compilation errors
- Buttons and links visually consistent with design system
</success_criteria>

<output>
After completion, create `.planning/quick/5-add-accent-colorpalette-to-add-feed-butt/5-SUMMARY.md`
</output>
