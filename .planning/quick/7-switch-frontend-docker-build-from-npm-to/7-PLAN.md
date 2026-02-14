---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/Dockerfile
  - frontend/.dockerignore
autonomous: true

must_haves:
  truths:
    - "Builder stage uses oven/bun image to install deps and run next build"
    - "Runtime stage remains node:22-alpine (standalone output is plain node)"
    - "Docker build completes successfully and produces working image"
  artifacts:
    - path: "frontend/Dockerfile"
      provides: "Multi-stage build using bun for install/build, node for runtime"
      contains: "oven/bun"
    - path: "frontend/.dockerignore"
      provides: "Ignores npm lockfile, includes bun.lock"
  key_links:
    - from: "frontend/Dockerfile"
      to: "frontend/bun.lock"
      via: "COPY bun.lock"
      pattern: "COPY.*bun\\.lock"
---

<objective>
Switch the frontend Docker builder stage from npm to bun for faster dependency installation and builds.

Purpose: Bun's install is significantly faster than npm ci, reducing CI build times. The project already uses bun locally and has a bun.lock file tracked in git.
Output: Updated Dockerfile using bun in the builder stage, node in the runtime stage.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/Dockerfile
@frontend/package.json
@frontend/next.config.ts
@frontend/.dockerignore
@AGENTS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch Dockerfile builder stage from npm to bun</name>
  <files>frontend/Dockerfile, frontend/.dockerignore</files>
  <action>
Update `frontend/Dockerfile` builder stage:

1. Change the builder base image from `node:22-alpine` to `oven/bun:latest AS builder`. This gives us bun for fast installs. Node is bundled in the bun image so `next build` works fine.

2. Update the COPY for lockfiles: change `COPY package.json package-lock.json* ./` to `COPY package.json bun.lock ./`

3. Replace `RUN npm ci --omit=dev` with `RUN bun install --frozen-lockfile --production`. The `--frozen-lockfile` flag is bun's equivalent of `npm ci` (fails if lockfile is out of date). `--production` skips devDependencies.

**WAIT** -- Next.js build needs devDependencies (typescript, @types/*). So we need ALL deps for the build stage, then the standalone output won't include devDeps anyway. Change to: `RUN bun install --frozen-lockfile` (no --production flag).

4. Replace `RUN npm run build` with `RUN bun run build`. This runs the `build` script from package.json (`next build --webpack`).

5. Keep the runtime stage exactly as-is: `node:22-alpine`, same ENV vars, same user setup, same COPY --from=builder lines, same HEALTHCHECK with `127.0.0.1`, same `CMD ["node", "server.js"]`.

6. Keep the `ARG NEXT_PUBLIC_API_URL=""` and `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL` lines in the builder stage exactly as they are -- these are critical for production routing.

Update `frontend/.dockerignore`:
- Add `package-lock.json` to the ignore list (not needed in Docker context since we use bun.lock)
- Keep all existing entries
  </action>
  <verify>
Run `docker build -t rss-frontend-test ./frontend` from the project root and confirm it completes successfully. Verify the image runs: `docker run --rm -d -p 3210:3000 --name rss-test rss-frontend-test && sleep 3 && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3210/ && docker stop rss-test`. Expect HTTP 200 or 307 (redirect to main page).
  </verify>
  <done>
Frontend Docker image builds successfully using bun for dependency installation and Next.js build. Runtime stage unchanged (node:22-alpine). The standalone output serves correctly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Remove package-lock.json from repo</name>
  <files>frontend/package-lock.json</files>
  <action>
Delete `frontend/package-lock.json` from the repository. The project uses bun locally (bun.lock already tracked in git), so maintaining a parallel npm lockfile is unnecessary and can cause confusion.

Stage the deletion with `git rm frontend/package-lock.json`.

Note: Do NOT commit -- just stage. The executor commit step will handle the commit.
  </action>
  <verify>
Confirm `frontend/package-lock.json` no longer exists. Confirm `frontend/bun.lock` still exists and is tracked.
  </verify>
  <done>
Only bun.lock remains as the single lockfile for the frontend, matching the project's use of bun as its package manager.
  </done>
</task>

</tasks>

<verification>
- `docker build -t rss-frontend-test ./frontend` succeeds
- Runtime container responds on port 3000
- No `package-lock.json` in repo
- `bun.lock` is the sole lockfile
- CI workflow (docker-publish.yml) needs no changes (it just runs `docker build` on the Dockerfile)
</verification>

<success_criteria>
Frontend Docker build uses bun for dependency installation and build step. Runtime stage is unchanged (node:22-alpine with standalone output). Build completes successfully. package-lock.json removed from repository.
</success_criteria>

<output>
After completion, create `.planning/quick/7-switch-frontend-docker-build-from-npm-to/7-SUMMARY.md`
</output>
