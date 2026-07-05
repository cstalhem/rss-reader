---
name: nextjs-app-router
description: Next.js App Router patterns — Server vs Client components, "use client" boundaries, dev API proxy, next/font network requirement, theming architecture, localStorage hydration
---

# Next.js App Router

Deep reference for the Next.js patterns used in this project. For concise rules, see `.claude/rules/frontend.md`.

## Key Patterns

### `"use client"` Boundary

Only add `"use client"` to components that use hooks, event handlers, or browser APIs. `layout.tsx` and `page.tsx` are Server Components — they can fetch data and render HTML without shipping JS to the client.

**Boundary rule:** Server Components can pass **serializable data** (strings, numbers, objects, arrays) to Client Components. They cannot pass functions, callbacks, React elements as render props, or class instances. If a component needs interactivity, make it a Client Component and compose it inside a Server Component.

### Same-Origin API + Dev Rewrite Proxy

API URLs are **relative everywhere** — the frontend is same-origin with the backend in every environment, so there is no `NEXT_PUBLIC_API_URL` and no client-side base URL. In production, the reverse proxy (Traefik) routes `PathPrefix('/api')` to the backend and everything else to the frontend.

In development there is no reverse proxy, so `next.config.ts` emulates it with a `rewrites()` proxy, **gated on `PHASE_DEVELOPMENT_SERVER`**:

```ts
// next.config.ts — config is a phase-aware function
export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...baseConfig,
      async rewrites() {
        return [{ source: "/api/:path*", destination: "http://localhost:8912/api/:path*" }];
      },
    };
  }
  return baseConfig; // prod relies on the reverse proxy, not a rewrite
}
```

**Why phase-gated:** external rewrites in `output: "standalone"` builds have known issues, and Next's proxy buffers streaming responses (would matter if SSE ever lands). The rewrite exists only to give dev the same same-origin `/api` shape as prod.

### `next/font` Requires Network Access

Fonts are loaded via `next/font` (Google Fonts: Inter for UI, Lora for reader content). Both `next build` and the dev server **fetch these fonts at build/start time** — sandboxed or air-gapped runs fail. Run unsandboxed. The offline fix would be `next/font/local` with vendored font files, but the project currently uses the remote loader.

### Theming Architecture

The theme is **system-decided** via next-themes (`defaultTheme="system"`, `enableSystem`, `attribute="class"`), not dark-default. Color tokens live in `:root` (light) and `.dark` (dark override) blocks in `src/app/globals.css`.

Tokens are mapped to Tailwind utilities with **`@theme inline`** — the `inline` keyword is required. Plain `@theme` inlines the token value at parse time, which breaks `var()` references (the `.dark` override would never apply). Fonts are mapped the same way (`--font-sans: var(--font-inter)`).

**Re-theming flow:** build a preset at ui.shadcn.com/create, then from `frontend/` run:

```bash
bunx --bun shadcn@latest apply --preset <id> --only theme -y
```

Use `--only theme`, never a full preset apply: user presets may target the shadcn Base UI variant, but this app is on the Radix base, and fonts are project-owned. `apply` overwrites the token blocks (including their comments).

## Anti-Patterns

### Reading `localStorage` in `useState` Initializer

```tsx
// BAD — server renders "default", client reads "stored-value" → hydration mismatch
const [value, setValue] = useState(localStorage.getItem("key") || "default");

// GOOD — initialize with default, sync from localStorage after hydration
const [value, setValue] = useState("default");
useEffect(() => {
  const stored = localStorage.getItem("key");
  if (stored) setValue(stored);
}, []);
```

This pattern is encapsulated in `hooks/useLocalStorage.ts`. Always use the hook rather than reimplementing.

### Passing Functions Through the Server/Client Boundary

```tsx
// BAD — Server Component tries to pass a callback to Client Component
// page.tsx (Server Component):
<InteractiveWidget onSave={(data) => saveToDb(data)} />

// GOOD — Client Component owns its own logic
// page.tsx (Server Component):
<InteractiveWidget initialData={data} />
// InteractiveWidget.tsx ("use client"):
function InteractiveWidget({ initialData }) {
  const handleSave = (data) => fetch("/api/save", { body: JSON.stringify(data) });
}
```

## shadcn Sidebar Patterns

- **`SidebarMenuBadge` only works as a sibling of `SidebarMenuButton` on plain menu items** — it has no sub-row (`SidebarMenuSubItem`) support. For counts on sub-rows, use an in-flow `ml-auto` count span inside the row instead.
- **Split select/toggle rows** (a row that both navigates and expands) follow the official `sidebar-10` pattern: a `SidebarMenuButton` for the action plus a **sibling** `CollapsibleTrigger asChild > SidebarMenuAction` for the toggle. Don't nest the trigger inside the button.
- **`SidebarMenuSkeleton` breaks SSR hydration** — its default `Math.random()` width differs between server and client render. Pass a deterministic `width` prop.

## Decision Aids

### "Should this be a Server Component or Client Component?"

| Needs                                 | Component type                                      |
| ------------------------------------- | --------------------------------------------------- |
| Static content, data fetching, SEO    | Server Component                                    |
| Hooks (useState, useEffect, useQuery) | Client Component (`"use client"`)                   |
| Event handlers (onClick, onChange)    | Client Component                                    |
| Browser APIs (localStorage, window)   | Client Component                                    |
| Both static and interactive parts     | Server Component parent + Client Component children |
