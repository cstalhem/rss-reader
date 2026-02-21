---
paths: ["frontend/**"]
---

# Frontend Rules

## Chakra UI v3

- Select, Menu, Tooltip, Popover MUST use `Portal > Positioner > Content`. Dialog handles portalling internally — do NOT wrap in Portal.
- Always use `@/components/ui/tooltip` wrapper — never raw `Tooltip.Root`.
- Use `ConfirmDialog` from `@/components/ui/confirm-dialog` for all confirmation flows. Do not inline `Dialog.Root` for confirm/cancel.
- Set `color` on the nearest Chakra parent for react-icons — CSS inheritance flows to SVG `currentColor`. Do NOT use `var(--chakra-colors-*)` on icon props.
- Semantic tokens only — never hardcode color values or raw palette refs. Missing token → create in `theme/colors.ts`.
- `colorPalette="accent"` per-component on CTAs. Do NOT set as global default.
- `colorPalette` requires `solid`, `contrast`, and `focusRing` semantic tokens to resolve.
- Theme built with `createSystem(defaultConfig, {...})` in `frontend/src/theme/index.ts`.
- Emotion `keyframes` cannot be defined inline in `css` prop — use `keyframes` tagged template from `@emotion/react`.
- In lists: avoid `Tooltip.Root`, `Menu.Root`, `Checkbox.Root` per row — each creates 1-2 Zag state machines. Use native `title` for tooltips.
- `useBreakpointValue` registers 2 MQL listeners per call — hoist outside lists, pass result as prop.
- CSS `max-width: auto` cannot be transitioned — use a Chakra sizing token (e.g. `"8"`) or specific value.

## Next.js

- Dev and build scripts use `--webpack` flag — Turbopack breaks Emotion SSR. Do NOT remove.
- `suppressHydrationWarning` on `<html>` in `layout.tsx` is required. Do NOT remove.
- Never read `localStorage` in `useState` initializer — causes hydration mismatch. Use the `useLocalStorage` hook.
- Server Components cannot pass functions to Client Components. Only serializable data crosses the boundary.
- `NEXT_PUBLIC_*` env vars are baked at build time via string replacement. Runtime `environment` in docker-compose has no effect on client code.
- `"use client"` on interactive components only. `layout.tsx` and `page.tsx` are Server Components.

## Data Layer

- TanStack Query for all server state. No `useEffect` + `useState` fetch patterns.
- Mutation error handling centralized via `MutationCache.onError`. Per-mutation `onError` only for overrides. No silent failures.
- Return mutation objects directly from hooks. Do NOT wrap in thin functions that hide `isPending`/`mutateAsync`.
- Query keys centralized in `lib/queryKeys.ts`. No inline string literals.
- Use named interval constants per app state for polling. No bare numeric literals.
- No unnecessary `useEffect` — not for derived state, event responses, or prop-change resets.
- `useCallback` deps: use `mutation.mutate` not `mutation` — the object is a new reference each render, `.mutate` is stable.
- Custom hook helper functions with logic (not just delegation) must be `useCallback`-wrapped to maintain referential stability for consumers.
- Every `useQuery` must include `queryFn` — cache may be empty on first render regardless of other components writing to the same key.

## File Organization

- Types → `lib/types.ts`. Fetch functions → `lib/api.ts`. Pure utilities → `lib/utils.ts`.
- Cross-file constants → `lib/constants.ts`. Single-use constants → named `const` at top of file.
- Query keys → `lib/queryKeys.ts`. Custom hooks → `hooks/use*.ts`. Shared UI → `components/ui/`.

## Typography & Styling

- **Inter** for UI text, **Lora** for reader content (defined in `theme/typography.ts`).
- Dark mode default with orange accent (`oklch(64.6% 0.222 41.116)`).

## UI Patterns

- Load-more pagination, not infinite scroll.
- Unread-first default view, sorted by composite score descending.
- 12-second auto-mark-as-read in the reader drawer.
- Full opacity + accent dot for unread, 0.6 opacity + hollow dot for read.
