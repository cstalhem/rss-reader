# Milestone 1: MVP Implementation Plan

Build a working RSS reader with a single feed displayed in a Next.js UI, backed by FastAPI and SQLite, running in Docker.

- **Feed:** https://simonwillison.net/atom/everything/
- **Ports:** Frontend 3210 / Backend 8912
- **Database:** `./data/rss.db` (mounted volume, shared across dev and production)

---

## Proposed Changes

### Phase 1: Project Scaffolding

#### Backend Setup (`/backend`)

1. **Initialize Python project with uv**
   ```bash
   mkdir backend && cd backend
   uv init --app --package
   uv add fastapi sqlmodel feedparser apscheduler uvicorn httpx
   uv add --dev pytest pytest-asyncio
   ```
   
   > The `--app --package` flags create a `src/` layout suitable for a packaged application.

2. **Project structure** (grows organically per PRD principles)
   ```
   backend/
   ├── pyproject.toml      # Created by uv init
   ├── uv.lock             # Created by uv
   ├── src/
   │   └── rss_reader/
   │       ├── __init__.py
   │       ├── main.py         # FastAPI app entry point
   │       ├── models.py       # SQLModel definitions
   │       ├── database.py     # SQLite connection setup
   │       ├── feeds.py        # Feed fetching logic
   │       └── scheduler.py    # APScheduler setup
   └── tests/
       ├── conftest.py         # Fixtures: test DB, app instance
       └── test_api.py
   ```

---

#### Frontend Setup (`/frontend`)

1. **Initialize Next.js project with bun**
   ```bash
   bun create next-app frontend
   # Interactive prompts: TypeScript=Yes, ESLint=Yes, Tailwind=No, src/=Yes, App Router=Yes
   cd frontend
   bun add @chakra-ui/react @chakra-ui/next-js @emotion/react
   ```
   
   > Bun's `create` command scaffolds the project and installs dependencies automatically.

2. **Project structure** (Next.js App Router conventions)
   ```
   frontend/
   ├── package.json        # Created by create-next-app
   ├── bun.lockb           # Created by bun
   ├── src/
   │   └── app/
   │       ├── layout.tsx      # Root layout with Chakra provider
   │       ├── page.tsx        # Article list (home)
   │       ├── articles/
   │       │   └── [id]/
   │       │       └── page.tsx  # Article detail view
   │       └── providers.tsx   # Chakra UI provider wrapper
   └── next.config.js
   ```

---

### Phase 2: Backend Implementation

#### [NEW] [database.py](file:///Users/cstalhem/projects/rss-reader/backend/src/rss_reader/database.py)

SQLite setup with SQLModel:
- Create engine with `sqlite:///./data/rss.db`
- Use `connect_args={"check_same_thread": False}` for FastAPI async compatibility
- `create_db_and_tables()` function for initialization
- `get_session()` dependency generator for FastAPI endpoints

#### [NEW] [models.py](file:///Users/cstalhem/projects/rss-reader/backend/src/rss_reader/models.py)

SQLModel definitions matching PRD data model:
- `Feed` — id, url, title, last_fetched_at
- `Article` — id, feed_id, title, url, author, published_at, summary, content, is_read

#### [NEW] [feeds.py](file:///Users/cstalhem/projects/rss-reader/backend/src/rss_reader/feeds.py)

Feed fetching logic:
- `fetch_feed(url: str)` — Uses feedparser to fetch and parse RSS
- `save_articles(feed_id: int, entries: list)` — Deduplicates and stores articles
- Handles common RSS quirks (missing fields, date parsing)

#### [NEW] [scheduler.py](file:///Users/cstalhem/projects/rss-reader/backend/src/rss_reader/scheduler.py)

APScheduler integration:
- Background job to refresh feeds every 30 minutes
- Runs within FastAPI lifespan context
- Manual trigger endpoint for testing

#### [NEW] [main.py](file:///Users/cstalhem/projects/rss-reader/backend/src/rss_reader/main.py)

FastAPI application:
- **Endpoints:**
  - `GET /api/articles` — List articles (paginated, sorted by published_at desc)
  - `GET /api/articles/{id}` — Get single article with full content
  - `PATCH /api/articles/{id}` — Mark read/unread
  - `POST /api/feeds/refresh` — Manual refresh trigger
- Lifespan context for scheduler startup/shutdown
- CORS middleware for frontend (allow origin http://localhost:3210)

---

### Phase 3: Frontend Implementation

#### [NEW] [providers.tsx](file:///Users/cstalhem/projects/rss-reader/frontend/src/app/providers.tsx)

Chakra UI provider setup for Next.js App Router (client component).

#### [NEW] [layout.tsx](file:///Users/cstalhem/projects/rss-reader/frontend/src/app/layout.tsx)

Root layout wrapping app in Chakra provider.

#### [NEW] [page.tsx](file:///Users/cstalhem/projects/rss-reader/frontend/src/app/page.tsx)

Article list view:
- Fetch articles from `http://localhost:8912/api/articles`
- Display as Chakra UI card list
- Visual distinction for read/unread
- Click to navigate to detail

#### [NEW] [articles/[id]/page.tsx](file:///Users/cstalhem/projects/rss-reader/frontend/src/app/articles/[id]/page.tsx)

Article detail view:
- Fetch single article by ID
- Render full content (sanitized HTML)
- Mark as read button
- Back navigation

---

### Phase 4: Docker Setup

#### [NEW] [backend/Dockerfile](file:///Users/cstalhem/projects/rss-reader/backend/Dockerfile)

Multi-stage Dockerfile:
- Build stage with uv for dependency installation
- Runtime stage with Python slim image
- Uvicorn as the ASGI server on port 8912

#### [NEW] [frontend/Dockerfile](file:///Users/cstalhem/projects/rss-reader/frontend/Dockerfile)

Multi-stage Dockerfile:
- Build stage with bun for Next.js build
- Runtime stage for production server on port 3210

#### [NEW] [docker-compose.yml](file:///Users/cstalhem/projects/rss-reader/docker-compose.yml)

Services:
- `backend` — FastAPI on port 8912
- `frontend` — Next.js on port 3210
- Volume mount: `./data:/app/data` for SQLite persistence
- Environment variables for API URL

---

## Verification Plan

### Automated Tests (Backend)

Following PRD testing philosophy: **integration over unit tests**, using **real SQLite test databases** via fixtures.

```bash
cd backend
uv run pytest
```

#### Test Fixtures (`conftest.py`)
- `test_db` — Creates a fresh SQLite test database for each test
- `test_client` — FastAPI TestClient with httpx, using test database
- `sample_feed` — Inserts the hardcoded feed into the test DB
- `sample_articles` — Inserts a set of test articles

#### Integration Tests (`test_api.py`)

| Test | What it verifies |
|------|------------------|
| `test_list_articles_empty` | Empty DB returns empty list |
| `test_list_articles_with_data` | Articles returned sorted by published_at desc |
| `test_get_article_success` | Returns article by ID with full content |
| `test_get_article_not_found` | 404 for missing article |
| `test_mark_article_read` | PATCH toggles is_read, persists in DB |
| `test_refresh_feed` | POST triggers fetch, stores new articles in DB |

#### What We Skip (per PRD)
- Exhaustive unit tests for simple CRUD logic
- Mocking feedparser — use real network calls in integration tests or record fixtures
- UI snapshot testing

### Manual Verification

1. **Local development** (without Docker):
   ```bash
   # Terminal 1: Backend
   cd backend && uv run uvicorn rss_reader.main:app --reload --port 8912

   # Terminal 2: Frontend
   cd frontend && bun dev --port 3210
   ```
   - Open http://localhost:3210
   - Verify article list loads (may need to trigger refresh first)
   - Click article → detail view renders
   - Mark as read → visual state updates, persists on page refresh

2. **Docker Compose**:
   ```bash
   docker compose up --build
   ```
   - Same verification as above at http://localhost:3210
   - Check backend logs to confirm scheduler runs every 30 minutes
   - Verify `./data/rss.db` file is created and persists

3. **Edge cases**:
   - Fresh start (empty DB) → UI shows empty state gracefully
   - Network failure during feed fetch → error logged, app continues
   - Long article content → renders without layout issues
