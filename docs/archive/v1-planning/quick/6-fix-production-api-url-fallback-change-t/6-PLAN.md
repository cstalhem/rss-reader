---
phase: 6-fix-production-api-url-fallback-change-t
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [frontend/src/lib/api.ts]
autonomous: true

must_haves:
  truths:
    - "Production frontend uses relative URLs (empty string) when NEXT_PUBLIC_API_URL is set to empty string"
    - "Development frontend uses localhost:8912 when NEXT_PUBLIC_API_URL is undefined"
  artifacts:
    - path: "frontend/src/lib/api.ts"
      provides: "API_BASE_URL with nullish coalescing operator"
      min_lines: 4
      contains: "??"
  key_links:
    - from: "frontend/src/lib/api.ts"
      to: "process.env.NEXT_PUBLIC_API_URL"
      via: "nullish coalescing operator"
      pattern: "process\\.env\\.NEXT_PUBLIC_API_URL \\?\\?"
---

<objective>
Fix production API URL fallback to use relative URLs when NEXT_PUBLIC_API_URL is set to empty string.

Purpose: The current `||` operator treats empty string as falsy, causing production builds to incorrectly use `http://localhost:8912` instead of relative URLs routed by Traefik.

Output: Updated api.ts with `??` nullish coalescing operator allowing empty string to pass through.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./frontend/Dockerfile
@./docker-compose.prod.yml
@./frontend/src/lib/api.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace || with ?? in API_BASE_URL assignment</name>
  <files>frontend/src/lib/api.ts</files>
  <action>
Change line 4 from:
```typescript
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8912";
```

to:
```typescript
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8912";
```

This changes the logical OR operator (`||`) to the nullish coalescing operator (`??`). The key difference:
- `||` treats empty string `""` as falsy and falls back to localhost:8912
- `??` only falls back to localhost:8912 when the value is `null` or `undefined`

When the Dockerfile sets `NEXT_PUBLIC_API_URL=""` (empty string), `??` will preserve the empty string, allowing the frontend to make relative API calls that Traefik routes to the backend container.
  </action>
  <verify>
Run `grep -n "NEXT_PUBLIC_API_URL" frontend/src/lib/api.ts` and confirm line 4 contains `??` instead of `||`.
  </verify>
  <done>
api.ts uses nullish coalescing operator (`??`) so empty NEXT_PUBLIC_API_URL results in relative URLs in production.
  </done>
</task>

</tasks>

<verification>
1. Confirm the change: `git diff frontend/src/lib/api.ts` shows `||` changed to `??`
2. Type check: `cd frontend && npx tsc --noEmit` passes
3. Lint check: `cd frontend && bun run lint` passes
</verification>

<success_criteria>
- `frontend/src/lib/api.ts` line 4 uses `??` operator
- TypeScript compilation succeeds
- ESLint passes
- Git shows one-line change: `||` → `??`
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-production-api-url-fallback-change-t/6-01-SUMMARY.md`
</output>
