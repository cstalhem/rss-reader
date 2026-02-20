---
name: nextjs-app-router
description: Next.js App Router patterns — Server vs Client components, "use client" boundaries, env var build-time baking, Turbopack/Emotion workaround, localStorage hydration
---

# Next.js App Router

Deep reference for the Next.js patterns used in this project. For concise rules, see `.claude/rules/frontend.md`.

## Key Patterns

### `"use client"` Boundary

Only add `"use client"` to components that use hooks, event handlers, or browser APIs. `layout.tsx` and `page.tsx` are Server Components — they can fetch data and render HTML without shipping JS to the client.

**Boundary rule:** Server Components can pass **serializable data** (strings, numbers, objects, arrays) to Client Components. They cannot pass functions, callbacks, React elements as render props, or class instances. If a component needs interactivity, make it a Client Component and compose it inside a Server Component.

### `NEXT_PUBLIC_*` Environment Variables

These are **baked at build time** via string replacement. `process.env.NEXT_PUBLIC_API_URL` becomes a literal string in the JS bundle. Setting `environment` in docker-compose at runtime has no effect on client code — only on server-side code.

**Implication for Docker:** The frontend image is built with relative API URLs. Traefik routes `PathPrefix('/api')` to the backend, all other requests to the frontend. This avoids needing runtime environment variables for the API URL.

### Turbopack and Emotion SSR

Turbopack mishandles Emotion CSS SSR, causing `<script>` vs `<style data-emotion>` hydration mismatch. The fix is to use `--webpack` flag in dev/build scripts (`frontend/package.json`). `suppressHydrationWarning` on `<html>` in `layout.tsx` is also required. This is an upstream issue — do not remove these workarounds.

## Anti-Patterns

### Reading `localStorage` in `useState` Initializer

```tsx
// BAD — server renders "default", client reads "stored-value" → hydration mismatch
const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

// GOOD — initialize with default, sync from localStorage after hydration
const [theme, setTheme] = useState("dark");
useEffect(() => {
  const stored = localStorage.getItem("theme");
  if (stored) setTheme(stored);
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

## Decision Aids

### "Should this be a Server Component or Client Component?"

| Needs                                 | Component type                                      |
| ------------------------------------- | --------------------------------------------------- |
| Static content, data fetching, SEO    | Server Component                                    |
| Hooks (useState, useEffect, useQuery) | Client Component (`"use client"`)                   |
| Event handlers (onClick, onChange)    | Client Component                                    |
| Browser APIs (localStorage, window)   | Client Component                                    |
| Both static and interactive parts     | Server Component parent + Client Component children |
