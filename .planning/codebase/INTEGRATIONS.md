# External Integrations

**Analysis Date:** 2026-02-04

## APIs & External Services

**RSS Feed Fetching:**
- RSS/Atom feeds from arbitrary URLs via `feedparser` library
  - SDK/Client: `feedparser` 6.0.12+
  - HTTP Client: `httpx` 0.28.1+ (async HTTP requests with 30-second timeout)
  - Auth: None required for public feeds

**Hardcoded Feed (MVP):**
- Default feed: `https://simonwillison.net/atom/everything/` (Simon Willison's Weblog)
- Location: `HARDCODED_FEED_URL` in `/Users/cstalhem/projects/rss-reader/backend/src/backend/main.py`

## Data Storage

**Databases:**
- SQLite 3.x (local file-based)
  - Connection: `sqlite:///./data/rss.db`
  - Client: SQLModel (Pydantic + SQLAlchemy ORM)
  - Location: `DATABASE_URL` in `/Users/cstalhem/projects/rss-reader/backend/src/backend/database.py`

**File Storage:**
- Local filesystem only - SQLite database file stored in `./data/` directory
- No cloud storage integration (local-first design)

**Caching:**
- None - Articles deduplicated by URL in database (in-memory only during fetch)

## Authentication & Identity

**Auth Provider:**
- None - No authentication or authorization system implemented
- CORS allows any requests from `http://localhost:3210` (development frontend)
- No API key authentication required

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service

**Logs:**
- Python built-in `logging` module configured in `backend/src/backend/main.py`
  - Level: `logging.INFO`
  - Outputs to stdout/stderr
  - Includes: Feed refresh status, errors, startup/shutdown messages

## CI/CD & Deployment

**Hosting:**
- Not configured for production deployment
- Local development only (Flask/Uvicorn on localhost)

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other CI system configured

## Environment Configuration

**Required env vars:**
- None currently required for basic MVP operation
- All configuration is hardcoded or uses defaults:
  - Backend port: 8912 (hardcoded in development command)
  - Frontend port: 3210 (Next.js default alternative)
  - Database URL: `sqlite:///./data/rss.db`
  - Feed refresh interval: 30 minutes (hardcoded in `/Users/cstalhem/projects/rss-reader/backend/src/backend/scheduler.py`)
  - CORS origin: `http://localhost:3210` (hardcoded in `/Users/cstalhem/projects/rss-reader/backend/src/backend/main.py`)

**Secrets location:**
- No secrets required for MVP
- When adding external APIs (LLM, cloud storage), will need `.env` file handling

## Webhooks & Callbacks

**Incoming:**
- None - API is request-response only, no webhook support

**Outgoing:**
- None - No external services are notified of events

## Future Integrations (Planned, Not Implemented)

**LLM Service:**
- Ollama (local inference) - Planned for "LLM-powered relevance scoring" per README
- Status: Not yet integrated in current codebase
- When implemented: Will likely use HTTP client to `localhost:11434` (Ollama default)

**Feed Management:**
- Multiple feed support: Currently hardcoded to one feed, infrastructure supports expansion
- Feed subscription API: Not yet implemented

---

*Integration audit: 2026-02-04*
