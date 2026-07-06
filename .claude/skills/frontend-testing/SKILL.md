---
name: frontend-testing
description: "Frontend testing patterns — Vitest setup, test utilities, MSW mocking, hook testing with renderHook, component testing with providers, and common pitfalls"
---

# Frontend Testing

Rules: `.claude/rules/frontend.md` → Testing section

## Key Patterns

### Test Utilities (`src/test/utils.tsx`)

Three entry points depending on what you're testing:

- **`renderWithProviders(ui)`** — For component tests. Wraps in `QueryClientProvider` with a fresh `QueryClient` per render. (No theme provider — next-themes is stubbed per-file when needed.)
- **`createWrapper()`** — For hook tests via `renderHook(() => useMyHook(), { wrapper: createWrapper() })`. Same provider nesting.
- **`render(ui)`** (plain RTL) — Only for components that don't need providers (rare).

The test `QueryClient` uses `retry: false` and `gcTime: Infinity`. It does NOT use the production singleton from `lib/queryClient.ts` because that one has a `MutationCache.onError` handler coupled to sonner's `toast.error()`.

### MSW Handler Structure

```
src/test/mocks/
  server.ts               # setupServer(...handlers)
  handlers/
    index.ts              # aggregates all domain handlers
    feeds.ts              # feedHandlers — GET /api/feeds, /api/feed-folders
    articles.ts           # articleHandlers — GET /api/articles
```

- Handlers use **path-only** URLs (`http.get("/api/feeds", ...)`) — the app fetches relative URLs, so there is no `API_BASE_URL` to import (MSW 2 matches path-only patterns fine).
- Mock data is inline in handler files. Export it so tests can reference expected values.
- Per-test overrides: use `server.use(http.get(...))` inside the test — `afterEach` resets to defaults.

### Setup File (`src/test/setup.ts`)

Provides globally for every test:
- `@testing-library/jest-dom/vitest` matchers (`.toBeInTheDocument()`, etc.)
- MSW lifecycle (`server.listen({ onUnhandledRequest: "error" })`, `server.resetHandlers`, `server.close`) — unhandled requests fail loudly
- RTL `cleanup` in `afterEach`

Does NOT provide: `next/navigation` mock, `next-themes` mock, or browser-API polyfills — these are per-file. Components that reach `useIsMobile` (e.g. anything under `SidebarProvider`) need a per-file `matchMedia` stub.

### Testing Hooks

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils";

const { result } = renderHook(() => useMyHook(), { wrapper: createWrapper() });
await waitFor(() => expect(result.current.isSuccess).toBe(true));
expect(result.current.data).toEqual(expectedData);
```

### Testing Components

```tsx
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";

renderWithProviders(<MyComponent prop="value" />);
expect(screen.getByText("expected text")).toBeInTheDocument();
```

### Per-File Mocks (when needed)

```ts
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
```

## Anti-Patterns

- **Importing singleton QueryClient in tests** — Causes state leakage between tests and fires the coupled `MutationCache.onError` (sonner `toast.error`) on error paths. Always use `createTestQueryClient()`.
- **Mocking hooks instead of using MSW** — `vi.mock("@/hooks/useFeeds")` skips the actual fetch logic. Use MSW so the full path (hook → queryFn → fetch → response) is exercised.
- **Router/theme mocks in global setup** — Most tests don't need them. Adding globally creates coupling and hides which tests actually depend on routing.
- **Snapshot tests for styled components** — Tailwind/utility-driven class names change between runs. Snapshots become noise with no signal.
- **Asserting on query state without `waitFor`** — `useQuery` resolves asynchronously. Synchronous assertions see `isLoading: true` and miss the data.
- **Relying on jsdom for pointer APIs** — jsdom does not implement `setPointerCapture`/`hasPointerCapture`/`releasePointerCapture` or `scrollIntoView`. Pointer-driven libraries (sonner toasts, Radix, cmdk) call them on interaction and throw an *unhandled* error that fails the whole run — even when every test assertion passes (Vitest reports "1 error" with a non-zero exit). This bit the categories work: a test mounting `<Toaster>` to exercise the triage Undo action crashed on `setPointerCapture`. Polyfill them ONCE globally in `src/test/setup.ts` (`Element.prototype.setPointerCapture = () => {}`, etc.) — it's a jsdom gap, not a component bug, so it belongs in setup, not per-test.
- **Leaving `vi.spyOn` unrestored** — a `vi.spyOn(toast, "error")` left unrestored is re-wrapped by a *later* `vi.spyOn` on the same target in the same file; the second spy inherits the first's call history, so a test that expects zero prior calls sees stale ones. Restore with `afterEach(() => vi.restoreAllMocks())`, or `mockClear()` immediately after each `spyOn`. Discovered while adding the rename-409 "no toast" test — the earlier tests' unrestored `toast.error` spies polluted its count.

## Decision Aids

### Which render function?

| Scenario | Use |
|----------|-----|
| Component uses TanStack Query or shadcn providers | `renderWithProviders` |
| Hook uses `useQuery` or `useMutation` | `renderHook` + `createWrapper()` |
| Pure utility function (no React) | Direct function call, no render needed |
| Component with zero provider deps | Plain `render` from RTL (rare) |

### When to add a new MSW handler file?

Add a new file in `src/test/mocks/handlers/` when you write the first test for a new API domain (e.g. `preferences.ts` when testing `usePreferences`). Re-export from `handlers/index.ts`.

### When does a component test need `next/navigation` mock?

When the component (or any hook it calls) imports from `next/navigation` — typically components that use `useRouter`, `useSearchParams`, or `usePathname`. Add `vi.mock("next/navigation", ...)` at the top of that test file.
