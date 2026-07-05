---
paths: ["frontend/**"]
---

# Frontend Rules

## Next.js

- After creating a new worktree, run `cd frontend && bun install` — `node_modules` is not shared across worktrees.
- `suppressHydrationWarning` on `<html>` in `layout.tsx` is required (next-themes). Do NOT remove.
- Never read `localStorage` in `useState` initializer — causes hydration mismatch. Use the `useLocalStorage` hook.
- Server Components cannot pass functions to Client Components. Only serializable data crosses the boundary.
- API URLs are relative everywhere (same-origin). Dev uses a phase-gated `rewrites()` proxy (`/api` → `localhost:8912`) in `next.config.ts`; prod uses the reverse proxy. No `NEXT_PUBLIC_*` API URL.
- `"use client"` on interactive components only. `layout.tsx` and `page.tsx` are Server Components.
- Builds and the dev server require network access for `next/font` (Google Fonts) — sandboxed/air-gapped runs fail; run unsandboxed.

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
- All read/unread/scoring/blocked counts come from the backend (single SQL definition). Never derive counts client-side from article data.

## File Organization

- Types → `lib/types.ts`. Fetch functions → `lib/api.ts`. Pure utilities → `lib/utils.ts`.
- Cross-file constants → `lib/constants.ts`. Single-use constants → named `const` at top of file.
- Query keys → `lib/queryKeys.ts`. Custom hooks → `hooks/use*.ts`. Shared UI → `components/ui/`.

## Performance

- In lists: avoid per-row component instances that each own state machines, portals, or media-query listeners — hoist shared state/listeners out of the row and pass results as props. Use native `title` for row tooltips.

## Theming

- Theme is system-decided (next-themes `defaultTheme="system"`, `enableSystem`) — not dark-default. Tokens live in the `:root`/`.dark` blocks in `src/app/globals.css`; do not hardcode token values in components.
- Token → utility mapping uses `@theme inline` (not plain `@theme`) — plain `@theme` inlines values at parse time and breaks `var()` references.
- Re-theme via a shadcn preset: build one at ui.shadcn.com/create, then from `frontend/` run `bunx --bun shadcn@latest apply --preset <id> --only theme -y` (theme-only — fonts stay project-owned). This overwrites the token blocks.

## UI Patterns

- Load-more pagination, not infinite scroll.
- Unread-first default view, sorted by composite score descending.
- Mark-as-read: dwell-based auto-mark, 3s after the reader's content loads (#94 decision) — never auto-mark unread.
- Full opacity + accent dot for unread, 0.6 opacity + hollow dot for read.
- **Inter** for UI text (`--font-sans`), **Lora** for reader content and article headlines (#94 decision: list rows + reader titles are serif) (`--font-serif`), via `next/font` + `@theme inline` mapping.

## Testing

- Use `renderWithProviders` from `@/test/utils` for components, `createWrapper` for hooks.
- Fresh `QueryClient` per test — never import the singleton from `lib/queryClient.ts`.
- Use MSW handlers for API mocking — never mock `fetch` or hook internals directly.
- Use `waitFor` for all async assertions — never assert synchronously on query results.
- Add `next/navigation`, `next-themes`, and `matchMedia` (for `useIsMobile`) stubs per-file, not in global setup. MSW handlers are path-only (no API base URL exists).
- Co-locate tests as siblings (e.g. `Foo.test.tsx` next to `Foo.tsx`).
- No snapshot tests for styled components (dynamic class names make them noisy).
