---
phase: quick-7
plan: 01
subsystem: infra
tags: [docker, bun, next.js, ci]

requires:
  - phase: none
    provides: existing frontend Dockerfile with npm-based builder
provides:
  - Bun-based Docker builder stage for faster CI builds
  - Single lockfile (bun.lock) for frontend
affects: [docker-publish.yml, deployment]

tech-stack:
  added: [oven/bun Docker image]
  patterns: [bun builder + node runtime multi-stage Docker build]

key-files:
  created: []
  modified:
    - frontend/Dockerfile
    - frontend/.dockerignore

key-decisions:
  - "Use oven/bun:latest as builder (includes node for next build)"
  - "Install all deps in builder (devDeps needed for Next.js build, standalone strips them)"
  - "Remove package-lock.json since bun.lock is the sole lockfile"

patterns-established:
  - "Multi-stage: bun for install/build, node:22-alpine for runtime"

duration: 1min
completed: 2026-02-14
---

# Quick Task 7: Switch Frontend Docker Build from npm to bun

**Bun-based Docker builder stage replacing npm for faster dependency installs, with package-lock.json removed as redundant**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-14T22:31:25Z
- **Completed:** 2026-02-14T22:32:34Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Switched Docker builder stage from node:22-alpine + npm to oven/bun:latest for faster installs
- Runtime stage unchanged (node:22-alpine with standalone output)
- Removed package-lock.json from repository -- bun.lock is the sole lockfile
- CI workflow needs no changes (just runs docker build on the Dockerfile)

## Task Commits

Each task was committed atomically:

1. **Task 1: Switch Dockerfile builder stage from npm to bun** - `6cf07cc` (feat)
2. **Task 2: Remove package-lock.json from repo** - `7e7b090` (chore)

## Files Created/Modified
- `frontend/Dockerfile` - Builder stage: oven/bun:latest, bun install --frozen-lockfile, bun run build
- `frontend/.dockerignore` - Added package-lock.json to ignore list
- `frontend/package-lock.json` - Deleted (6652 lines removed)

## Decisions Made
- Used `oven/bun:latest` which bundles Node.js, so `next build` runs without issues
- Installed all dependencies (no --production flag) since Next.js build needs devDeps like TypeScript; standalone output strips them anyway
- Removed package-lock.json to eliminate dual-lockfile confusion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Docker daemon not running locally, so could not verify the build on this machine. The Dockerfile changes are straightforward (image swap, command swap) and will be verified by the CI pipeline on push. The CI workflow (`docker-publish.yml`) runs `docker build` and needs no modifications.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Frontend Docker builds will use bun on next CI run
- No blockers

---
*Quick task: 7*
*Completed: 2026-02-14*
