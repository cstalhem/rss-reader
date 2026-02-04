# Coding Conventions

**Analysis Date:** 2026-02-04

## Naming Patterns

**Files:**
- Python: Lowercase with underscores (`main.py`, `models.py`, `feeds.py`)
- TypeScript/React: Lowercase with underscores for components and utilities (`layout.tsx`, `page.tsx`)
- Configuration: Lowercase with dots (`next.config.ts`, `pyproject.toml`)

**Functions:**
- Python: snake_case for all functions (`refresh_feed`, `save_articles`, `get_session`, `_parse_published_date`)
- TypeScript: camelCase for arrow functions and declarations (`Home`, `RootLayout`)
- Private Python functions prefixed with underscore (`_parse_published_date`)

**Variables:**
- Python: snake_case (`article_id`, `new_count`, `feed_id`, `database_url`)
- TypeScript/React: camelCase (`geistSans`, `geistMono`, `styles`)

**Types/Classes:**
- Python: PascalCase for model classes (`Feed`, `Article`, `ArticleUpdate`, `RefreshResponse`)
- TypeScript: PascalCase for React components (`RootLayout`, `Home`)

**Constants:**
- Python: UPPERCASE with underscores (`HARDCODED_FEED_URL`, `DATABASE_URL`)

## Code Style

**Formatting:**
- Python: Line length 88 characters (enforced by Ruff)
- TypeScript: Standard Next.js formatting
- No explicit formatter configured for TypeScript/JavaScript beyond ESLint

**Linting:**
- Python: Ruff with strict configuration
  - Config file: `/Users/cstalhem/projects/rss-reader/backend/pyproject.toml`
  - Selection: E (errors), W (warnings), F (Pyflakes), I (isort), B (bugbear), C4 (comprehensions), UP (pyupgrade)
  - Ignores: E501 (line too long, handled by formatter), B008 (FastAPI Depends pattern)
- TypeScript: ESLint with Next.js config
  - Config file: `/Users/cstalhem/projects/rss-reader/frontend/eslint.config.mjs`
  - Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
  - Ignores Next.js build artifacts (`.next/**`, `out/**`, `build/**`)

## Import Organization

**Order (Python):**
1. Standard library imports (`logging`, `os`, `asyncio`, `datetime`)
2. Third-party imports (`fastapi`, `sqlmodel`, `httpx`, `feedparser`)
3. Local imports (`from backend.models import`, `from backend.database import`)

**Order (TypeScript):**
1. Next.js and React imports (`import type { Metadata }`, `import { Geist }`)
2. Other third-party imports
3. Local imports (usually CSS modules, `import styles from "./..."`
4. Relative path imports last

**Path Aliases:**
- TypeScript: `@/*` maps to `./src/*` (configured in `tsconfig.json`)

## Error Handling

**Patterns (Python):**
- Try-except blocks around external operations (feed fetching, database operations)
- Logger used for error reporting (`logger.error(f"Failed to refresh feed {feed.url}: {e}")`)
- HTTPException for API errors with appropriate status codes (404, 500)
- Graceful continuation on error (e.g., continue with other feeds if one fails)
- Example from `main.py`:
  ```python
  try:
      new_count = await refresh_feed(session, feed)
      total_new += new_count
  except Exception as e:
      logger.error(f"Failed to refresh feed {feed.url}: {e}")
      # Continue with other feeds
  ```

**Patterns (TypeScript):**
- No explicit error handling shown in limited codebase (scaffolding stage)

## Logging

**Framework:** Python `logging` module

**Patterns:**
- Logger created at module level: `logger = logging.getLogger(__name__)`
- Configured at startup: `logging.basicConfig(level=logging.INFO)` in `main.py`
- INFO level for normal operations (`logger.info("Scheduler started...")`)
- WARNING level for recoverable issues (`logger.warning(f"Entry missing link...")`)
- ERROR level for failures that need attention (`logger.error(f"Failed to refresh feed {feed.url}: {e}")`)
- Uses formatted strings with context: `f"Saved {new_count} new articles from feed {feed_id}"`

## Comments

**When to Comment:**
- Above complex logic that's not obvious from code (e.g., `_parse_published_date`)
- Before major sections/blocks (e.g., "# API Endpoints", "# Seed the hardcoded feed if it doesn't exist")
- For workarounds or special cases (e.g., `check_same_thread=False` comment in `database.py`)
- Not used for obvious code (`# Continue with other feeds` is actually present in error handler)

**JSDoc/TSDoc:**
- Used in Python with docstrings (triple quotes)
- Functions document Args, Returns, and Raises
- Example from `feeds.py`:
  ```python
  async def fetch_feed(url: str) -> feedparser.FeedParserDict:
      """
      Fetch and parse an RSS feed.

      Args:
          url: RSS feed URL

      Returns:
          Parsed feed dictionary from feedparser

      Raises:
          httpx.HTTPError: If the feed cannot be fetched
      """
  ```

## Function Design

**Size:** Functions are concise and focused
- `_parse_published_date`: 9 lines
- `save_articles`: 35 lines (includes loop)
- `refresh_feed`: 25 lines

**Parameters:**
- Use typed parameters with type hints
- Python: `session: Session`, `feed: Feed`, `url: str`
- Use FastAPI dependency injection for common parameters: `session: Session = Depends(get_session)`

**Return Values:**
- Explicit return type hints (`-> int`, `-> RefreshResponse`)
- Pydantic models for API responses (`RefreshResponse`)
- Returning SQLModel instances directly from API endpoints

## Module Design

**Exports:**
- Main entry point: `app = FastAPI(...)` in `main.py`
- Database dependency: `get_session()` from `database.py`
- Models: Classes exported from `models.py`
- Functions exported from `feeds.py` (`refresh_feed`, `save_articles`, `fetch_feed`)

**Barrel Files:**
- Not used in this codebase

**Module Structure Pattern:**
- Clear separation of concerns:
  - `models.py` - SQLModel definitions only
  - `database.py` - Database connection and session management
  - `feeds.py` - Feed fetching and processing logic
  - `scheduler.py` - Background job scheduling
  - `main.py` - FastAPI application and endpoints

---

*Convention analysis: 2026-02-04*
