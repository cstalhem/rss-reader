# RSS Reader

A personal RSS reader with LLM-powered content curation. Surfaces interesting articles, hides noise, and discovers unexpected treasures — all scored locally by [Ollama](https://ollama.com).

## Quick Links

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Development](#development)
- [Architecture](#architecture)

---

## Features

- **LLM-Powered Scoring** — Articles are automatically scored by interest and quality using a local Ollama model
- **Smart Categorization** — Auto-generated topic tags with configurable weights (blocked, low, neutral, medium, high)
- **Score-Based Sorting** — Sort by relevance, date, or score with high-interest articles surfaced first
- **Filter Tabs** — Unread, All, Scoring (in-progress), and Blocked views
- **Feed Management** — Add, remove, rename, and reorder RSS feed subscriptions
- **Reading Experience** — Clean reader drawer with auto-mark-as-read, keyboard navigation, and Lora serif typography
- **Dark Theme** — Dark-mode-first design with orange accent color
- **Docker Deployment** — Production-ready Docker Compose with Traefik reverse proxy support
- **Fully Local** — No external APIs, no tracking. SQLite database, Ollama LLM, runs on your hardware

---

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An [Ollama](https://ollama.com) instance (included in compose, or external)

### Deploy with Docker Compose

1. Clone the repository:

   ```bash
   git clone https://github.com/cstalhem/rss-reader.git
   cd rss-reader
   ```

2. Create a `.env` file (can be empty, used for overrides):

   ```bash
   touch .env
   ```

3. Pull the model on the Ollama instance:

   ```bash
   docker compose -f docker-compose.prod.yml up -d ollama
   docker exec rss-reader-ollama ollama pull qwen3:8b
   ```

4. Start all services:

   ```bash
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```

The frontend is available at port `3000` and the backend API at port `8000`. If using a reverse proxy, see [Reverse Proxy](#reverse-proxy) below.

### Update

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## Configuration

Configuration is loaded with the following priority (highest to lowest):

1. Environment variables (e.g., `OLLAMA__HOST`)
2. `.env` file
3. YAML config file (`config/app.yaml`)
4. Default values

### Config File

The YAML config file is mounted at `/config/app.yaml` inside the container:

```yaml
database:
  path: /data/rss-reader.db

logging:
  level: INFO
  format: plain

scheduler:
  feed_refresh_interval: 1800  # seconds (30 minutes)
  log_job_execution: false

ollama:
  host: http://localhost:11434
  categorization_model: qwen3:8b
  scoring_model: qwen3:8b
  timeout: 120.0
```

### Environment Variables

Environment variables use double-underscore notation for nested config:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE__PATH` | SQLite database path | `./data/rss-reader.db` |
| `OLLAMA__HOST` | Ollama API URL | `http://localhost:11434` |
| `OLLAMA__CATEGORIZATION_MODEL` | Model for topic tagging | `qwen3:8b` |
| `OLLAMA__SCORING_MODEL` | Model for interest scoring | `qwen3:8b` |
| `OLLAMA__TIMEOUT` | LLM request timeout (seconds) | `120.0` |
| `SCHEDULER__FEED_REFRESH_INTERVAL` | Feed poll interval (seconds) | `1800` |
| `CONFIG_FILE` | Path to YAML config file | *(none)* |

### Reverse Proxy

The production compose file (`docker-compose.prod.yml`) includes [Traefik](https://traefik.io) labels. Adjust the hostname in the labels to match your domain:

```yaml
traefik.http.routers.rss-reader-frontend.rule: Host(`rss-reader.your-domain.example`)
traefik.http.routers.rss-reader-backend.rule: Host(`rss-reader.your-domain.example`) && PathPrefix(`/api`)
```

The frontend Docker image is built with relative API URLs, so all `/api/*` requests from the browser are routed to the backend by the reverse proxy.

For development or direct access without a reverse proxy, use the standard `docker-compose.yml` which exposes ports directly.

---

## Development

### Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Bun](https://bun.sh) (JavaScript runtime)
- [Ollama](https://ollama.com) running locally

### Backend

```bash
cd backend
uv run uvicorn backend.main:app --reload --port 8912
```

Other commands:

```bash
uv run pytest                # Run tests
uv run ruff check .          # Lint
uv run ruff format .         # Format
```

API docs are available at `http://localhost:8912/docs` when the backend is running.

### Frontend

```bash
cd frontend
bun install
bun dev --port 3210
```

Other commands:

```bash
bun run lint                 # ESLint
bun run build                # Production build
```

The frontend connects to the backend at `http://localhost:8912` by default (configured via `NEXT_PUBLIC_API_URL`).

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend    │────▶│   Ollama    │
│  Next.js    │     │   FastAPI    │     │   LLM       │
│  Chakra UI  │     │   SQLModel   │     │             │
│  Port 3210  │     │   Port 8912  │     │  Port 11434 │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │   SQLite     │
                    │   + WAL mode │
                    └──────────────┘
```

### Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | FastAPI + SQLModel (Python) |
| Frontend | Next.js App Router + Chakra UI v3 |
| Database | SQLite with WAL mode |
| LLM | Ollama (local inference) |
| Feed Parsing | feedparser |
| Scheduling | APScheduler |
| Data Fetching | TanStack Query |

### How Scoring Works

1. **Feed refresh** — APScheduler polls feeds every 30 minutes, saving new articles
2. **Categorization** — LLM assigns up to 4 topic categories per article (English only)
3. **Weight check** — If all categories are weighted "blocked", the article is blocked (score 0)
4. **Scoring** — LLM evaluates interest (0-10) and quality (0-10) based on user-written preferences
5. **Composite score** — `interest * category_weight * quality_multiplier` (capped at 20.0)
6. **Display** — Articles appear in the Unread tab sorted by score, with badges and color coding

### Project Structure

```
rss-reader/
├── backend/
│   ├── src/backend/       # FastAPI app (main, models, config, feeds, scoring)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # UI components (layout, article, settings)
│   │   ├── hooks/         # React hooks (useArticles, useFeeds, etc.)
│   │   ├── lib/           # API client, types, utilities
│   │   └── theme/         # Chakra UI theme (colors, typography)
│   └── Dockerfile
├── config/
│   └── app.yaml           # Production configuration
├── docker-compose.yml      # Development (local build)
├── docker-compose.prod.yml # Production (GHCR images + Traefik)
└── spec/                   # Product requirements and milestone plans
```

---

## License

Personal project. Not currently licensed for redistribution.
