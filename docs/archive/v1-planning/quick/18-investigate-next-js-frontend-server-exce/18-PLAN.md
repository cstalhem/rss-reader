---
phase: quick-18
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/next.config.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "next.config.ts experimental section contains preloadEntriesOnStart: false"
    - "next.config.ts experimental section contains webpackMemoryOptimizations: true"
  artifacts:
    - path: "frontend/next.config.ts"
      provides: "Next.js config with memory optimizations"
      contains: "preloadEntriesOnStart"
  key_links: []
---

<objective>
Add two memory optimization flags to the Next.js experimental config to reduce the frontend server's RAM footprint.

Purpose: Reduce server memory usage in the single-user local-first app. `preloadEntriesOnStart: false` defers module preloading to first request (trades startup memory for slightly slower first-request latency). `webpackMemoryOptimizations: true` enables internal webpack memory optimization passes.
Output: Updated frontend/next.config.ts with both flags set.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add memory optimization flags to next.config.ts</name>
  <files>frontend/next.config.ts</files>
  <action>
    Add two properties to the existing `experimental` object in `frontend/next.config.ts`:
    - `preloadEntriesOnStart: false`
    - `webpackMemoryOptimizations: true`

    The result should be:

    ```ts
    import type { NextConfig } from "next";

    const nextConfig: NextConfig = {
      output: 'standalone',
      experimental: {
        optimizePackageImports: ["@chakra-ui/react"],
        preloadEntriesOnStart: false,
        webpackMemoryOptimizations: true,
      },
    };

    export default nextConfig;
    ```

    Do not change any other content.
  </action>
  <verify>Run `cd /Users/cstalhem/projects/rss-reader/frontend && bun run build 2>&1 | tail -20` to confirm the build succeeds with the new config. A successful build output (no config errors) is sufficient.</verify>
  <done>Both flags are present in the experimental object and the build completes without errors.</done>
</task>

</tasks>

<verification>
Confirm `frontend/next.config.ts` contains both `preloadEntriesOnStart: false` and `webpackMemoryOptimizations: true` inside the `experimental` block.
</verification>

<success_criteria>
`frontend/next.config.ts` has both memory optimization flags in the experimental section and the project builds without errors.
</success_criteria>

<output>
After completion, create `.planning/quick/18-investigate-next-js-frontend-server-exce/18-SUMMARY.md`
</output>
