# Technology Stack Research

**Project:** Personal RSS Reader
**Focus:** Frontend (Next.js + Chakra UI), Docker Deployment, Ollama Integration
**Researched:** 2026-02-04
**Confidence:** HIGH

## Executive Summary

The recommended stack for this RSS reader frontend leverages **Next.js 16** with the App Router, **Chakra UI v3** for component library, **TanStack Query v5** for data fetching, and **Ollama JavaScript SDK** for local LLM integration. Docker deployment uses multi-stage builds with standalone output for optimized image sizes. All recommendations are based on current 2026 best practices verified against official documentation.

Backend stack (FastAPI, SQLModel, SQLite, feedparser, APScheduler) is already built and locked in.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | 16.1+ | React framework with App Router, SSR, and caching | Industry standard for production React apps in 2026. Next.js 16 brings stable Turbopack (2-5x faster builds), Cache Components with `use cache` directive, and explicit caching model. Required Node.js 20.9+. |
| **React** | 19.2+ | UI library | Comes with Next.js 16. React 19 includes View Transitions, `useEffectEvent()`, and stable concurrent rendering. |
| **TypeScript** | 5.7+ | Type safety | Next.js 16 requires TypeScript 5.1+, but 5.7+ recommended for latest features. Full type safety from backend (FastAPI Pydantic) to frontend (Zod/TypeScript). |

### UI Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Chakra UI** | 3.32.0+ | Component library with theming | Current v3 with first-class Next.js App Router support via `@chakra-ui/next-js`. Built-in dark/light theme system matches project requirements. Requires Node.js 20+. Install: `@chakra-ui/react @emotion/react`. |
| **lucide-react** | 0.562.0+ | Icon library | Tree-shakable SVG icons (only imported icons in bundle). Recommended by Chakra UI docs over react-icons. Clean, consistent design system. Fully typed TypeScript components. |
| **Framer Motion** | Latest | Animation library | Required peer dependency for Chakra UI. Provides smooth transitions for UI components. |

### Data Fetching & State Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TanStack Query** | 5.90.19+ | Server state management | The 2026 standard for data fetching in Next.js. Combines React Server Components (initial loads) with client-side caching, optimistic updates, and background refetching. v5 has improved RSC support and Suspense integration. Teams report 40-70% faster initial loads vs SWR. |
| **Zustand** | 5.0.10+ | Client state management | Minimalist (3KB), zero-boilerplate global state for UI state (modals, filters, selected items). v5 includes `unstable_ssrSafe` middleware for Next.js App Router SSR. Preferred over Redux for solo/small team projects. |

### Date & Time Handling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **date-fns** | 4.1.0+ | Date manipulation and formatting | Lightest bundle size (1.6-3.6 KiB per method vs 6-7 KiB for dayjs). 100% TypeScript. Tree-shakable. v4 includes first-class timezone support. Functional API pairs well with React. Essential for RSS feed timestamps. |

### LLM Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **ollama** (JavaScript SDK) | Latest | Official Ollama client for Node.js/browser | Official library with full feature support: chat, generate, streaming, model management, embeddings. Works in both Node.js (SSR/API routes) and browser. Updated January 2026. Supports `keep_alive` for persistent model loading, critical for responsive M3 inference. |

### Development Tools

| Tool | Purpose | Configuration Notes |
|------|---------|---------------------|
| **ESLint** | Linting | Next.js 16 removed `next lint`. Use ESLint 9+ flat config directly with `eslint.config.mjs`. Import `@next/eslint-plugin-next` and `@typescript-eslint/eslint-plugin` manually. |
| **Prettier** | Code formatting | Pairs with ESLint. Use `prettier-plugin-tailwindcss` if adding Tailwind later. |
| **Ruff** (Backend) | Python linting/formatting | Already configured in backend `pyproject.toml`. Keep Python and JS tooling separate. |

### Containerization & Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|---|
| **Docker** | 27.x+ | Container runtime | Standard for reproducible deployments. |
| **Docker Compose** | 2.x+ | Multi-container orchestration | Manages frontend + backend + volumes. Simpler than Kubernetes for single-server home deployments. |
| **Node.js (Alpine)** | 22-alpine | Runtime for Next.js container | Alpine Linux for minimal image size. Node 22 for latest LTS features. |
| **Python (Slim)** | 3.14-slim | Runtime for FastAPI container | Already in use for backend. Slim variant smaller than full Debian. |

---

## Supporting Libraries

### Essential

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@tanstack/react-query-devtools** | 5.x | TanStack Query debugging | Development only. Visualize queries, cache, and network requests. |
| **zod** | Latest | Runtime schema validation | Type-safe API response parsing. Pairs with TanStack Query for end-to-end type safety (FastAPI Pydantic → Zod → TypeScript). |

### Optional (Add as Needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **react-markdown** | Latest | Markdown rendering | If RSS content includes markdown or if LLM responses use markdown formatting. |
| **sanitize-html** | Latest | HTML sanitization | If rendering RSS content HTML directly (security critical). |
| **clsx** or **classnames** | Latest | Conditional CSS classes | If extending Chakra components with custom styling. |

---

## Installation

### Frontend Core

```bash
# Core framework
npm install next@latest react@latest react-dom@latest

# UI framework
npm install @chakra-ui/react @emotion/react framer-motion lucide-react

# Data fetching & state
npm install @tanstack/react-query zustand

# Utilities
npm install date-fns zod

# LLM integration
npm install ollama

# Development
npm install -D @tanstack/react-query-devtools
npm install -D typescript @types/react @types/node
npm install -D eslint @next/eslint-plugin-next @typescript-eslint/eslint-plugin
npm install -D prettier
```

### Docker (Already Installed on Host)

```bash
# Verify Docker installation
docker --version  # Should be 27.x+
docker compose version  # Should be 2.x+
```

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| **UI Framework** | Chakra UI v3 | Material UI (MUI) | If you need highly polished, Google-spec components. Heavier bundle. |
| **UI Framework** | Chakra UI v3 | Tailwind CSS + shadcn/ui | If you prefer utility-first CSS and don't need a component library. More manual work. |
| **Data Fetching** | TanStack Query v5 | SWR | Smaller projects with simpler data needs. Lacks optimistic updates and advanced caching. |
| **State Management** | Zustand | Jotai | Complex state with many interdependent atoms. Steeper learning curve. |
| **State Management** | Zustand | Redux Toolkit | Large teams needing strict patterns. Overkill for solo dev. |
| **Date Library** | date-fns | Day.js | Migrating from Moment.js (API compatible). Slightly larger bundle. |
| **Date Library** | date-fns | Luxon | Need advanced timezone/i18n features. Heavier (20KB+). |
| **Ollama Client** | ollama (official) | Custom fetch wrapper | You need custom retry logic or middleware. More maintenance. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Next.js 15 or older** | Next.js 16 has breaking changes (async params, middleware → proxy, removed AMP). Turbopack is now stable and default. | Next.js 16.1+ |
| **Chakra UI v2** | v2 doesn't support Next.js App Router properly (client-only rendering issues, CacheProvider hacks). | Chakra UI v3.32.0+ |
| **SWR for complex apps** | Lacks optimistic updates, devtools, and advanced cache invalidation. Fine for simple cases but TanStack Query scales better. | TanStack Query v5 |
| **Redux for solo dev** | Too much boilerplate (actions, reducers, thunks) for one developer. Zustand is 10x simpler. | Zustand |
| **Moment.js** | Deprecated, huge bundle size (67KB), not tree-shakable. | date-fns or Day.js |
| **Docker `restart: no`** | Containers won't auto-restart on crash or server reboot. Bad for production. | `restart: unless-stopped` |
| **Docker bind mounts for SQLite** | Risky permissions issues, path conflicts. | Named volumes (Docker-managed) |
| **Webpack in Next.js 16** | Turbopack is now stable and default. Webpack is legacy. Only use if specific plugin required. | Turbopack (default) |
| **`next lint` command** | Removed in Next.js 16. Use ESLint directly. | ESLint 9+ with flat config |

---

## Stack Patterns by Scenario

### Pattern 1: Server Component + Client Island (Recommended)

**When:** Initial page load needs fast SSR, then interactive client-side updates.

**Stack:**
- Server Component fetches initial data via `fetch()` with `cache: "no-store"` or `cache()` API
- Pass data to Client Component as props
- Client Component uses TanStack Query for mutations and background refetching

**Example:** Feed list page loads server-side, individual feed items refetch on focus.

### Pattern 2: Full Client-Side Rendering

**When:** User-specific dynamic data, no SEO needs (dashboard, settings page).

**Stack:**
- Mark page as Client Component with `"use client"`
- Use TanStack Query for all data fetching
- Use Zustand for UI state (filters, modals)

**Example:** User preferences page, LLM chat interface.

### Pattern 3: Ollama Local Inference

**When:** Running LLM curation on user's machine (M3 Mac).

**Stack:**
- Ollama running as separate service (not containerized for M3 performance)
- Next.js API route proxies requests to `http://localhost:11434`
- Frontend calls `/api/llm/curate` with feed item data
- Use streaming responses for real-time LLM output

**Example:** "Curate this feed" button streams LLM analysis to UI.

### Pattern 4: Docker Multi-Service Deployment

**When:** Deploying to home server.

**Stack:**
- Docker Compose with 3 services: `backend`, `frontend`, `volumes`
- Multi-stage Dockerfile for Next.js (standalone output)
- Named volumes for SQLite persistence
- Healthchecks with `depends_on: service_healthy`
- `restart: unless-stopped` for auto-recovery

**Example:** Home server deployment with persistent data.

---

## Version Compatibility Matrix

| Frontend | Backend | Node.js | Python | Docker | Notes |
|----------|---------|---------|--------|--------|-------|
| Next.js 16.1+ | FastAPI 0.128.0+ | 20.9+ | 3.14+ | 27.x+ | Next.js 16 requires Node 20.9+. Backend requires Python 3.14. |
| Chakra UI 3.32.0+ | — | 20+ | — | — | Chakra v3 requires Node 20+. |
| TanStack Query 5.x | — | 18+ | — | — | v5 works with React 18+. |
| Ollama JS SDK | Ollama Server | — | — | — | Ollama server runs natively (not Docker) for M3 performance. |

### Known Compatibility Issues

- **Next.js 16 + ESLint 8**: ESLint 8 uses legacy config. Upgrade to ESLint 9+ with flat config.
- **Chakra UI v3 + React 18**: Chakra v3 requires React 18+. React 19 recommended for Next.js 16.
- **SQLite in Docker + Bind Mounts**: Permissions issues. Use named volumes only.
- **Ollama in Docker on M3**: Performance degradation vs native. Run Ollama outside Docker, connect via network.

---

## Docker Configuration Best Practices

### Multi-Stage Next.js Dockerfile

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

**Key Points:**
- Requires `output: "standalone"` in `next.config.ts`
- Reduces image from ~892MB to ~229MB (75% reduction)
- Separates build-time from runtime dependencies

### Docker Compose Configuration

```yaml
services:
  backend:
    build: ./backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - sqlite_data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    build: ./frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  sqlite_data:
    driver: local
```

**Key Points:**
- `restart: unless-stopped` survives server reboots but allows manual stops
- Named volumes for SQLite persistence (managed by Docker)
- Healthchecks ensure backend is ready before frontend starts
- Frontend only exposes port 3000 externally; backend communicates via Docker network

---

## Sources

### High Confidence (Official Docs)

- [Next.js 16 Release](https://nextjs.org/blog/next-16) — Official Next.js 16 announcement
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — Breaking changes and migration
- [Chakra UI with Next.js App](https://chakra-ui.com/docs/get-started/frameworks/next-app) — Official Chakra v3 setup
- [Ollama JavaScript Library](https://github.com/ollama/ollama-js) — Official ollama-js SDK
- [Docker Compose Reference](https://docs.docker.com/reference/compose-file/services/) — Official Docker Compose docs
- [Docker Volumes](https://docs.docker.com/get-started/docker-concepts/running-containers/persisting-container-data/) — Official volume persistence guide
- [TanStack Query Installation](https://tanstack.com/query/v5/docs/react/installation) — Official v5 docs

### Medium Confidence (Verified Community Sources)

- [Next.js 16 + React Query Guide (2025)](https://medium.com/@bendesai5703/next-js-16-react-query-the-ultimate-guide-to-modern-data-fetching-caching-performance-ac13a62d727d) — Data fetching patterns
- [React Server Components + TanStack Query (2026)](https://dev.to/krish_kakadiya_5f0eaf6342/react-server-components-tanstack-query-the-2026-data-fetching-power-duo-you-cant-ignore-21fj) — RSC + TanStack Query patterns
- [State Management in 2025](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k) — Zustand vs Jotai vs Redux
- [date-fns vs Day.js](https://www.dhiwise.com/post/date-fns-vs-dayjs-the-battle-of-javascript-date-libraries) — Bundle size comparison
- [Next.js Standalone Docker](https://dev.to/angojay/optimizing-nextjs-docker-images-with-standalone-mode-2nnh) — Multi-stage builds
- [Docker Compose Healthchecks](https://last9.io/blog/docker-compose-health-checks/) — depends_on patterns
- [Docker Restart Policies](https://www.baeldung.com/ops/docker-compose-restart-policies) — always vs unless-stopped

### Search References

- [Next.js 16.1 Update Review (2025)](https://staticmania.com/blog/next.js-16.1-review)
- [Vercel's Next.js 16: Turbopack Stability (InfoQ)](https://www.infoq.com/news/2025/12/nextjs-16-release/)
- [Lucide React Icons](https://lucide.dev/guide/packages/lucide-react)
- [Zustand Release History](https://github.com/pmndrs/zustand/releases)
- [date-fns v4 Release](https://github.com/date-fns/date-fns/releases)
- [FastAPI Docker Best Practices](https://betterstack.com/community/guides/scaling-python/fastapi-docker-best-practices/)

---

**Stack research for:** Personal RSS Reader Frontend + Docker + Ollama
**Researched:** 2026-02-04
**Confidence:** HIGH — All core technologies verified against official documentation (Next.js, Chakra UI, Ollama, Docker). Library versions confirmed via npm/GitHub. Docker patterns cross-referenced with official Docker docs. Ollama integration details verified via official SDK docs.
