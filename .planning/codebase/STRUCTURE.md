# Codebase Structure

**Analysis Date:** 2026-02-04

## Directory Layout

```
rss-reader/
├── backend/                    # Python FastAPI backend service
│   ├── src/
│   │   └── backend/            # Main application package
│   │       ├── __init__.py
│   │       ├── main.py         # FastAPI app, API endpoints, lifespan
│   │       ├── models.py       # SQLModel data definitions
│   │       ├── database.py     # SQLite engine, session management
│   │       ├── feeds.py        # RSS feed fetching and parsing
│   │       └── scheduler.py    # APScheduler background jobs
│   ├── tests/                  # Test suite
│   │   ├── conftest.py         # Pytest fixtures (test DB, client)
│   │   └── test_api.py         # API endpoint tests
│   ├── data/                   # Runtime data directory
│   │   └── rss.db             # SQLite database (generated at runtime)
│   ├── pyproject.toml          # Project metadata, dependencies, tool config
│   ├── uv.lock                 # Locked dependency versions
│   ├── .python-version         # Python version specification
│   └── README.md               # Backend documentation
│
├── frontend/                   # Next.js React frontend service
│   ├── src/
│   │   └── app/                # Next.js app directory
│   │       ├── layout.tsx      # Root layout with metadata
│   │       ├── page.tsx        # Home page component (placeholder)
│   │       ├── globals.css     # Global styles
│   │       ├── page.module.css # Page-specific styles
│   │       └── favicon.ico     # Browser icon
│   ├── public/                 # Static assets
│   ├── package.json            # Node dependencies, scripts
│   ├── next.config.ts          # Next.js configuration
│   ├── tsconfig.json           # TypeScript configuration
│   └── .eslintrc.json          # ESLint rules
│
├── spec/                       # Project specifications and requirements
│   ├── prd.md                  # Product requirements document
│   ├── llm_scoring_vision.md   # LLM scoring feature vision
│   ├── original_research.md    # Background research notes
│   └── milestone-1/            # Phase 1 milestones
│
├── data/                       # Shared data directory (empty)
├── .planning/                  # GSD planning documents
│   └── codebase/               # Architecture analysis outputs
├── .git/                       # Git repository
├── .gitignore                  # Git ignore rules
└── README.md                   # Project overview
```

## Directory Purposes

**`backend/src/backend/`:**
- Purpose: Main Python application package containing all business logic
- Contains: API routes, data models, database operations, feed processing, scheduling
- Key files: `main.py` (entry point), `models.py` (schema), `feeds.py` (core logic)

**`backend/tests/`:**
- Purpose: Pytest test suite for backend functionality
- Contains: Fixtures for test database and client, API endpoint tests
- Key files: `conftest.py` (setup), `test_api.py` (all test cases)

**`backend/data/`:**
- Purpose: Runtime data storage directory
- Contains: SQLite database file (created at startup)
- Key files: `rss.db` (auto-created, not committed to git)

**`frontend/src/app/`:**
- Purpose: Next.js application structure using App Router
- Contains: React components, layouts, styles
- Key files: `layout.tsx` (root layout), `page.tsx` (home page)

**`spec/`:**
- Purpose: Project specifications, requirements, and design documents
- Contains: PRD, feature specs, research notes, milestone definitions
- Key files: `prd.md` (main spec), milestone-specific documents

**`.planning/codebase/`:**
- Purpose: Generated codebase analysis documents for GSD system
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, etc.
- Key files: Auto-generated analysis documents (not committed)

## Key File Locations

**Entry Points:**

- `backend/src/backend/main.py`: FastAPI app initialization and route definitions. Run with `uvicorn backend.main:app --reload --port 8912`
- `frontend/src/app/layout.tsx`: Root layout component. Run with `npm run dev` (port 3210)
- `backend/pyproject.toml`: Backend project metadata; source of truth for dependencies
- `frontend/package.json`: Frontend project metadata; source of truth for dependencies

**Configuration:**

- `backend/pyproject.toml`: Python version (3.14), dependencies, ruff linting/formatting rules
- `frontend/package.json`: Node version, npm scripts, TypeScript/ESLint config
- `backend/.python-version`: Python version specification for environment managers
- `backend/src/backend/database.py`: SQLite connection string (hardcoded to `./data/rss.db`)

**Core Logic:**

- `backend/src/backend/models.py`: Feed and Article SQLModel definitions (database schema)
- `backend/src/backend/feeds.py`: RSS fetching, parsing, and article deduplication logic
- `backend/src/backend/scheduler.py`: APScheduler configuration for 30-minute refresh interval
- `backend/src/backend/database.py`: SQLite engine and session management

**Testing:**

- `backend/tests/conftest.py`: Pytest fixtures for test database, test client, sample data
- `backend/tests/test_api.py`: All API endpoint tests (13 test functions)

## Naming Conventions

**Files:**

- Python modules: `lowercase_with_underscores.py` (e.g., `main.py`, `feeds.py`, `database.py`)
- TypeScript/React: `PascalCase.tsx` for components (e.g., `layout.tsx`, `page.tsx`)
- CSS modules: `camelCase.module.css` (e.g., `page.module.css`)
- Test files: `test_*.py` for Python tests (pytest discovery pattern)

**Directories:**

- Python packages: `lowercase` with no underscores (e.g., `backend`, `src`, `tests`)
- Feature directories: Follow domain names (e.g., no current feature subdirs; flat structure)
- Data/Runtime: `lowercase` (e.g., `data`, `spec`)

**Functions/Methods:**

- Python: `lowercase_with_underscores` (e.g., `refresh_feed()`, `save_articles()`, `get_session()`)
- TypeScript: `camelCase` for functions and methods (e.g., `Home`, `RootLayout`)
- Async functions: No special prefix; use `async` keyword (e.g., `async def refresh_feed()`)

**Variables/Constants:**

- Python: `UPPER_CASE` for module-level constants (e.g., `HARDCODED_FEED_URL`, `DATABASE_URL`)
- Python: `lowercase_with_underscores` for instance/local variables
- TypeScript: `camelCase` for variables and props

**Types/Classes:**

- Python: `PascalCase` for class names (e.g., `Feed`, `Article`, `RefreshResponse`)
- TypeScript: `PascalCase` for component and type names (e.g., `Metadata`, `ReactNode`)
- Database tables: `lowercase` (plural, e.g., `feeds`, `articles`)

## Where to Add New Code

**New API Endpoint:**
- Primary code: `backend/src/backend/main.py` (add function decorated with `@app.get()`, `@app.post()`, etc.)
- Tests: `backend/tests/test_api.py` (add test function prefixed with `test_`)
- Models: `backend/src/backend/models.py` (if new data structure needed)
- Example: Endpoint for feed subscriptions would go in main.py lines 87+, tests in test_api.py after line 153

**New Feed Processing Feature:**
- Implementation: `backend/src/backend/feeds.py`
- Used by: Scheduler calls `refresh_feed()` which calls your new functions
- Example: LLM scoring would be a new function in feeds.py called during `save_articles()` (after line 90)

**New Scheduled Job:**
- Implementation: `backend/src/backend/scheduler.py` (add async function, register with `scheduler.add_job()`)
- Called from: `start_scheduler()` function (lines 35-47)
- Example: Weekly cleanup job would be async function defined in scheduler.py and registered in `start_scheduler()`

**New React Component:**
- Location: `frontend/src/app/[feature-name]/page.tsx` (create subdirectory for feature)
- Styles: `frontend/src/app/[feature-name]/page.module.css` (co-locate with component)
- Example: Article list page would be `frontend/src/app/articles/page.tsx`

**New Utility/Helper:**
- Backend: `backend/src/backend/[utility_name].py` (create new module at package level)
- Frontend: `frontend/src/lib/[utility_name].ts` (create lib directory if needed)
- Example: Date formatting helper would be `backend/src/backend/date_utils.py`

**Shared Constants:**
- Backend: `backend/src/backend/main.py` at module level (e.g., `HARDCODED_FEED_URL` at line 20)
- Frontend: `frontend/src/lib/constants.ts` (create if needed)

## Special Directories

**`backend/data/`:**
- Purpose: Runtime storage for SQLite database
- Generated: Yes (created by `os.makedirs("./data", exist_ok=True)` in main.py:29)
- Committed: No (in .gitignore)
- Contents: `rss.db` file created on first app startup

**`backend/.venv/`:**
- Purpose: Python virtual environment
- Generated: Yes (created by `uv sync` or `uv run`)
- Committed: No (in .gitignore)
- Contents: Python interpreter, packages, activation scripts

**`frontend/.next/`:**
- Purpose: Next.js build cache and generated types
- Generated: Yes (created by Next.js build system)
- Committed: No (in .gitignore)
- Contents: Compiled code, type definitions, build artifacts

**`backend/.ruff_cache/` and `backend/.pytest_cache/`:**
- Purpose: Tool caches for faster subsequent runs
- Generated: Yes (created by ruff and pytest)
- Committed: No (in .gitignore)
- Contents: Cached linting results, test discovery results

**`frontend/node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (created by `npm install`)
- Committed: No (in .gitignore)
- Contents: All transitive npm packages

---

*Structure analysis: 2026-02-04*
