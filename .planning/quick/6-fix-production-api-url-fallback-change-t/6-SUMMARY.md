---
phase: quick-6
plan: 01
subsystem: frontend-api
tags: [bugfix, production, docker, traefik]
dependency_graph:
  requires: []
  provides: [production-api-url-routing]
  affects: [docker-build, api-client]
tech_stack:
  added: []
  patterns: [nullish-coalescing-operator]
key_files:
  created: []
  modified: [frontend/src/lib/api.ts]
decisions:
  - Use nullish coalescing (??) instead of logical OR (||) for env var fallback to preserve empty string values
metrics:
  duration_seconds: 41
  completed_date: 2026-02-14
---

# Quick Task 6: Fix Production API URL Fallback

**One-liner:** Changed API_BASE_URL fallback to use nullish coalescing (`??`) so empty NEXT_PUBLIC_API_URL correctly results in relative URLs for Traefik routing.

## Problem

The production frontend Dockerfile sets `NEXT_PUBLIC_API_URL=""` (empty string) so the built frontend makes relative API calls that Traefik routes to the backend container. However, `api.ts` used the logical OR operator (`||`), which treats empty string as falsy and incorrectly falls back to `http://localhost:8912`.

**Behavior before fix:**
- Development: `NEXT_PUBLIC_API_URL` undefined → falls back to `http://localhost:8912` ✓
- Production: `NEXT_PUBLIC_API_URL=""` → treated as falsy → falls back to `http://localhost:8912` ✗

**Behavior after fix:**
- Development: `NEXT_PUBLIC_API_URL` undefined/null → falls back to `http://localhost:8912` ✓
- Production: `NEXT_PUBLIC_API_URL=""` → preserves empty string → relative URLs → Traefik routing ✓

## Implementation

### Task 1: Replace || with ?? in API_BASE_URL assignment

**Changed:** `frontend/src/lib/api.ts` line 4

```diff
-  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8912";
+  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8912";
```

**Rationale:** The nullish coalescing operator (`??`) only falls back to the default when the left-hand value is `null` or `undefined`, unlike `||` which also treats empty string, `0`, `false`, and `NaN` as falsy. This allows empty string to pass through intentionally.

**Verification:**
- TypeScript type check: Passed
- ESLint on modified file: Passed
- Git diff: Single-line change confirmed

**Commit:** `a979370`

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- [x] `frontend/src/lib/api.ts` line 4 uses `??` operator
- [x] TypeScript compilation succeeds
- [x] ESLint passes on modified file
- [x] Git shows one-line change: `||` → `??`

## Impact

**Production deployment:** The next Docker image build will correctly use relative URLs for API calls. No runtime configuration changes needed - the fix is baked into the build artifact.

**Development workflow:** Unchanged - still falls back to `http://localhost:8912` when env var is undefined.

**Related configuration:**
- `frontend/Dockerfile` line 18: Sets `NEXT_PUBLIC_API_URL=""` as build arg
- `docker-compose.prod.yml`: Traefik routes `PathPrefix('/api')` to backend container

## Self-Check: PASSED

**Created files:** None expected, none created ✓

**Modified files:**
```bash
[ -f "/Users/cstalhem/projects/rss-reader/frontend/src/lib/api.ts" ] && echo "FOUND"
```
Result: FOUND ✓

**Commits:**
```bash
git log --oneline --all | grep -q "a979370"
```
Result: FOUND ✓

**Content verification:**
```bash
grep -q "NEXT_PUBLIC_API_URL ??" /Users/cstalhem/projects/rss-reader/frontend/src/lib/api.ts
```
Result: FOUND ✓
