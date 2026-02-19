# Project Learning Index

Rationale, examples, trade-offs, and decision aids behind the rules in `AGENTS.md`. Each file covers a specific topic with targeted, actionable content.

**Boundary with AGENTS.md:** `AGENTS.md` has short, actionable rules. Files here have the WHY -- rationale, code examples, edge cases, decision aids, and mistake logs. Do not duplicate rules here; reference them and explain them.

## How to Use

- **Before implementing:** Find relevant topic files below. Read only what applies.
- **Amend an existing file** when the learning fits an existing topic, a mistake was made in a covered area, or an entry needs correction.
- **Create a new file** when the topic is distinct from all existing files. Name it descriptively. Add a row to the table below.
- **Mistakes:** Document in the relevant topic file (preferred) or `common-mistakes.md` (cross-cutting). Include: what went wrong, why, and the fix.

## Files

| File | Description |
|------|-------------|
| react-hooks.md | When to use useMemo, useCallback, useEffect -- and when not to |
| tanstack-query.md | Query key management, mutation patterns, error handling, cache strategies |
| chakra-ui-v3.md | Semantic tokens, Portal/Positioner patterns, component composition, react-icons integration |
| nextjs-app-router.md | Server vs Client components, "use client" boundaries, environment variables |
| file-organization.md | Where types, utilities, constants, and API functions belong in the frontend |
| common-mistakes.md | Agent mistakes and their fixes -- check before implementing similar patterns |
