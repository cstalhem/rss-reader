---
description: "High-impact WRONG/CORRECT patterns — mistakes that break builds, cause data loss, or create security issues"
paths: ["**"]
---

# Critical Patterns

<!--
This file captures high-impact mistakes in WRONG/CORRECT format.
Only add patterns here that meet the severity threshold:
- Build-breaking errors
- Data loss or corruption
- Security vulnerabilities
- Silent failures that are hard to debug

Format for each entry:

## <Short description>

WRONG:
```
code or command that causes the problem
```

CORRECT:
```
code or command that avoids the problem
```

Why: One-line explanation of the root cause.
-->

## Multi-stage Docker build must include Alembic files

WRONG:
```dockerfile
# Runtime stage — only copies source
COPY --from=builder /app/src /app/src
```

CORRECT:
```dockerfile
# Runtime stage — copies source AND migration infrastructure
COPY --from=builder /app/src /app/src
COPY --from=builder /app/alembic.ini /app/alembic.ini
COPY --from=builder /app/alembic /app/alembic
```

Why: Alembic migrations silently skip when config is missing, causing schema drift that crashes at first ORM query.
