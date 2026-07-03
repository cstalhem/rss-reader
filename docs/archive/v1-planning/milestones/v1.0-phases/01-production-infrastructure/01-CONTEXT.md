# Phase 1: Production Infrastructure - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Application runs in production-ready Docker environment with data persistence. Docker Compose orchestrates backend and frontend services with auto-restart, health checks, and persistent SQLite storage. This is infrastructure work — no user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Configuration approach
- YAML config file with environment variable overrides
- Secrets (API keys, if any) kept in separate `.env` file, gitignored
- Config file for non-sensitive settings only
- App runs with sensible defaults — `docker-compose up` just works without config
- Config file is optional for customization

### Volume and data layout
- SQLite database lives at `/data/` inside container (top-level, obvious)
- Named Docker volume for database persistence (Docker-managed)
- Config file uses separate bind mount from data volume
- User handles backups — no backup volume in compose file

### Logging and observability
- Logs to stdout only — Docker captures via `docker logs`
- Default log level INFO, configurable to DEBUG via config
- Scheduled task logging (feed refresh) is configurable — user chooses verbosity
- Backend exposes `/health` endpoint for Docker and external monitoring

### Container restart behavior
- Restart policy: `unless-stopped` (auto-restart on crash, respects manual stops)
- Frontend depends on backend with health check waiting (`depends_on` + `condition: service_healthy`)
- Health checks required before accepting traffic

### Claude's Discretion
- Log format (JSON vs plain text)
- Exact graceful shutdown timeout
- Health check implementation details
- WAL mode configuration approach

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-production-infrastructure*
*Context gathered: 2026-02-05*
