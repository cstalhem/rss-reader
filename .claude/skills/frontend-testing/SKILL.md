---
name: frontend-testing
description: "Frontend testing patterns — Vitest setup, test utilities, MSW mocking, hook testing with renderHook, component testing with providers, and common pitfalls"
---

# Frontend Testing

Rules: `.claude/rules/frontend.md` → Testing section

## Key Patterns

### Test Utilities (`src/test/utils.tsx`)

Three entry points depending on what you're testing:

- **`renderWithProviders(ui)`** — For component tests. Wraps in `QueryClientProvider` + `ChakraProvider` with real theme. Creates fresh `QueryClient` per render.
- **`createWrapper()`** — For hook tests via `renderHook(() => useMyHook(), { wrapper: createWrapper() })`. Same provider nesting.
- **`render(ui)`** (plain RTL) — Only for components that don't need providers (rare).

The test `QueryClient` uses `retry: false` and `gcTime: Infinity`. It does NOT use the production singleton from `lib/queryClient.ts` because that one has a `MutationCache.onError` handler coupled to `toaster.create()`.

### MSW Handler Structure

```
src/test/mocks/
  server.ts               # setupServer(...handlers)
  handlers/
    index.ts              # aggregates all domain handlers
    feeds.ts              # feedHandlers — GET /api/feeds, /api/feed-folders
    articles.ts           # articleHandlers — GET /api/articles
```

- Handlers import `API_BASE_URL` from `@/lib/api` so URLs stay in sync with fetch functions.
- Mock data is inline in handler files. Export it so tests can reference expected values.
- Per-test overrides: use `server.use(http.get(...))` inside the test — `afterEach` resets to defaults.

### Setup File (`src/test/setup.ts`)

Provides globally for every test:
- `@testing-library/jest-dom/vitest` matchers (`.toBeInTheDocument()`, etc.)
- MSW lifecycle (`server.listen`, `server.resetHandlers`, `server.close`)
- RTL `cleanup` in `afterEach`
- jsdom polyfills: `ResizeObserver`, `matchMedia`

Does NOT provide: `next/navigation` mock, `next-themes` mock — these are per-file.

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

- **Importing singleton QueryClient in tests** — Causes state leakage between tests and crashes from `toaster.create()` calls. Always use `createTestQueryClient()`.
- **Mocking hooks instead of using MSW** — `vi.mock("@/hooks/useFeeds")` skips the actual fetch logic. Use MSW so the full path (hook → queryFn → fetch → response) is exercised.
- **Router/theme mocks in global setup** — Most tests don't need them. Adding globally creates coupling and hides which tests actually depend on routing.
- **Snapshot tests for Chakra components** — Chakra generates dynamic class names that change between runs. Snapshots become noise with no signal.
- **Asserting on query state without `waitFor`** — `useQuery` resolves asynchronously. Synchronous assertions see `isLoading: true` and miss the data.

## Decision Aids

### Which render function?

| Scenario | Use |
|----------|-----|
| Component uses Chakra UI or TanStack Query | `renderWithProviders` |
| Hook uses `useQuery` or `useMutation` | `renderHook` + `createWrapper()` |
| Pure utility function (no React) | Direct function call, no render needed |
| Component with zero provider deps | Plain `render` from RTL (rare) |

### When to add a new MSW handler file?

Add a new file in `src/test/mocks/handlers/` when you write the first test for a new API domain (e.g. `preferences.ts` when testing `usePreferences`). Re-export from `handlers/index.ts`.

### When does a component test need `next/navigation` mock?

When the component (or any hook it calls) imports from `next/navigation` — typically components that use `useRouter`, `useSearchParams`, or `usePathname`. Add `vi.mock("next/navigation", ...)` at the top of that test file.
