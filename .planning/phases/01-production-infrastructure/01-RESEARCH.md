# Phase 1: Production Infrastructure - Research

**Researched:** 2026-02-05
**Domain:** Docker Compose production deployment, Python/Next.js containerization
**Confidence:** HIGH

## Summary

Phase 1 establishes production-ready Docker infrastructure for a FastAPI backend and Next.js frontend with SQLite persistence. The standard approach uses multi-stage Docker builds with health checks, named volumes for database persistence, and Docker Compose orchestration with proper service dependencies.

Key findings:
- **FastAPI + uvicorn**: Single process per container (no workers) is recommended for simplicity and future scalability
- **Next.js standalone mode**: Dramatically reduces image size by bundling only required dependencies
- **SQLite WAL mode**: Enables concurrent readers with single writer, configured via `PRAGMA journal_mode=WAL`
- **Docker Compose health checks**: Use `depends_on` with `service_healthy` condition to enforce startup ordering
- **Configuration management**: Pydantic Settings with YAML + environment variable overrides provides type-safe configuration
- **Docker volumes**: Named volumes for database, bind mounts for config files (separate concerns)

**Primary recommendation:** Use multi-stage builds with uv for backend, Next.js standalone for frontend, SQLite WAL mode with named volumes, and Pydantic Settings for configuration. Deploy as single-process containers with health-check-based dependencies.

## Standard Stack

### Core

| Library/Tool | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| Docker Compose | v2.x | Service orchestration | Industry standard for multi-container apps, built into Docker Desktop |
| Python (slim) | 3.14 | Backend runtime | Slim variant balances size vs functionality, matches project requirement |
| Node.js (alpine) | 22.x LTS | Frontend runtime | Alpine provides minimal image size for Next.js production |
| uv | 0.9.x | Python package manager | 10-100x faster than pip, official Docker integration, excellent layer caching |
| SQLite | 3.x | Database | Bundled with Python, WAL mode enables production concurrency |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pydantic Settings | 2.x | Configuration management | Type-safe config with env override, FastAPI integration |
| python-dotenv | 1.x | .env file loading | Development secrets, gitignored credentials |
| curl | bundled | Health check utility | HTTP endpoint checking in Docker HEALTHCHECK |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single process per container | Multiple uvicorn workers | Workers complicate scaling, Kubernetes/Compose prefer container replication |
| Named volumes | Bind mounts | Bind mounts expose host paths, harder to backup, less portable |
| uv | pip/poetry | uv is 10-100x faster, better Docker caching, official Astral support |
| Pydantic Settings | python-decouple/dynaconf | Pydantic integrates with FastAPI, provides validation, type safety |

**Installation:**
```bash
# Backend (handled by uv in Docker)
uv add pydantic-settings python-dotenv

# No manual installation needed - Docker handles runtime
```

## Architecture Patterns

### Recommended Project Structure

```
.
├── docker-compose.yml           # Service orchestration
├── backend/
│   ├── Dockerfile              # Multi-stage build with uv
│   ├── pyproject.toml          # Dependencies + config
│   ├── uv.lock                 # Locked dependencies
│   ├── src/
│   │   ├── config.py           # Pydantic Settings
│   │   ├── main.py             # FastAPI app with /health
│   │   └── database.py         # SQLite + WAL mode setup
│   └── .dockerignore           # Exclude .venv, __pycache__
├── frontend/
│   ├── Dockerfile              # Multi-stage with standalone
│   ├── next.config.ts          # output: 'standalone'
│   ├── package.json
│   └── .dockerignore           # Exclude node_modules, .next
├── config/
│   └── app.yaml                # Optional runtime config (bind mount)
└── .env.example                # Template for secrets
```

### Pattern 1: Multi-Stage Docker Build (Backend)

**What:** Separate build and runtime stages to minimize final image size and leverage layer caching

**When to use:** Always for production Python apps with compiled dependencies

**Example:**
```dockerfile
# Source: https://docs.astral.sh/uv/guides/integration/docker/
FROM python:3.14-slim AS builder

# Install uv from official distroless image
COPY --from=ghcr.io/astral-sh/uv:0.9.30 /uv /uvx /bin/

WORKDIR /app

# Copy dependency files first (cache layer)
COPY pyproject.toml uv.lock ./

# Install dependencies only (not project) - CRITICAL for caching
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-dev

# Copy application code
COPY . .

# Install project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

# Runtime stage - slim image with only .venv
FROM python:3.14-slim

WORKDIR /app

# Copy only the virtual environment
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY --from=builder /app/src /app/src

# Activate venv by modifying PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Exec form for proper signal handling
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Pattern 2: Next.js Standalone Build (Frontend)

**What:** Use Next.js standalone output mode to create minimal production bundle

**When to use:** Always for self-hosted Next.js in Docker

**Example:**
```dockerfile
# Source: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Copy standalone build (includes minimal node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
```

**next.config.ts:**
```typescript
// Source: https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',  // Critical for Docker optimization
}

export default nextConfig
```

### Pattern 3: Docker Compose Service Dependencies with Health Checks

**What:** Use `depends_on` with `service_healthy` to ensure backend is ready before frontend starts

**When to use:** Always when services have initialization dependencies

**Example:**
```yaml
# Source: https://docs.docker.com/compose/how-tos/startup-order/
services:
  backend:
    build: ./backend
    restart: unless-stopped
    volumes:
      - db-data:/data
      - ./config:/config:ro  # Read-only config bind mount
    environment:
      - CONFIG_FILE=/config/app.yaml
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy  # Wait for backend health check
        restart: true              # Auto-restart if backend restarts
    ports:
      - "3000:3000"

volumes:
  db-data:  # Named volume for SQLite persistence
    driver: local
```

### Pattern 4: SQLite WAL Mode Configuration

**What:** Enable Write-Ahead Logging for concurrent read/write access

**When to use:** Always for production SQLite with concurrent access

**Example:**
```python
# Source: https://sqlite.org/wal.html
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event

# Database configuration
DATABASE_PATH = "/data/rss-reader.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Create engine (check_same_thread=False for FastAPI async)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False  # Set to True for SQL debugging
)

# Enable WAL mode on every connection
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")  # Performance optimization
    cursor.execute("PRAGMA cache_size=-64000")   # 64MB cache
    cursor.execute("PRAGMA temp_store=MEMORY")   # Temp tables in RAM
    cursor.close()

# Create tables
SQLModel.metadata.create_all(engine)

# Dependency for FastAPI
def get_session():
    with Session(engine) as session:
        yield session
```

### Pattern 5: Pydantic Settings with YAML + Environment Overrides

**What:** Type-safe configuration with YAML defaults and environment variable overrides

**When to use:** All Python applications requiring configuration management

**Example:**
```python
# Source: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict, YamlConfigSettingsSource
from typing import Tuple

class DatabaseConfig(BaseModel):
    path: str = "/data/rss-reader.db"

class LoggingConfig(BaseModel):
    level: str = "INFO"
    format: str = "json"  # or "plain"

class SchedulerConfig(BaseModel):
    feed_refresh_interval: int = 3600  # seconds
    log_job_execution: bool = False

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        env_nested_delimiter='__',  # DATABASE__PATH
        case_sensitive=False,
        extra='ignore'
    )

    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    scheduler: SchedulerConfig = Field(default_factory=SchedulerConfig)

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ) -> Tuple:
        # Priority: env vars > .env > YAML > defaults
        yaml_file = os.getenv('CONFIG_FILE', '/config/app.yaml')
        yaml_settings = None
        if os.path.exists(yaml_file):
            yaml_settings = YamlConfigSettingsSource(settings_cls, yaml_file)

        return (env_settings, dotenv_settings, yaml_settings, init_settings)

# FastAPI integration with caching
from functools import lru_cache

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

**config/app.yaml (optional):**
```yaml
# Non-sensitive defaults - can be committed to git
database:
  path: /data/rss-reader.db

logging:
  level: INFO
  format: json

scheduler:
  feed_refresh_interval: 3600
  log_job_execution: false
```

**Environment override example:**
```bash
# .env file (gitignored for secrets)
DATABASE__PATH=/custom/path/db.sqlite
LOGGING__LEVEL=DEBUG
SCHEDULER__LOG_JOB_EXECUTION=true
```

### Pattern 6: Structured JSON Logging for Docker

**What:** Output JSON logs to stdout for Docker log driver parsing

**When to use:** Production containers where logs are aggregated

**Example:**
```python
# Source: https://www.loggly.com/ultimate-guide/centralizing-python-logs/
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        # Add extra fields
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id

        return json.dumps(log_record)

# Configure logging
def setup_logging(level: str, format_type: str):
    handler = logging.StreamHandler()

    if format_type == "json":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )

    logging.basicConfig(
        level=getattr(logging, level.upper()),
        handlers=[handler]
    )

    # APScheduler logging
    logging.getLogger('apscheduler').setLevel(getattr(logging, level.upper()))

# In main.py
settings = get_settings()
setup_logging(settings.logging.level, settings.logging.format)
```

### Anti-Patterns to Avoid

- **Using bind mounts for SQLite database**: Named volumes provide better portability and backup integration
- **Running multiple uvicorn workers in container**: Breaks signal handling, complicates scaling - use container replication instead
- **Copying entire source before installing dependencies**: Invalidates Docker cache on every code change
- **Using shell form CMD** (`CMD python main.py`): Prevents proper SIGTERM handling, use exec form instead
- **Not setting PYTHONUNBUFFERED=1**: Logs get buffered and don't appear in `docker logs` in real-time
- **Omitting health checks**: Services may appear running but not accepting traffic, causes cascading failures
- **Using `depends_on` without condition**: Services start before dependencies are ready, causing connection errors

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Configuration management | Custom YAML parser + env vars | Pydantic Settings | Type validation, nested models, dotenv support, FastAPI integration |
| Docker health checks | Custom TCP socket checking | curl/wget with /health endpoint | Standard HTTP semantics, testable, documented status codes |
| SQLite connection pooling | Custom connection manager | SQLAlchemy/SQLModel connection pool | Thread-safe, connection lifecycle, event hooks for WAL mode |
| Graceful shutdown | Custom signal handlers | Uvicorn's built-in shutdown | Handles lifespan events, cleanup tasks, connection draining |
| Log formatting | String concatenation | JSON logging formatter | Structured logs, machine-parseable, aggregation-ready |
| Multi-stage builds | Single-stage with manual cleanup | Docker multi-stage pattern | Automatic layer optimization, reproducible, standard pattern |

**Key insight:** Docker and Python ecosystems have mature solutions for infrastructure concerns. Custom implementations miss edge cases (signal handling, file locking, connection pooling) that standard tools handle correctly.

## Common Pitfalls

### Pitfall 1: SQLite Database Locked Errors

**What goes wrong:** Multiple processes or threads get "database is locked" errors when accessing SQLite

**Why it happens:** Default SQLite journal mode (DELETE) blocks writers during reads. Without WAL mode, concurrent access fails.

**How to avoid:**
- Enable WAL mode: `PRAGMA journal_mode=WAL` on every connection
- Use connection event listeners (SQLAlchemy) to ensure WAL is set
- Verify with `PRAGMA journal_mode;` returning "wal"

**Warning signs:**
- `sqlite3.OperationalError: database is locked` in logs
- Slow query performance under load
- Missing `-wal` and `-shm` files next to database file

### Pitfall 2: Docker Volume Data Loss

**What goes wrong:** Database data disappears after `docker-compose down` or container recreation

**Why it happens:** Anonymous volumes or container-local storage gets destroyed when container is removed. Using `docker-compose down -v` accidentally deletes named volumes.

**How to avoid:**
- Use named volumes explicitly: `db-data:/data`
- Never run `docker-compose down -v` in production
- Document backup strategy (volume export, bind mount backups)
- Test recovery: `docker-compose down && docker-compose up` should preserve data

**Warning signs:**
- Empty database after container restart
- No volumes listed in `docker volume ls`
- Database recreated with fresh schema on every startup

### Pitfall 3: Unhealthy Service Dependency Chains

**What goes wrong:** Frontend starts before backend is ready, gets connection errors, then crashes in restart loop

**Why it happens:** `depends_on: [backend]` only waits for container to start, not for application to be ready

**How to avoid:**
- Implement `/health` endpoint in backend
- Add HEALTHCHECK to backend Dockerfile
- Use `depends_on.backend.condition: service_healthy` in frontend
- Set `start_period` in healthcheck for slow initialization

**Warning signs:**
- "Connection refused" errors in frontend logs
- Frontend restart loop during startup
- Manual `docker-compose restart frontend` fixes issue

### Pitfall 4: Python Log Buffering in Docker

**What goes wrong:** Application logs don't appear in `docker logs` until container crashes or restarts

**Why it happens:** Python buffers stdout by default. Docker captures stdout, but buffered logs aren't flushed until process exits.

**How to avoid:**
- Set `PYTHONUNBUFFERED=1` environment variable
- Use `print(..., flush=True)` for critical messages
- Configure logging handler to flush: `handler.setStream(sys.stdout.buffer)`

**Warning signs:**
- No logs visible in `docker logs` for running container
- Logs appear in burst when container stops
- Missing timestamps between log entries

### Pitfall 5: Improper Signal Handling (Graceful Shutdown)

**What goes wrong:** `docker-compose stop` takes 10 seconds and forcefully kills container. Database transactions are interrupted, connections aren't closed cleanly.

**Why it happens:** Shell form CMD (`CMD python main.py`) runs process as child of shell, which doesn't forward SIGTERM. Process ignores shutdown signal until SIGKILL timeout.

**How to avoid:**
- Use exec form CMD: `CMD ["uvicorn", "main:app"]`
- Test shutdown: `docker-compose stop` should complete in <2 seconds
- Verify process ID 1: `docker exec <container> ps aux` shows uvicorn as PID 1
- Set `stop_grace_period: 30s` for long cleanup tasks

**Warning signs:**
- Container takes exactly 10 seconds to stop
- "Killing container" message in Docker logs
- Database corruption warnings on restart
- Open connections not cleaned up

### Pitfall 6: Next.js Build Files Not Copied in Standalone Mode

**What goes wrong:** Frontend container returns 404 for static assets or API routes. Server starts but serves broken pages.

**Why it happens:** Standalone mode only copies `.next/standalone`. You must manually copy `.next/static` and `public/` directories.

**How to avoid:**
```dockerfile
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static  # REQUIRED
COPY --from=builder /app/public ./public              # REQUIRED
```

**Warning signs:**
- 404 errors for `/_next/static/` assets
- Missing images from public folder
- JavaScript chunks fail to load
- Blank white page in browser

### Pitfall 7: Docker Cache Invalidation on Every Build

**What goes wrong:** `docker build` re-downloads all dependencies every time, even when only code changed. Build takes 5+ minutes instead of 30 seconds.

**Why it happens:** Copying application code before `uv sync` invalidates all subsequent layers. Docker can't reuse cached dependency installation.

**How to avoid:**
```dockerfile
# WRONG - code changes invalidate dependency layer
COPY . .
RUN uv sync

# CORRECT - dependencies cached separately
COPY pyproject.toml uv.lock ./
RUN uv sync --no-install-project  # Cache layer
COPY . .
RUN uv sync                       # Fast, uses cache
```

**Warning signs:**
- Every build downloads packages from PyPI
- Build time doesn't improve after first build
- `uv sync` output shows "Downloading..." every time

## Code Examples

Verified patterns from official sources:

### FastAPI Health Endpoint

```python
# Source: https://www.index.dev/blog/how-to-implement-health-check-in-python
from fastapi import FastAPI, status
from pydantic import BaseModel

app = FastAPI()

class HealthResponse(BaseModel):
    status: str
    database: str = "connected"

@app.get(
    "/health",
    status_code=status.HTTP_200_OK,
    response_model=HealthResponse,
    tags=["monitoring"]
)
async def health_check():
    """
    Health check endpoint for Docker HEALTHCHECK and load balancers.
    Returns 200 if service is healthy, 503 if unhealthy.
    """
    try:
        # Optional: Check database connectivity
        # with Session(engine) as session:
        #     session.exec(text("SELECT 1"))

        return HealthResponse(status="healthy")
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unhealthy"
        )
```

### Docker Compose Production Configuration

```yaml
# Source: https://docs.docker.com/compose/how-tos/startup-order/
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    image: rss-reader-backend:latest
    container_name: rss-reader-backend
    restart: unless-stopped
    volumes:
      - db-data:/data                    # Named volume for SQLite
      - ./config:/config:ro              # Read-only config
    environment:
      - CONFIG_FILE=/config/app.yaml
      - PYTHONUNBUFFERED=1
    env_file:
      - .env                             # Secrets (gitignored)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s                  # Allow initialization time
    stop_grace_period: 30s               # Graceful shutdown timeout
    ports:
      - "8000:8000"
    networks:
      - rss-reader

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    image: rss-reader-frontend:latest
    container_name: rss-reader-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy       # Wait for backend readiness
        restart: true                    # Auto-restart if backend restarts
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 10s
      timeout: 5s
      retries: 3
    stop_grace_period: 10s
    ports:
      - "3000:3000"
    networks:
      - rss-reader

volumes:
  db-data:
    driver: local
    # Optional: Specify backup location with driver_opts
    # driver_opts:
    #   type: none
    #   device: /path/to/backup/location
    #   o: bind

networks:
  rss-reader:
    driver: bridge
```

### .dockerignore (Backend)

```
# Source: https://docs.astral.sh/uv/guides/integration/docker/
.venv/
__pycache__/
*.pyc
*.pyo
*.pyd
.pytest_cache/
.ruff_cache/
.coverage
htmlcov/
dist/
build/
*.egg-info/
.git/
.env
data/
*.db
*.db-wal
*.db-shm
```

### .dockerignore (Frontend)

```
node_modules/
.next/
.git/
.env*.local
*.log
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tiangolo/uvicorn-gunicorn-fastapi image | Build from scratch with python:slim | 2024 (deprecated) | Simpler, aligns with Kubernetes, no process manager needed |
| Gunicorn + Uvicorn workers | Single Uvicorn process per container | 2023-2024 | Better signal handling, simpler scaling, container orchestration |
| pip/poetry | uv package manager | 2024-2025 | 10-100x faster builds, better Docker caching, official support |
| Manual .env parsing | Pydantic Settings | 2023+ | Type safety, validation, nested models, FastAPI integration |
| Next.js serverless target | standalone output | 2022 (Next.js 12.2) | Smaller images, includes only necessary files, replaces deprecated target |
| SQLite DELETE journal | WAL mode | Long-standing best practice | Essential for concurrent access, prevents database locked errors |

**Deprecated/outdated:**
- **tiangolo/uvicorn-gunicorn-fastapi**: Use official Python base image + single Uvicorn process instead
- **Next.js serverless target**: Replaced by standalone output mode
- **Running multiple workers in single container**: Anti-pattern for Kubernetes/Docker Compose scaling

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal health check timings for cold start**
   - What we know: `start_period` should cover initialization time, `interval: 10s` is standard
   - What's unclear: Exact timing depends on feed database initialization (unknown at research phase)
   - Recommendation: Start with `start_period: 10s`, monitor startup time in practice, adjust if needed

2. **APScheduler state persistence across container restarts**
   - What we know: APScheduler stores job state in memory by default, lost on restart
   - What's unclear: Whether scheduled feed refreshes need persistence or can restart on container start
   - Recommendation: Use in-memory store (simplest), jobs resume on restart. Add SQLite job store in Phase 3 if needed.

3. **Log rotation strategy for Docker json-file driver**
   - What we know: Docker json-file driver can fill disk without rotation
   - What's unclear: Whether to configure max-size/max-file or rely on external log aggregation
   - Recommendation: Set `max-size: 10m` and `max-file: 3` in docker-compose logging config as safety net

## Sources

### Primary (HIGH confidence)

- [Docker Compose startup order - Official Docs](https://docs.docker.com/compose/how-tos/startup-order/)
- [SQLite WAL Mode - Official Documentation](https://sqlite.org/wal.html)
- [Next.js standalone output - Official API Reference](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)
- [FastAPI Docker deployment - Official Guide](https://fastapi.tiangolo.com/deployment/docker/)
- [Pydantic Settings - Official Documentation](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)
- [FastAPI Settings - Official Advanced Guide](https://fastapi.tiangolo.com/advanced/settings/)
- [uv Docker Integration - Official Guide](https://docs.astral.sh/uv/guides/integration/docker/)

### Secondary (MEDIUM confidence)

- [Docker Compose Health Checks Guide | Last9](https://last9.io/blog/docker-compose-health-checks/)
- [FastAPI Production Deployment Best Practices | Better Stack](https://betterstack.com/community/guides/scaling-python/fastapi-docker-best-practices/)
- [Production-ready Python Docker with uv | Hynek Schlawack](https://hynek.me/articles/docker-uv/)
- [Docker Compose Graceful Shutdown | Compose, Break, Repeat](https://lours.me/posts/compose-tip-018-graceful-shutdown/)
- [Gracefully Stopping Python in Docker | Nicolas Le Manchet](https://lemanchet.fr/articles/gracefully-stop-python-docker-container.html)

### Tertiary (LOW confidence)

- [How to Handle Docker Container Logs | OneUptime](https://oneuptime.com/blog/post/2026-02-02-docker-container-logs/view) - Recent but generic guidance
- [Docker Compose depends_on with Health Checks | OneUptime](https://oneuptime.com/blog/post/2026-01-16-docker-compose-depends-on-healthcheck/view) - Recent tutorial

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation and recent 2025-2026 sources confirm uv, standalone mode, Pydantic Settings
- Architecture: HIGH - Multi-stage builds, health checks, WAL mode verified from official sources
- Pitfalls: HIGH - Docker locked errors, volume loss, signal handling documented in official guides and production blogs

**Research date:** 2026-02-05
**Valid until:** 2026-04-05 (60 days - infrastructure patterns are stable)

**Technologies evolve slowly:**
- Docker Compose patterns: Stable, 12+ month validity
- SQLite WAL: Stable, years of validity
- Next.js standalone: Stable since 2022, likely multi-year validity
- uv: Fast-moving project (2024-2025), may add features but core patterns stable
