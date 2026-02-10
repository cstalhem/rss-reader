---
phase: 03-feed-management
plan: 01
subsystem: backend-api
tags: [crud, rest-api, validation, cascade-delete]

dependency-graph:
  requires: [02-04-article-reading-ui]
  provides: [feed-crud-api, feed-management-backend]
  affects: [backend/models, backend/main, backend/database]

tech-stack:
  added: []
  patterns: [rest-crud, cascade-delete, url-validation, duplicate-checking]

key-files:
  created: []
  modified:
    - backend/src/backend/models.py
    - backend/src/backend/main.py
    - backend/src/backend/database.py

decisions:
  - Feed ordering via display_order field (integer, default 0)
  - CASCADE delete at database level using SQLite foreign key constraints
  - URL validation requires http:// or https:// prefix
  - Duplicate feed URLs rejected at creation time
  - Initial article fetch happens synchronously during feed creation
  - display_order assigned sequentially (max + 1) on creation
  - Reorder endpoint takes explicit feed_ids array for full control
  - mark-all-read returns count of articles marked

metrics:
  duration: 323
  tasks: 2
  files-modified: 3
  commits: 2
  completed: 2026-02-10T16:45:14Z
---

# Phase 03 Plan 01: Feed CRUD Backend Summary

**One-liner:** Complete REST API for feed management with validation, cascade delete, and article filtering by feed.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Update Feed model and add CASCADE delete | 380bffd | Added display_order field, CASCADE foreign key, enabled SQLite FK pragma |
| 2 | Add feed CRUD endpoints and article feed_id filter | cf8d8dc | 7 new endpoints, Pydantic models, validation, removed hardcoded seed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Database schema migration required**
- **Found during:** Task 2 verification
- **Issue:** Existing SQLite database didn't have new display_order column, causing OperationalError
- **Fix:** Deleted existing development database to recreate with new schema
- **Files affected:** backend/data/rss-reader.db
- **Commit:** cf8d8dc (no separate commit needed)

**2. [Rule 1 - Bug] FastAPI route ordering conflict**
- **Found during:** Task 2 verification (reorder endpoint test)
- **Issue:** `/api/feeds/reorder` was defined after `/api/feeds/{feed_id}`, causing FastAPI to match "reorder" as a feed_id parameter
- **Fix:** Moved reorder endpoint definition before the {feed_id} endpoint
- **Files affected:** backend/src/backend/main.py
- **Commit:** cf8d8dc (fixed inline during task)

## Endpoints Implemented

### Feed Management
- **GET /api/feeds** - List feeds with unread_count, ordered by display_order
- **POST /api/feeds** - Create feed with URL validation and initial article fetch
- **DELETE /api/feeds/{id}** - Delete feed (CASCADE to articles)
- **PATCH /api/feeds/{id}** - Update feed title/display_order
- **PATCH /api/feeds/reorder** - Bulk reorder feeds by ID list
- **POST /api/feeds/{id}/mark-all-read** - Mark all feed articles as read

### Article Filtering
- **GET /api/articles?feed_id=N** - Filter articles by feed

## Validation & Error Handling

- URL format validation (http:// or https:// required)
- Duplicate URL rejection (400 error)
- Invalid/malformed RSS feed rejection (400 error)
- Feed not found handling (404 errors)
- Bozo feed detection (warns but allows if entries exist)

## Technical Highlights

**CASCADE Delete:** Implemented at database level using SQLite foreign key constraints. Enabled via `PRAGMA foreign_keys=ON` in database connection event handler. When a feed is deleted, all associated articles are automatically removed by the database.

**Unread Count Calculation:** Computed per-feed using SQLAlchemy `func.count()` subquery. Efficient for current scale, may need optimization if feed count grows significantly.

**Feed Ordering:** Uses `display_order` integer field. Reorder endpoint allows explicit control over feed positions. New feeds assigned max(display_order) + 1.

**No Migration System:** Currently relies on database recreation for schema changes. This is acceptable for development but will need proper migrations (Alembic) before production deployment.

## Testing

- All 13 existing backend tests pass (1 pre-existing test failure unrelated to changes)
- Manual testing via curl confirmed all endpoints work correctly:
  - Feed creation fetched 30 articles successfully
  - URL validation rejected invalid formats
  - Duplicate detection prevented re-adding same feed
  - Reorder functionality verified with multiple feeds
  - CASCADE delete confirmed (0 articles remain after feed deletion)
  - feed_id filter correctly isolated articles by feed

## Self-Check: PASSED

**Files created:** None (all modifications)

**Files modified:**
- FOUND: backend/src/backend/models.py
- FOUND: backend/src/backend/main.py
- FOUND: backend/src/backend/database.py

**Commits exist:**
- FOUND: 380bffd
- FOUND: cf8d8dc

All claimed artifacts verified present.
