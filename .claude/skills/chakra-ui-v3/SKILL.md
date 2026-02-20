---
name: chakra-ui-v3
description: Chakra UI v3 patterns for this project — semantic tokens, portal rules, icon color inheritance, ConfirmDialog, colorPalette usage, and anti-patterns with code examples
---

# Chakra UI v3

Deep reference for the Chakra UI v3 patterns used in this project. For concise rules, see `.claude/rules/frontend.md`.

## Key Patterns

### Semantic Tokens

All colors in components come from semantic tokens defined in `theme/colors.ts`. Never use raw palette refs (`green.600`) or hardcoded values (`oklch(...)`) in component files.

**Current semantic tokens (beyond Chakra defaults):**

| Token           | Purpose                                 | Example usage                                 |
| --------------- | --------------------------------------- | --------------------------------------------- |
| `bg.code`       | Code block backgrounds in ArticleReader | `bg="bg.code"`                                |
| `fg.success`    | Success indicators (green)              | AddFeedDialog success icon                    |
| `fg.warning`    | Warning indicators (orange)             | ModelSelector warning icon                    |
| `fg.error`      | Error indicators (red)                  | ModelManagement error text, OllamaHealthBadge |
| `bg.subtle`     | Subtle card/section backgrounds         | Settings section cards                        |
| `fg.muted`      | De-emphasized text                      | Timestamps, metadata                          |
| `border.subtle` | Subtle borders                          | Card outlines                                 |

**Why semantic tokens?** Dark/light mode. `fg.success` resolves to `green.400` in dark mode and `green.600` in light mode. Hardcoded `green.600` looks washed out in dark mode.

**Adding a new token:** Add it to `theme/colors.ts` under `semanticTokens.colors` with both `_dark` and `_light` values. Then use it in components as a string: `color="fg.success"`.

### Portal Rules by Component

```
Component     | Needs Portal + Positioner? | Why
─────────────────────────────────────────────────────
Dialog        | NO                         | Handles portalling internally
Select        | YES                        | Dropdown needs to escape overflow
Menu          | YES                        | Context menu needs to escape overflow
Tooltip       | YES (use wrapper)          | Needs positioning above content
Popover       | YES                        | Needs positioning near trigger
```

**Dialog is the exception.** Wrapping Dialog in `<Portal>` causes it to render twice or break focus trapping. All other overlay components need `Portal > Positioner > Content`.

### Tooltip Wrapper (`@/components/ui/tooltip`)

Always use the Tooltip wrapper from `@/components/ui/tooltip`, never raw `Tooltip.Root > Tooltip.Trigger > Tooltip.Positioner > Tooltip.Content`. The wrapper handles Portal/Positioner internally and provides a consistent API:

```tsx
import { Tooltip } from "@/components/ui/tooltip";

<Tooltip content='Delete feed' openDelay={300}>
  <IconButton aria-label='Delete' />
</Tooltip>;
```

### react-icons Color via CSS Inheritance

react-icons render as `<svg>` with `fill="currentColor"`. Set `color` on the nearest **Chakra parent element** — CSS inheritance flows to the SVG:

```tsx
// GOOD — color on Chakra parent, icon inherits
<Box color="fg.muted">
  <LuSettings size={20} />
</Box>

// BAD — var() string on icon prop doesn't work reliably
<LuSettings color="var(--chakra-colors-gray-400)" size={20} />
```

**Why `var(--chakra-colors-*)` breaks:** The CSS custom property string is passed as a prop, not as a CSS value. Some icon implementations treat it as an inline attribute rather than a CSS property, and it bypasses Chakra's token resolution (no dark/light mode support).

### ConfirmDialog (`@/components/ui/confirm-dialog`)

Reusable confirmation dialog for destructive or significant actions:

```tsx
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

<ConfirmDialog
  open={isOpen}
  onOpenChange={(d) => setIsOpen(d.open)}
  title='Delete category?'
  body='This will remove the category and all its scoring history.'
  confirmLabel='Delete'
  confirmColorPalette='red' // "red" for destructive, "accent" for non-destructive
  onConfirm={handleDelete}
/>;
```

Use `confirmColorPalette="accent"` for non-destructive confirmations (like ungrouping).

### `colorPalette="accent"` on CTAs

Set `colorPalette="accent"` **per-component** on call-to-action elements (save buttons, active states). Do NOT set it as a global default — most UI elements should use the default gray palette.

```tsx
<Button colorPalette='accent' onClick={handleSave}>
  Save Preferences
</Button>
```

## Anti-Patterns

### Hardcoded Colors in Components

```tsx
// BAD
<Text color="green.600">Success</Text>
<Box bg="oklch(13% 0.008 55)">Code block</Box>

// GOOD
<Text color="fg.success">Success</Text>
<Box bg="bg.code">Code block</Box>
```

### Raw HTML Elements Where Chakra Has Equivalents

```tsx
// BAD — raw <input> loses theme integration
<input style={{ background: "transparent", color: "inherit" }} />

// GOOD — Chakra Input with semantic tokens
<Input variant="flushed" size="sm" bg="transparent" />
```

### Redundant Portal on Dialog

```tsx
// BAD — Dialog handles its own portal
<Portal>
  <Dialog.Root>...</Dialog.Root>
</Portal>

// GOOD — no Portal needed
<Dialog.Root>...</Dialog.Root>
```

## Decision Aids

### When to Create a New Semantic Token

Create a token when:

1. A color is used in **2+ files** (cross-file constant for colors)
2. The color has **dark/light mode variants** that differ
3. The color represents a **semantic concept** (success, error, code background)

Don't create a token for:

- One-off decorative colors used in a single component
- Colors that are already covered by Chakra's built-in tokens (`bg.subtle`, `fg.muted`, etc.)

### Small Status Indicators

For small status dots (like OllamaHealthBadge), it's fine to use `fg.success`/`fg.error` as background colors rather than creating dedicated `status.success`/`status.error` tokens. The distinction matters more for large surfaces.
