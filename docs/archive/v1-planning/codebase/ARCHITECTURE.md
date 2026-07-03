# Architecture

**Analysis Date:** 2026-02-04

## Pattern Overview

**Overall:** Layered monolithic architecture with async background processing

**Key Characteristics:**
- Separate backend (Python/FastAPI) and frontend (Next.js) services
- Event-driven feed refreshing via background scheduler
- Local-first data persistence with SQLite
- Clean separation of concerns: HTTP API, data models, feed processing, and scheduling

## Layers

**API Layer:**
- Purpose: Handle HTTP requests and responses, provide REST endpoints for article and feed management
- Location: `src/backend/main.py`
- Contains: FastAPI application, route definitions, request/response models
- Depends on: Database layer, Feed processing layer
- Used by: Frontend (Next.js), manual refreshes, external API consumers

**Data Model Layer:**
- Purpose: Define data structures and database schema
- Location: `src/backend/models.py`
- Contains: SQLModel definitions for Feed and Article entities
- Depends on: SQLModel ORM
- Used by: All other layers for data access and manipulation

**Data Access Layer:**
- Purpose: Manage database connections and session lifecycle
- Location: `src/backend/database.py`
- Contains: SQLite engine creation, session management, database initialization
- Depends on: SQLModel
- Used by: API layer (via FastAPI dependency injection)

**Feed Processing Layer:**
- Purpose: Handle RSS feed fetching, parsing, and article persistence
- Location: `src/backend/feeds.py`
- Contains: Feed fetching logic, entry parsing, deduplication, date handling
- Depends on: feedparser, httpx, Data Model and Data Access layers
- Used by: Scheduler, API layer (manual refresh endpoint)

**Scheduling Layer:**
- Purpose: Coordinate automatic feed refreshing on a schedule
- Location: `src/backend/scheduler.py`
- Contains: APScheduler configuration and scheduled job definitions
- Depends on: Feed Processing layer, Data Access layer
- Used by: Application lifespan (startup/shutdown)

**Frontend Layer:**
- Purpose: User interface and client-side state management
- Location: `src/app/`
- Contains: Next.js page components, layouts, styles
- Depends on: Backend API (HTTP calls to localhost:8912)
- Used by: End users via browser

## Data Flow

**Feed Refresh (Scheduled):**

1. Scheduler wakes up every 30 minutes (configured in `src/backend/scheduler.py:37-44`)
2. `refresh_all_feeds()` (line 15) queries database for all Feed records
3. For each feed, calls `refresh_feed()` from feeds layer (line 28)
4. `refresh_feed()` calls `fetch_feed()` to retrieve RSS content via HTTP (async, line 115)
5. `fetch_feed()` parses XML with feedparser and returns parsed entries (line 45)
6. `save_articles()` deduplicates by URL and persists new articles (line 125)
7. Feed's `last_fetched_at` timestamp is updated (line 120)
8. Session committed, articles now queryable via API

**Article Access (HTTP):**

1. Frontend requests `/api/articles` with pagination (skip/limit)
2. API endpoint `list_articles()` (main.py:89-109) receives request
3. Database dependency injection provides Session
4. SQLModel query built with ORDER BY published_at DESC and offset/limit
5. Articles serialized to JSON and returned to client

**Article Status Update (HTTP):**

1. Frontend sends PATCH to `/api/articles/{id}` with is_read flag
2. API endpoint `update_article()` (main.py:126-143) receives request
3. Article fetched from database
4. is_read field updated and committed
5. Updated article returned to frontend

**Manual Feed Refresh (HTTP):**

1. Frontend requests POST `/api/feeds/refresh`
2. API endpoint `manual_refresh()` (main.py:146-171) receives request
3. All feeds fetched from database
4. Each feed processed through `refresh_feed()` (same as scheduled refresh)
5. Total new article count returned to client

**State Management:**

- **Persistent State:** All articles, feeds, and read status stored in SQLite database at `data/rss.db` (created on first startup by `create_db_and_tables()`, main.py:32)
- **Session State:** FastAPI dependency injection creates per-request database sessions (database.py:17-20)
- **Feed State:** Feed metadata (url, title, last_fetched_at) persists between API calls
- **No client-side state:** Frontend is stateless; all state lives in database

## Key Abstractions

**Feed:**
- Purpose: Represents an RSS feed subscription
- Examples: `src/backend/models.py:6-14`
- Pattern: SQLModel with unique constraint on URL to prevent duplicates
- Fields: id (PK), url (unique), title, last_fetched_at

**Article:**
- Purpose: Represents a single article from an RSS feed
- Examples: `src/backend/models.py:17-31`
- Pattern: SQLModel with composite indexing for query performance
- Fields: id (PK), feed_id (FK), title, url (unique), author, published_at (indexed), summary, content, is_read

**Session:**
- Purpose: Database transaction scope for ACID guarantees
- Examples: Created via `get_session()` dependency in `src/backend/database.py:17-20`
- Pattern: Context manager ensures proper cleanup
- Usage: FastAPI dependency injection passes session to every request handler

**RefreshResponse:**
- Purpose: Standardized response format for feed refresh operations
- Examples: `src/backend/main.py:82-84`
- Pattern: Pydantic BaseModel for request/response validation
- Fields: message (string description), new_articles (count)

## Entry Points

**Backend Application Entry:**
- Location: `src/backend/main.py:61-65`
- Triggers: `uvicorn backend.main:app --reload --port 8912`
- Responsibilities: Initialize FastAPI app with CORS middleware, set up lifespan hooks

**Application Startup:**
- Location: `src/backend/main.py:23-58` (lifespan context manager)
- Triggers: When FastAPI app starts
- Responsibilities: Create database/tables, seed hardcoded feed, start scheduler

**Application Shutdown:**
- Location: `src/backend/main.py:54-58` (lifespan yield/cleanup)
- Triggers: When FastAPI app terminates
- Responsibilities: Gracefully shutdown scheduler to prevent zombie jobs

**Frontend Entry:**
- Location: `src/app/layout.tsx`
- Triggers: `npm run dev` on port 3210
- Responsibilities: Root layout and metadata setup

## Error Handling

**Strategy:** Graceful degradation with logging and partial failure tolerance

**Patterns:**

- **Feed Fetch Errors:** Caught in `refresh_feed()` (feeds.py:129-131), logged but don't halt other feeds. Scheduler continues processing remaining feeds.
- **Malformed Feed Data:** feedparser.bozo flag checked (feeds.py:47-48) and logged as warning but doesn't prevent article save.
- **Missing Article Fields:** Fallbacks used (feeds.py:85, 89-90) — missing title defaults to "Untitled", missing content defaults to None.
- **Database Errors:** Caught implicitly by SQLModel/SQLAlchemy. 404s returned explicitly in API layer (main.py:121, 136).
- **HTTP Timeout:** httpx timeout set to 30 seconds (feeds.py:40), raises HTTPError caught by refresh_feed exception handler.

## Cross-Cutting Concerns

**Logging:**
- Framework: Python `logging` module
- Configuration: Basic setup in `src/backend/main.py:15-17` with INFO level
- Usage: All modules log significant operations (startup, feed refresh, errors)
- Files: `src/backend/main.py`, `src/backend/feeds.py`, `src/backend/scheduler.py`

**Validation:**
- Request body validation: Pydantic models in `src/backend/main.py:78-84`
- Database constraints: SQLModel Field definitions with unique/index constraints in `src/backend/models.py`
- Feed URL validation: feedparser handles malformed XML, httpx handles invalid URLs

**Authentication:**
- Current: None (local-first, no auth required)
- CORS: Hardcoded to allow localhost:3210 only (main.py:68-73)
- No JWT, OAuth, or token validation needed in MVP

---

*Architecture analysis: 2026-02-04*
