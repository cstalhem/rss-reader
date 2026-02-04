# Architecture Research

**Domain:** Personal RSS Reader with LLM Curation
**Researched:** 2026-02-04
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │  Article  │  │   Feed    │  │  Settings │               │
│  │  List UI  │  │  Mgmt UI  │  │    UI     │               │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │
│        │              │              │                      │
│        └──────────────┴──────────────┘                      │
│                       │                                     │
│              HTTP API (REST/JSON)                           │
│                       │                                     │
├───────────────────────┼─────────────────────────────────────┤
│                     Backend (FastAPI)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   API Routes                        │    │
│  │  /api/articles | /api/feeds | /api/refresh         │    │
│  └──────┬──────────────────────┬───────────────────────┘    │
│         │                      │                            │
│  ┌──────┴──────┐        ┌──────┴──────┐                    │
│  │   Business  │        │  Scheduler  │                    │
│  │    Logic    │        │ (APScheduler)│                   │
│  │  (feeds.py) │        │   30 min    │                    │
│  └──────┬──────┘        └──────┬──────┘                    │
│         │                      │                            │
│  ┌──────┴──────────────────────┴──────┐                    │
│  │        Database Layer               │                    │
│  │      (SQLModel + SQLite)            │                    │
│  └─────────────────────────────────────┘                    │
├─────────────────────────────────────────────────────────────┤
│                   Data Storage (SQLite)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Feeds   │  │ Articles │  │  Scores  │                  │
│  │  Table   │  │  Table   │  │ (future) │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘

                ┌───────────────────────┐
                │  Ollama (LLM Service) │
                │   (Milestone 3)       │
                └───────────┬───────────┘
                            │
                  Batch scoring after fetch
                            │
                     ┌──────▼──────┐
                     │   Backend   │
                     │  (scoring   │
                     │   pipeline) │
                     └─────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Next.js Frontend** | UI rendering, user interaction, state management | React Server Components (default) + Client Components for interactivity |
| **FastAPI Backend** | REST API, business logic, feed fetching, LLM orchestration | Layered monolith with routes, services, data access |
| **APScheduler** | Periodic feed refresh (30 min intervals) | Async background jobs within FastAPI process |
| **SQLite Database** | Persistent storage for feeds, articles, scores | Single file database at `./data/rss.db` with SQLModel ORM |
| **Ollama** | Local LLM inference for batch scoring | Separate service (Docker or host), REST API |

## Recommended Project Structure

### Backend (FastAPI)

```
backend/
├── src/
│   └── backend/
│       ├── __init__.py
│       ├── main.py              # FastAPI app, CORS, lifespan
│       ├── models.py            # SQLModel table definitions
│       ├── database.py          # Engine, session management
│       ├── feeds.py             # Feed refresh logic
│       ├── scheduler.py         # APScheduler setup
│       └── scoring.py           # LLM scoring (M3)
├── tests/
│   ├── conftest.py              # Test fixtures
│   ├── test_api.py              # API endpoint tests
│   └── test_scoring.py          # LLM integration tests (M3)
├── data/                        # SQLite database location
│   └── rss.db
├── Dockerfile
└── pyproject.toml               # Dependencies
```

### Frontend (Next.js)

```
frontend/
├── app/                         # App Router (Next.js 16)
│   ├── layout.tsx               # Root layout with ChakraProvider
│   ├── page.tsx                 # Home page (article list)
│   ├── articles/
│   │   └── [id]/
│   │       └── page.tsx         # Article detail view
│   ├── feeds/
│   │   └── page.tsx             # Feed management (M2)
│   └── settings/
│       └── page.tsx             # Settings, LLM preferences (M3)
├── components/
│   ├── ArticleCard.tsx          # Client Component for article preview
│   ├── ArticleDetail.tsx        # Client Component for article reader
│   ├── ThemeToggle.tsx          # Client Component for dark/light mode
│   └── providers.tsx            # ChakraProvider wrapper (client)
├── lib/
│   ├── api.ts                   # API client functions
│   └── types.ts                 # TypeScript types (match backend)
├── Dockerfile
└── package.json
```

### Docker Compose (Root)

```
/
├── docker-compose.yml           # Production configuration
├── docker-compose.dev.yml       # Development overrides (optional)
└── .env.example                 # Example environment variables
```

### Structure Rationale

- **Backend**: Layered monolith keeps code simple for single-user app. Separation of concerns (routes → business logic → data access) enables testing and future refactoring.
- **Frontend**: Next.js App Router structure with Server Components by default, Client Components for interactivity. Chakra UI requires Client Components (marked with `'use client'`).
- **Docker Compose**: Single file orchestrates both frontend and backend, with named volumes for persistence.

## Architectural Patterns

### Pattern 1: API-First Separation (Backend/Frontend Decoupling)

**What:** Frontend and backend are separate services communicating via REST API. Frontend runs on port 3210, backend on port 8912.

**When to use:** When you need independent deployment, technology flexibility, or clear contract boundaries.

**Trade-offs:**
- **Pros:** Clear separation, easier to test, no coupling, can swap frontend/backend independently
- **Cons:** Need CORS configuration, slightly more complex deployment (2 containers vs 1)

**Example:**
```typescript
// frontend/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8912';

export async function getArticles(skip = 0, limit = 50) {
  const res = await fetch(`${API_BASE}/api/articles?skip=${skip}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch articles');
  return res.json();
}
```

**Note:** This is the **recommended pattern** for this project because:
- Backend already built and functional (M1 complete)
- Clean API contract already established
- Enables iterating on frontend without backend changes
- CORS already configured in `backend/main.py`

### Pattern 2: Server Components by Default (Next.js App Router)

**What:** Next.js 16 components are Server Components by default. Use Client Components (with `'use client'`) only when needed for interactivity.

**When to use:** Default for all components. Add `'use client'` when you need:
- React hooks (useState, useEffect, etc.)
- Event handlers (onClick, onChange)
- Browser APIs
- Third-party libraries that rely on browser features (Chakra UI)

**Trade-offs:**
- **Pros:** Reduced JavaScript bundle size, faster initial loads, secure data fetching
- **Cons:** Need explicit boundaries, some libraries require Client Components

**Example:**
```typescript
// app/articles/[id]/page.tsx (Server Component - default)
export default async function ArticlePage({ params }: { params: { id: string } }) {
  const article = await fetch(`${API_URL}/api/articles/${params.id}`).then(r => r.json());
  return <ArticleDetail article={article} />;
}

// components/ArticleDetail.tsx (Client Component - needs interactivity)
'use client';
import { Button } from '@chakra-ui/react';

export function ArticleDetail({ article }) {
  const [isRead, setIsRead] = useState(article.is_read);
  const handleMarkRead = () => { /* ... */ };
  return <Button onClick={handleMarkRead}>Mark Read</Button>;
}
```

### Pattern 3: Layered Monolith with Scheduler (Backend)

**What:** Backend is organized into layers (routes → services → data access), with APScheduler running in the same process.

**When to use:** Single-user apps where deployment simplicity matters more than horizontal scalability.

**Trade-offs:**
- **Pros:** Simple deployment (1 process), no message queue needed, easy to debug
- **Cons:** Scheduler jobs block process restart (graceful shutdown needed)

**Example:**
```python
# backend/main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    start_scheduler()  # Start background jobs
    yield
    shutdown_scheduler()  # Graceful cleanup

app = FastAPI(lifespan=lifespan)
```

**Note:** This is already implemented and working. Keep it for M1-M2. Consider Celery/Redis only if you need distributed task processing (unlikely for single-user RSS reader).

### Pattern 4: Batch LLM Scoring (Milestone 3)

**What:** After fetching new articles, send them in batch to Ollama for scoring. Avoid scoring on-demand during article list rendering.

**When to use:** LLM inference is slow (~1-3 seconds per article). Batch processing amortizes latency and enables async UX.

**Trade-offs:**
- **Pros:** Doesn't block UI, can score multiple articles concurrently, predictable resource usage
- **Cons:** Scores not available immediately after fetch (acceptable for 30-min refresh cycle)

**Example:**
```python
# backend/scoring.py (Milestone 3)
async def score_articles_batch(articles: list[Article], preferences: str):
    """Score multiple articles in parallel using Ollama."""
    tasks = [score_single_article(article, preferences) for article in articles]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for article, result in zip(articles, results):
        if isinstance(result, Exception):
            logger.error(f"Failed to score article {article.id}: {result}")
        else:
            article.interest_score = result['interest_score']
            article.score_category = result['category']

async def score_single_article(article: Article, preferences: str):
    """Score a single article via Ollama API."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://ollama:11434/api/generate",  # Docker service name
            json={
                "model": "llama3.1:8b",
                "prompt": f"User preferences: {preferences}\n\nArticle: {article.title}\n{article.summary}\n\nScore this article...",
                "stream": False
            },
            timeout=30.0
        )
    return parse_llm_response(response.json())
```

**Integration point:** Call `score_articles_batch()` at the end of `refresh_feed()` in `feeds.py`, after new articles are saved to the database.

## Data Flow

### Request Flow (Frontend → Backend)

```
[User Action: Click "Refresh"]
    ↓
[Next.js Client Component] → onClick handler
    ↓
[API Client (lib/api.ts)] → POST /api/feeds/refresh
    ↓
[FastAPI Route (main.py)] → manual_refresh()
    ↓
[Service (feeds.py)] → refresh_feed(session, feed)
    ↓
[External RSS Feed] ← httpx.AsyncClient.get(feed.url)
    ↓
[Database (SQLite)] ← session.add(new_articles)
    ↓
[Response] → { message: "Refreshed 1 feed(s)", new_articles: 5 }
    ↓
[Frontend] ← Display success notification
```

### Scheduled Refresh Flow (Background)

```
[APScheduler Trigger] (every 30 minutes)
    ↓
[scheduler.py] → refresh_all_feeds()
    ↓
[For each feed]:
    ↓
    [Service (feeds.py)] → refresh_feed(session, feed)
    ↓
    [External RSS Feed] ← feedparser + httpx
    ↓
    [Database] ← Bulk insert new articles
    ↓
    [Ollama] ← score_articles_batch() (M3)
    ↓
    [Database] ← Update article scores
```

### LLM Scoring Pipeline (Milestone 3)

```
[New Articles Fetched] (via refresh_feed)
    ↓
[Stage 1: Keyword Filters] (programmatic)
    ├─ Blocked keywords (e.g., "IPO") → Mark as auto-hidden
    ├─ Title/content deduplication → Skip duplicates
    └─ Pass remaining → Stage 2
    ↓
[Stage 2: LLM Scoring] (batch)
    ├─ Construct prompt with user preferences
    ├─ Send to Ollama API (concurrent requests)
    ├─ Parse JSON response: { interest_score, category, reason }
    └─ Update article records in DB
    ↓
[Results Stored]
    ├─ Articles table: interest_score, score_category, score_reason
    └─ Frontend queries by score DESC to surface high-interest articles
```

### Key Data Flows

1. **Article List Rendering:** Frontend fetches `/api/articles?skip=0&limit=50` → Backend queries SQLite ordered by `published_at DESC` (or `interest_score DESC` in M3) → Returns JSON array
2. **Mark as Read:** Frontend PATCHes `/api/articles/{id}` with `{is_read: true}` → Backend updates SQLite → Returns updated article
3. **Feed Refresh:** Manual or scheduled trigger → Fetch RSS XML → Parse with feedparser → Deduplicate by URL → Insert new articles → Score with LLM (M3) → Store results

## Docker Compose Architecture

### Service Topology

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8912:8912"
    volumes:
      - rss-data:/app/data              # Persistent SQLite database
    environment:
      - DATABASE_URL=sqlite:///./data/rss.db
    restart: unless-stopped             # Auto-restart on failure
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8912/"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "3210:3210"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8912  # Docker internal network
    depends_on:
      backend:
        condition: service_healthy      # Wait for backend to be ready
    restart: unless-stopped

  ollama:  # Milestone 3
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-models:/root/.ollama     # Persistent model storage
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]       # GPU support (if available)

volumes:
  rss-data:       # Named volume for SQLite persistence
  ollama-models:  # Named volume for Ollama models (M3)
```

### Production Best Practices

| Practice | Implementation | Rationale |
|----------|----------------|-----------|
| **Named Volumes** | `rss-data`, `ollama-models` | Data persists across container restarts. Survives `docker-compose down` unless `-v` flag used. |
| **Restart Policies** | `restart: unless-stopped` | Containers auto-restart on failure or server reboot. `unless-stopped` prevents restart if manually stopped. |
| **Health Checks** | Backend health endpoint (`/`) | Ensures dependent services (frontend) wait for backend to be ready before starting. |
| **Service Dependencies** | `depends_on.condition: service_healthy` | Frontend won't start until backend is healthy, preventing startup errors. |
| **Environment Variables** | `.env` file + `environment:` key | Secrets and config stay out of code. Use `.env.example` for documentation. |
| **Build Context Separation** | `build: ./backend`, `build: ./frontend` | Each service has its own Dockerfile, enabling independent builds and caching. |
| **Internal Networking** | Docker default bridge network | Services communicate by service name (e.g., `http://backend:8912`). Host uses `localhost:8912`. |
| **Resource Limits** | `deploy.resources.reservations` | Ollama gets GPU access (if available). Can add memory limits to prevent OOM. |

### Docker Compose Variants

**M1 (MVP):** Backend + Frontend only
```yaml
services:
  backend: { ... }
  frontend: { ... }
volumes:
  rss-data:
```

**M3 (LLM Scoring):** Add Ollama service
```yaml
services:
  backend: { ... }
  frontend: { ... }
  ollama: { ... }
volumes:
  rss-data:
  ollama-models:
```

### Development vs Production

**Development:** Use `docker-compose.dev.yml` override for:
- Volume mounts for hot-reload: `./backend/src:/app/src`
- Debug logging: `environment.LOG_LEVEL=DEBUG`
- Exposed database ports for inspection

**Production:** Use base `docker-compose.yml` with:
- No source code volumes (code baked into image)
- Minimal logging: `environment.LOG_LEVEL=INFO`
- No exposed internal ports (only public-facing 3210)

**Command:**
```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker-compose up -d
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **Single user (current)** | Current architecture is perfect. No changes needed. SQLite handles ~100K articles easily. |
| **10 users** | Still fine. SQLite can handle ~1M writes/day. Consider read replicas if query load increases (unlikely for RSS). |
| **100+ users** | Migrate to PostgreSQL for better concurrency. Move scheduler to Celery + Redis. Add nginx reverse proxy. Deploy to multi-node Docker Swarm or Kubernetes. |

### Scaling Priorities

1. **First bottleneck (unlikely):** LLM scoring latency (M3). Ollama can handle ~2-4 req/sec on CPU, 10-20 req/sec on GPU. With 30-min refresh cycle and ~50 articles/feed, single-user will never hit this. If needed: increase `OLLAMA_NUM_PARALLEL` env var, or switch to faster model (e.g., `mistral:7b`).

2. **Second bottleneck (very unlikely):** SQLite write contention during concurrent refresh. Solution: Stagger feed refresh times, or batch insert articles. Not needed for single-user with 5-10 feeds.

**Note:** For a personal RSS reader, premature optimization is more harmful than helpful. Current architecture supports 10-20 feeds with 30-min refresh indefinitely.

## Anti-Patterns

### Anti-Pattern 1: Serving Frontend from FastAPI

**What people do:** Configure FastAPI to serve Next.js static export from `backend/static/`.

**Why it's wrong:**
- Couples deployment (can't update frontend without backend rebuild)
- Breaks Next.js features (Server Components, middleware, ISR)
- Eliminates CORS (good) but at the cost of flexibility (bad)

**Do this instead:** Separate containers with CORS. If you hate CORS, use nginx reverse proxy to route `/api/*` to backend and `/*` to frontend on the same origin.

### Anti-Pattern 2: Real-Time Scoring During List Rendering

**What people do:** Score articles on-demand when user loads article list, showing "Scoring..." spinner for each article.

**Why it's wrong:**
- Terrible UX (3-5 second delay per article = 30+ seconds for 10 articles)
- Wastes Ollama resources (re-scores same articles on every page load)
- Blocks rendering (can't show list until all scores computed)

**Do this instead:** Batch score during feed refresh. Store scores in database. Render list immediately with pre-computed scores. Add `scored_at` timestamp to detect stale scores and re-score in background if preferences change.

### Anti-Pattern 3: Wildcard CORS (`allow_origins=["*"]`)

**What people do:** Use `allow_origins=["*"]` to "avoid CORS issues."

**Why it's wrong:**
- Security risk: Any website can call your API
- Breaks credentials: Browsers reject `allow_credentials=True` with wildcard origins
- Lazy: CORS errors mean misconfiguration, not "CORS is hard"

**Do this instead:** Explicitly list allowed origins: `allow_origins=["http://localhost:3210"]` for dev, `allow_origins=["https://rss.example.com"]` for prod. Use environment variables to configure per-deployment.

### Anti-Pattern 4: Blocking Sync Feed Fetch

**What people do:** Use `requests.get()` (blocking) in FastAPI route handlers.

**Why it's wrong:**
- Blocks event loop (kills FastAPI concurrency)
- Slow feed fetch (5-10 seconds) blocks all other requests
- Cascade failures if one feed times out

**Do this instead:** Use `httpx.AsyncClient()` for all external HTTP requests. FastAPI is async-first; use `async def` route handlers and `await` all I/O. Already implemented in `backend/feeds.py`.

### Anti-Pattern 5: Client Components Everywhere

**What people do:** Add `'use client'` to every Next.js component "to be safe."

**Why it's wrong:**
- Defeats Next.js 16 performance gains (Server Components reduce bundle size by 50-70%)
- Increases JavaScript download and parse time
- Forces data fetching client-side (slower, exposes API URLs)

**Do this instead:** Keep components Server Components by default. Only add `'use client'` when you need:
- React hooks (useState, useEffect, useContext)
- Event handlers (onClick, onChange, onSubmit)
- Browser APIs (localStorage, window.location)
- Third-party libraries that require client (Chakra UI)

**Rule of thumb:** If a component doesn't have interactivity, it's a Server Component.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **RSS Feeds** | HTTP GET with feedparser | Use `httpx.AsyncClient()` with 10s timeout. Handle malformed XML gracefully. |
| **Ollama** | HTTP POST to `/api/generate` | Runs locally (Docker service or host). Use `stream: false` for batch mode. 30s timeout for LLM inference. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Frontend ↔ Backend** | REST API (JSON over HTTP) | CORS enabled for `http://localhost:3210`. Use `fetch()` client-side, native `fetch()` in Server Components. |
| **Backend ↔ Database** | SQLModel ORM (sync) | `Session` dependency injection via `Depends(get_session)`. Connection pooling handled by SQLAlchemy. |
| **Backend ↔ Scheduler** | Direct function calls (same process) | APScheduler runs in FastAPI process. Jobs call service functions (`refresh_feed`) directly. |
| **Backend ↔ Ollama** | HTTP POST with JSON | Use `httpx.AsyncClient()` for async requests. Handle timeouts and retries. Parse JSON response. |

## Build Order & Dependencies

**Milestone 1 (MVP) — Build Order:**

1. **Frontend scaffolding** (Already exists: Next.js skeleton)
   - Set up Chakra UI provider in `app/layout.tsx`
   - Create `lib/api.ts` client functions
   - Dependencies: None (backend API already functional)

2. **Article list view** (`app/page.tsx`)
   - Server Component fetches `/api/articles`
   - Client Component `<ArticleCard>` for interactivity (mark read)
   - Dependencies: API client

3. **Article detail view** (`app/articles/[id]/page.tsx`)
   - Server Component fetches single article
   - Client Component `<ArticleDetail>` for mark read, open original link
   - Dependencies: API client

4. **Theme toggle** (Chakra UI `useColorMode`)
   - Client Component in layout or header
   - Dependencies: ChakraProvider setup

5. **Docker Compose** (root `docker-compose.yml`)
   - Backend + frontend services
   - Named volume for SQLite
   - Health checks and restart policies
   - Dependencies: Dockerfiles for backend and frontend

**Milestone 2 (Feed Management):**

1. Backend API routes (`POST /api/feeds`, `DELETE /api/feeds/{id}`)
2. Frontend feed management UI (`app/feeds/page.tsx`)
3. Feed groups (backend model + API + frontend UI)

**Milestone 3 (LLM Scoring):**

1. Ollama Docker service in `docker-compose.yml`
2. Backend `scoring.py` module
3. Integration in `refresh_feed()` to call scoring after fetch
4. Database schema update (add `interest_score`, `score_category`, `score_reason` columns)
5. Frontend sorting/filtering by score
6. Settings UI for prose-style preferences

**Critical Dependencies:**
- M1 frontend depends on M1 backend (already complete)
- M1 Docker Compose depends on Dockerfiles
- M3 scoring depends on Ollama service
- M3 preferences UI depends on backend preferences storage

## Sources

**Next.js Architecture:**
- [Next.js Architecture in 2026 — Server-First, Client-Islands, and Scalable App Router Patterns](https://www.yogijs.tech/blog/nextjs-project-architecture-app-router)
- [Next.js 16 Release](https://nextjs.org/blog/next-16)
- [Next.js App Router — Advanced Patterns for 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)
- [Next.js App Router Project Structure](https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure)
- [Using Chakra UI in Next.js (App)](https://chakra-ui.com/docs/get-started/frameworks/next-app)

**Docker Compose Production:**
- [Use Compose in Production | Docker Docs](https://docs.docker.com/compose/how-tos/production/)
- [Volumes | Docker Docs](https://docs.docker.com/engine/storage/volumes/)
- [Docker Compose in Production: A Practical Guide](https://medium.com/@muhabbat.dev/docker-compose-in-production-a-practical-guide-1af2f4c668d7)
- [Stop Misusing Docker Compose in Production](https://dflow.sh/blog/stop-misusing-docker-compose-in-production-what-most-teams-get-wrong)

**Ollama Integration:**
- [Large Scale Batch Processing with Ollama](https://robert-mcdermott.medium.com/large-scale-batch-processing-with-ollama-1e180533fb8a)
- [Using Ollama in Production: A Developer's Practical Guide](https://collabnix.com/using-ollama-in-production-a-developers-practical-guide/)
- [How Ollama Handles Parallel Requests](https://www.glukhov.org/post/2025/05/how-ollama-handles-parallel-requests/)
- [Batch Processing Optimization: Handle Multiple Ollama Requests](https://markaicode.com/ollama-batch-processing-optimization/)

**FastAPI Architecture:**
- [FastAPI Next.js Integration Repository](https://github.com/Nneji123/fastapi-nextjs)
- [CORS (Cross-Origin Resource Sharing) - FastAPI](https://fastapi.tiangolo.com/tutorial/cors/)
- [Developing a Single Page App with FastAPI and React](https://testdriven.io/blog/fastapi-react/)

---
*Architecture research for: Personal RSS Reader with LLM Curation*
*Researched: 2026-02-04*
