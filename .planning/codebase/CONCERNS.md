# Codebase Concerns

**Analysis Date:** 2026-02-04

## Tech Debt

**Hardcoded Feed URL (MVP Limitation):**
- Issue: Single feed hardcoded in backend startup; not user-configurable
- Files: `backend/src/backend/main.py` (lines 19-50)
- Impact: Cannot add multiple feeds; application serves only Simon Willison's weblog; not usable for multiple RSS sources
- Fix approach: Implement feed management API endpoints to create/update/delete feeds; replace hardcoded seeding with proper feed subscription mechanism

**Incomplete Frontend Implementation:**
- Issue: Frontend contains only boilerplate Next.js template code with no actual RSS reader UI
- Files: `frontend/src/app/page.tsx`, `frontend/src/app/layout.tsx`
- Impact: Frontend cannot display articles or interact with backend API; requires complete UI implementation to be functional
- Fix approach: Implement article listing component, feed management UI, article detail view, and read status toggling

**No Environment Configuration:**
- Issue: Hardcoded port (8912), CORS origin (localhost:3210), and database path (./data/rss.db); no env var support
- Files: `backend/src/backend/main.py` (line 70), `backend/src/backend/database.py` (line 3)
- Impact: Cannot deploy to production; difficult to test different configurations; credentials cannot be isolated
- Fix approach: Use python-dotenv or pydantic Settings for environment-based configuration

## Security Considerations

**Overly Permissive CORS:**
- Risk: CORS allows all methods and headers (`allow_methods=["*"]`, `allow_headers=["*"]`)
- Files: `backend/src/backend/main.py` (lines 68-74)
- Current mitigation: Origins restricted to localhost:3210, but method/header restriction should be applied
- Recommendations: Specify exact allowed methods (GET, PATCH, POST) and required headers explicitly

**No Input Validation on Article Updates:**
- Risk: While `ArticleUpdate` uses Pydantic, there's no validation that prevents unexpected boolean mutations or null checks
- Files: `backend/src/backend/main.py` (lines 78-79, 126-143)
- Current mitigation: FastAPI/Pydantic provides basic type safety
- Recommendations: Add explicit validators for edge cases; consider rate limiting on PATCH endpoints

**Feed URL Not Validated:**
- Risk: `Feed.url` is a string without URL format validation or scheme verification
- Files: `backend/src/backend/models.py` (line 12)
- Current mitigation: httpx will fail at fetch time if invalid, but malformed URLs stored in DB
- Recommendations: Add Pydantic `HttpUrl` type or custom validator; reject non-HTTP(S) schemes

**Database File Permissions:**
- Risk: SQLite database file in `./data/rss.db` has default umask; no explicit permission hardening
- Files: `backend/src/backend/database.py` (line 3), `backend/src/backend/main.py` (line 29)
- Current mitigation: Local-first design; file is not world-readable by default on Unix
- Recommendations: Explicitly set file permissions to 0600 after creation; document data directory security

## Performance Bottlenecks

**N+1 Query on Manual Feed Refresh:**
- Problem: Manual refresh endpoint loops through feeds sequentially, making individual refresh_feed calls
- Files: `backend/src/backend/main.py` (lines 146-171)
- Cause: Single-threaded refresh loop; each feed refresh waits for network I/O
- Improvement path: Implement concurrent feed refreshing using `asyncio.gather()` or thread pool; add timeout handling

**Synchronous Session Commits in Loop:**
- Problem: `save_articles()` commits once per feed after iterating all entries; if feed has 1000 articles, all inserted before commit
- Files: `backend/src/backend/feeds.py` (lines 53-100)
- Cause: Single commit at end of loop; all articles held in memory before flush
- Improvement path: Batch commits every N articles (e.g., 100) to reduce memory footprint; use bulk insert patterns

**No Pagination Limit Enforcement:**
- Problem: Listing articles uses default limit of 50 but has no maximum; client could request `?limit=1000000`
- Files: `backend/src/backend/main.py` (lines 89-109)
- Cause: No validation on limit parameter bounds
- Improvement path: Add max limit validation; enforce reasonable defaults (e.g., 1-1000 range)

**Scheduler Blocks on Network I/O:**
- Problem: Scheduled job `refresh_all_feeds()` refreshes feeds sequentially every 30 minutes; blocks event loop
- Files: `backend/src/backend/scheduler.py` (lines 15-32)
- Cause: Sync-style loop in async function; no timeout protection
- Improvement path: Use `asyncio.gather()` with timeout; implement per-feed timeout; add job result logging

## Fragile Areas

**Feed Parsing Robustness:**
- Files: `backend/src/backend/feeds.py` (lines 14-50)
- Why fragile: feedparser.bozo flag logged but not enforced; malformed feeds still saved; exception handling is loose
- Safe modification: Add explicit feed validation; reject feeds where parsing fails >80% of entries; add schema validation
- Test coverage: Only basic fetch/parse tested; no malformed feed tests, no timeout tests, no redirect handling

**Date Parsing Fallback Logic:**
- Files: `backend/src/backend/feeds.py` (lines 14-24)
- Why fragile: Tries published_parsed first, then updated_parsed; if both fail, returns None; datetime construction from time_struct[[:6]] could fail on edge cases (e.g., 29 Feb on non-leap years)
- Safe modification: Add explicit bounds checking; use `datetime.fromtimestamp()` instead of unpacking struct; log parse failures with raw value
- Test coverage: No tests for malformed dates, edge case dates, or missing date fields

**Content Extraction from Complex Feeds:**
- Files: `backend/src/backend/feeds.py` (line 90)
- Why fragile: Extracts first content item with `entry.get("content", [{}])[0].get("value")` — if content exists but is empty list, accesses invalid index
- Safe modification: Add explicit length check; use safer indexing; handle content types (text vs HTML)
- Test coverage: Not tested with feeds that have empty content arrays or unusual content structures

**No Duplicate Detection Strategy:**
- Files: `backend/src/backend/feeds.py` (lines 74-80)
- Why fragile: Deduplication by URL only; if feed updates article HTML content at same URL, old content never updated
- Safe modification: Add content hash field; implement update logic for existing URLs; add update_at timestamp
- Test coverage: No tests for feed updates; no tests for same URL with different content

## Scaling Limits

**SQLite Database Limitations:**
- Current capacity: SQLite can handle ~100K-1M articles reasonably on consumer hardware
- Limit: Concurrent write contention; single-threaded write queue causes slowdowns at ~10M articles
- Scaling path: Migrate to PostgreSQL; implement connection pooling; add read replicas for search queries

**No Pagination Cursor Offset Scalability:**
- Current capacity: Offset-based pagination works fine for <100K articles
- Limit: `OFFSET 50000` becomes slow; full scan required for each page
- Scaling path: Implement cursor-based (keyset) pagination using `published_at` + `id`; cache article count

**Scheduler Single-Feed Processing:**
- Current capacity: ~20-50 feeds refreshable in 30-minute window (assumes 30s per feed with network/parsing)
- Limit: 30-minute refresh interval becomes inadequate >100 feeds
- Scaling path: Implement incremental scheduler; stagger feed refreshes; use queue-based model; add priority scoring

**Memory Unbounded in Feed Refresh:**
- Current capacity: ~10K articles per refresh without issue on typical machines
- Limit: Entire article list built in memory before DB commit; large feeds (100K+ entries) risk OOM
- Scaling path: Batch processing; streaming parser; implement chunked commits

## Test Coverage Gaps

**No Error Handling Tests for Feed Fetch:**
- What's not tested: Network timeouts, invalid URLs, 5xx errors, redirects, SSL errors, malformed content-type
- Files: `backend/src/backend/feeds.py` (lines 27-50)
- Risk: Feed fetch failures silently fail with generic Exception; unhandled timeout would crash scheduler
- Priority: High — feed fetching is critical path

**No Tests for Date Parsing Edge Cases:**
- What's not tested: Missing dates, malformed dates, future dates, epoch dates (1970), leap year edge cases
- Files: `backend/src/backend/feeds.py` (lines 14-24)
- Risk: Articles with unparseable dates stored with NULL published_at; sorting/filtering breaks silently
- Priority: Medium — affects article ordering

**No Content Extraction Tests:**
- What's not tested: Feeds without content field, empty content arrays, HTML/text content variants, missing summary
- Files: `backend/src/backend/feeds.py` (lines 83-92)
- Risk: Unexpected None values in article.content cause API responses to vary; UI assumptions break
- Priority: Medium — affects data consistency

**No Concurrency Tests:**
- What's not tested: Simultaneous article updates, race conditions in refresh during update, database locks
- Files: `backend/src/backend/scheduler.py`, `backend/src/backend/main.py` (manual refresh)
- Risk: Data corruption if refresh and update overlap; test environment doesn't catch this
- Priority: High — production must handle concurrent access

**Feed Refresh Endpoint Not Properly Mocked:**
- What's not tested: Real network calls in `test_refresh_feed()` (line 132-142); test flaky if network unavailable
- Files: `backend/tests/test_api.py` (lines 131-142)
- Risk: Test passes/fails based on external Simon Willison's weblog availability
- Priority: High — breaks CI/CD reliability

**No Frontend Tests:**
- What's not tested: All frontend functionality; component renders; API integration; error states
- Files: `frontend/src/app/` (entire directory)
- Risk: UI bugs not caught; no regression testing; breaking changes to API go unnoticed
- Priority: Critical — no test coverage for frontend layer

## Missing Critical Features

**No Feed Management UI:**
- Problem: Cannot add, remove, or manage feeds from UI; hardcoded to one feed
- Blocks: Multi-feed usage; cannot achieve core product goal

**No Article Search:**
- Problem: README lists "Full-Text Search" as core feature but not implemented
- Blocks: Finding specific articles; querying by content

**No LLM Integration:**
- Problem: README lists "LLM Relevance Scoring" and "Smart Filtering" using Ollama but completely absent
- Blocks: Relevance scoring; article labeling; filtering by interest

**No Feed Grouping/Organization:**
- Problem: README mentions "Subscribe to RSS feeds and organize them into groups" but data model has no groups
- Blocks: Feed organization; grouped display

**No Persistent Read State in Frontend:**
- Problem: Frontend doesn't fetch/display articles; marking read works in API but UI never implemented
- Blocks: Reading experience; progress tracking

## Dependencies at Risk

**feedparser Handling Malformed Feeds:**
- Risk: feedparser gracefully handles malformed RSS/Atom but sets bozo flag; we log but don't reject
- Impact: Bad feeds corrupt database with incomplete/invalid data; downstream sorting/display breaks
- Migration plan: Add feed validation layer before save; consider feedparser alternatives if parsing becomes issue; implement feed health scoring

**No Explicit Error Type Handling:**
- Risk: Bare `except Exception` catches all errors including KeyboardInterrupt, SystemExit
- Impact: Unclean shutdown; missing error context in logs
- Migration plan: Use specific exception catching; add structured error logging; distinguish user errors from system errors

---

*Concerns audit: 2026-02-04*
