---
name: frontend-reference
description: Frontend architecture reference — provider wiring, app shell layout, theme system setup, reader drawer flow, and data layer configuration
---

# Frontend Reference

Architecture and wiring reference for the frontend. For concise rules, see `.claude/rules/frontend.md`.

## Provider Stack

Providers are layered in `app/layout.tsx` → `app/providers.tsx`:

- **`QueryProvider`** (`app/providers.tsx`) — TanStack Query with 30s `staleTime`, `QueryClient` instance from `lib/queryClient.ts`
- **`ChakraProvider`** (`components/ui/provider.tsx`) — Chakra UI v3 system from `theme/index.ts`

## Theme System

Built with `createSystem(defaultConfig, {...})` in `frontend/src/theme/index.ts`:

- **Colors** — `theme/colors.ts`: semantic tokens, accent palette (`oklch(64.6% 0.222 41.116)`)
- **Typography** — `theme/typography.ts`: Inter (UI text), Lora (reader content)
- Dark mode is the default. All color references in components use semantic tokens.

## App Shell

- **`AppShell`** (`components/layout/AppShell.tsx`) — outer layout with collapsible sidebar
- **`Header`** (`components/layout/Header.tsx`) — top bar with scoring status, navigation
- **`Sidebar`** (`components/layout/Sidebar.tsx`) — feed list, category filters, settings link

## Article Reading Flow

1. **`ArticleList`** renders rows via `ArticleRow` components (memoized with `React.memo`)
2. Clicking a row opens **`ArticleReader`** in a drawer
3. Reader uses `key={article.id}` to reset all state on article change
4. **Auto-mark-as-read** after 12 seconds via `useAutoMarkAsRead` hook
5. Article content rendered with **Lora** font for readability

## Data Layer

- All server state managed via TanStack Query — no `useEffect` + `useState` fetch patterns
- Query keys centralized in `lib/queryKeys.ts` factory
- API client functions in `lib/api.ts` — all use relative URLs (Traefik routes `/api` to backend)
- Mutations use `MutationCache.onError` for centralized toast errors (see `tanstack-query` skill)
