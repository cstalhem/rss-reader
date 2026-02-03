---
description: When committing code changes to git
---

# Git Commit Conventions

Use **Conventional Commits** format for all commits.

## Format

```
<type>: <short description>
```

## Types

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Tooling, dependencies, config |
| `refactor` | Code restructuring (no feature/fix) |
| `test` | Adding or updating tests |

## When to Commit

- After each logical unit of work (one feature, one fix)
- Code must pass `ruff check` and tests before committing
- Keep commits atomic — one purpose per commit

## Examples

```
feat: add article list endpoint
fix: handle missing feed title gracefully
docs: update README with setup instructions
chore: add ruff configuration
refactor: extract feed parsing into separate module
test: add integration tests for mark-as-read
```
