# Pitfalls Research

**Domain:** Personal RSS Reader with LLM Curation (FastAPI + SQLite + Next.js + Chakra UI + Ollama + Docker Compose)
**Researched:** 2026-02-04
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: SQLite Write Concurrency Bottleneck

**What goes wrong:**
SQLite only supports one writer at a time per database file. When RSS feed refresh runs concurrently with user actions (marking articles read) or LLM scoring operations, you get "database is locked" errors. With APScheduler running every 30 minutes and potential LLM batch scoring, this will cause frequent failures.

**Why it happens:**
SQLite uses database-level locks. Even with WAL (Write-Ahead Logging) mode enabled, only one writer can access the database at once, blocking all other writers until finished. Checkpoint starvation can worsen this when multiple processes try to write.

**How to avoid:**
1. **Enable WAL mode** - Set `PRAGMA journal_mode=WAL` on database initialization
2. **Set high busy timeout** - Use `PRAGMA busy_timeout=5000` (5 seconds) to retry instead of immediate failure
3. **Design for sequential writes** - Make APScheduler and LLM scoring queue-based, not concurrent
4. **Read-heavy optimization** - Use read replicas pattern if needed (copy DB file for read-only operations)
5. **Avoid long transactions** - Commit frequently, especially in feed refresh loops

**Warning signs:**
- `sqlite3.OperationalError: database is locked` in logs
- API requests timing out during feed refresh
- Articles not saving read status during background jobs
- Test flakiness in concurrent scenarios

**Phase to address:**
Phase M1 (Docker Compose setup) - Configure WAL mode and busy timeout in database initialization before production deployment. Phase M3 (LLM scoring) - Design scoring pipeline as queue-based, not parallel writes.

**Sources:**
- [SQLite concurrent writes documentation](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/)
- [PocketBase SQLite concurrency discussion](https://github.com/pocketbase/pocketbase/discussions/5524)

---

### Pitfall 2: RSS Feed Parsing Fragility (Malformed XML)

**What goes wrong:**
About 10% of RSS feeds are not well-formed XML. Feeds break due to whitespace before XML declaration, encoding issues, mixed RSS/Atom formats, or string concatenation instead of proper XML libraries. A single broken feed can crash the entire refresh job or silently fail, leaving stale content.

**Why it happens:**
RSS quality has dropped as it gained popularity. Many sites generate feeds by treating RSS as text (string concatenation) rather than using XML libraries. Even a single space before `<?xml` breaks the parser.

**How to avoid:**
1. **Use lenient parsers** - feedparser (already in use) is lenient and handles broken feeds
2. **Per-feed error isolation** - Wrap each feed fetch in try/except, continue on failure
3. **Feed-level error tracking** - Store last_error and consecutive_failures in Feed model
4. **Exponential backoff** - Skip feeds that fail repeatedly (e.g., after 3 failures, check every 6 hours instead of 30 min)
5. **Conditional requests** - Support ETag and Last-Modified to reduce parsing attempts
6. **Validation logging** - Log parse warnings (not just errors) to catch degrading feeds early

**Warning signs:**
- Feeds showing "last updated: 2 days ago" when site has new content
- Parser exceptions in logs but no user-visible errors
- Articles from some feeds never appearing despite valid RSS URLs
- Feed refresh job taking much longer than expected (stuck on broken feed)

**Phase to address:**
Phase M1 (MVP frontend) - Expose feed health status in UI ("last successful fetch", error count). Phase M2 (Feed Management) - Add manual "force refresh" and "test feed" actions to debug broken feeds.

**Sources:**
- [Parsing RSS At All Costs](https://www.xml.com/pub/a/2003/01/22/dive-into-xml.html)
- [RSS Feed Best Practices](https://kevincox.ca/2022/05/06/rss-feed-best-practices/)

---

### Pitfall 3: Docker Volume Data Loss on Redeployment

**What goes wrong:**
Using anonymous volumes or forgetting to declare critical paths as volumes causes data loss when containers are recreated. SQLite database, user preferences, Ollama model cache all vanish during `docker-compose down` or stack redeployment. Users lose all articles, read status, and trained LLM preferences.

**Why it happens:**
Anonymous volumes create "dangling" data that Docker doesn't track between deploys. Teams use development configs in production, missing named volumes and bind mounts. The `latest` tag makes rollbacks impossible without version-specific volume snapshots.

**How to avoid:**
1. **Named volumes in production compose** - `rss_data`, `ollama_models` as explicit named volumes
2. **Document volume paths** - Clear mapping of what data lives where (database, models, config)
3. **Health checks for data** - Verify database exists and is accessible on container startup
4. **Backup strategy** - Automated backups with `docker-volume-backup` or Duplicati, especially for SQLite
5. **Never use `latest` tag** - Version images (`:v1.2.3`) to enable rollbacks
6. **Test restore procedure** - Regularly verify backups can be restored successfully

**Warning signs:**
- Fresh database after `docker-compose restart`
- "Cannot find Ollama model" errors after container recreation
- User preferences reset after deployment
- Articles disappear when updating to new version

**Phase to address:**
Phase M1 (Docker Compose) - Define named volumes, document backup strategy, test restore. Critical before production deployment.

**Sources:**
- [Stop Misusing Docker Compose in Production](https://dflow.sh/blog/stop-misusing-docker-compose-in-production-what-most-teams-get-wrong)
- [Docker Volume Backup Best Practices](https://www.virtualizationhowto.com/2024/11/best-way-to-backup-docker-containers-volumes-and-home-server/)
- [Avoid Docker Compose Pitfalls](https://moldstud.com/articles/p-avoid-these-common-docker-compose-pitfalls-tips-and-best-practices)

---

### Pitfall 4: Ollama Model Quantization Quality Loss

**What goes wrong:**
Using default quantized Ollama models (Q4, Q5) sacrifices scoring accuracy for compatibility. The LLM gives inconsistent interest ratings, misses context, or hallucinates categories. Users see "high interest" articles they don't care about and miss good content scored as "low".

**Why it happens:**
Smaller quantized models "feel snappier" on modest hardware, tempting developers to use them by default. Model selection happens once during setup and is rarely revisited. Prompt engineering compensates for model weaknesses instead of using better models.

**How to avoid:**
1. **Start with higher precision** - Use Q6 or Q8 quantization if hardware allows (8GB+ VRAM)
2. **Model evaluation framework** - Test scoring consistency with sample articles before full rollout
3. **Explicit model requirements** - Document minimum model size for accurate scoring (e.g., 7B parameters minimum)
4. **Fallback to keyword filters** - Don't rely solely on LLM; multi-stage pipeline catches failures
5. **Context window awareness** - Track token usage, explicitly set context length (4096 minimum for article scoring)
6. **Monitor hallucinations** - Log when LLM returns invalid JSON or categories outside schema

**Warning signs:**
- LLM scores articles as "high interest" that user marks unread immediately
- Inconsistent scoring (same article gets different scores on re-run)
- LLM returns empty responses or malformed JSON intermittently
- Latency spikes (model running out of context window)

**Phase to address:**
Phase M3 (LLM Scoring) - Model selection and evaluation must happen during initial Ollama integration, not as afterthought.

**Sources:**
- [Common Mistakes in Local LLM Deployments](https://sebastianpdw.medium.com/common-mistakes-in-local-llm-deployments-03e7d574256b)
- [Complete Ollama Tutorial 2026](https://dev.to/proflead/complete-ollama-tutorial-2026-llms-via-cli-cloud-python-3m97)

---

### Pitfall 5: Next.js + Chakra UI Hydration Errors

**What goes wrong:**
Server-rendered Chakra UI styles don't match client-rendered DOM, causing "Hydration failed" errors. The app flashes unstyled content, dark mode doesn't persist on reload, or components render differently server vs client. Users see layout shifts and broken styling on initial page load.

**Why it happens:**
Next.js 13+ uses Server Components by default, but Chakra UI only works in Client Components. Missing `ColorModeScript` in `_document.tsx` means Chakra can't determine initial mode during SSR. Improper Emotion cache setup causes style injection order mismatches.

**How to avoid:**
1. **Mark Chakra components as 'use client'** - All components using Chakra must be Client Components
2. **Inject ColorModeScript** - Add `<ColorModeScript />` to `_document.tsx` before hydration
3. **Configure Emotion cache** - Set up EmotionCache in `_app.tsx` for consistent style injection
4. **Use extendTheme() properly** - Never use object spread on theme; always use `extendTheme()` to preserve tokens
5. **Test SSR explicitly** - Verify `npm run build && npm start` produces no hydration errors
6. **Avoid dynamic styles in SSR** - Don't use `useColorMode()` in Server Components

**Warning signs:**
- "Hydration failed" errors in browser console
- Flash of unstyled content (FOUC) on page load
- Dark mode preference not persisting across page refreshes
- Different styling in development vs production build
- React warnings about server/client mismatch

**Phase to address:**
Phase M1 (MVP frontend) - Critical to resolve before building UI components. Set up Chakra correctly from the start.

**Sources:**
- [Hydration Failed: Debugging Next.js and Chakra UI](https://medium.com/@lehetar749/hydration-failed-debugging-next-js-v15-and-chakra-ui-component-issues-707b53730257)
- [Using Chakra UI with Next.js 13](https://github.com/chakra-ui/chakra-ui/discussions/6908)
- [Troubleshooting Chakra UI SSR Issues](https://www.mindfulchase.com/explore/troubleshooting-tips/front-end-frameworks/troubleshooting-chakra-ui-ssr,-theming,-performance,-and-accessibility-in-enterprise-react-apps.html)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip WAL mode for SQLite | Faster initial setup | "Database locked" errors in production | Never - takes 2 lines to enable |
| Use `latest` Docker tag | Simpler compose file | Cannot rollback, unpredictable updates | Never in production |
| Hardcode secrets in compose | Quick deployment | Security risk, can't share repo | Only in truly isolated home network |
| Parse all feeds every refresh | Simpler logic | Wastes bandwidth, slow refresh cycles | Only for <10 feeds in MVP |
| Use smallest Ollama model | Lower resource usage | Poor scoring quality, user distrust | Only for development/testing |
| Skip feed error isolation | Easier error handling | One broken feed breaks entire refresh | Never - trivial to add try/except |
| Anonymous Docker volumes | Less compose file config | Data loss on redeployment | Never - named volumes are one line |
| Ignore Chakra SSR setup | Works in development | Hydration errors in production | Never - must configure from start |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| RSS feed fetching | Not setting User-Agent header | Include descriptive User-Agent with contact email |
| RSS polling | Fixed 30-min interval for all feeds | Respect TTL/Cache-Control headers, exponential backoff on errors |
| Ollama API | Assuming model is always available | Check model exists before scoring, handle model loading delays |
| Ollama context | Ignoring context window limits | Explicitly set context size, truncate long articles |
| Docker networking | Using `localhost` for service-to-service | Use service names defined in compose file |
| SQLite in FastAPI | Default `check_same_thread=True` | Set `check_same_thread=False` for async FastAPI |
| APScheduler in Docker | Scheduler stops on container restart | Persist job state or use idempotent jobs |
| Next.js API routes | Calling backend via external URL | Use internal Docker network for API calls |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all articles at once | Slow API responses | Paginate articles endpoint (already done) | >1000 articles |
| Parsing entire feed history | First fetch takes minutes | Only store new articles, skip duplicates by GUID | >500 entries per feed |
| Synchronous feed refresh | UI blocks during refresh | Background scheduler (already done) | >5 feeds |
| No article cleanup | Database grows unbounded | Implement retention policy (M4) | >10k articles (~1GB) |
| LLM scoring on every page load | Latency spikes | Pre-score on ingestion, cache results | M3 (immediate issue) |
| Full article text in list view | Heavy payload, slow rendering | Send truncated preview in list, full text in detail | >100 articles per page |
| Docker logs unbounded | Disk fills up | Configure log rotation in compose file | After weeks/months |
| Ollama models in container | Slow startup, waste space | Bind mount shared model directory | After 2-3 model downloads |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Fetching arbitrary RSS URLs from user | SSRF attacks (internal network scan) | Validate feed URLs, block private IPs (10.x, 192.168.x) |
| No timeout on feed fetching | DoS via slow-response feeds | Set request timeout (10-30s max) |
| Storing API keys in compose file | Secrets leak in git history | Use Docker secrets or env file (in .gitignore) |
| Running containers as root | Container escape = root on host | Use non-root USER in Dockerfiles |
| Binding to 0.0.0.0 on home server | Exposing service to internet | Bind to 127.0.0.1 or use reverse proxy with auth |
| Executing code from RSS content | XSS via malicious feed | Sanitize HTML in article content, use DOMPurify |
| No rate limiting on refresh API | User can DoS their own server | Debounce manual refresh (1 req per 5 minutes) |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback during refresh | User clicks refresh 5 times, thinking it's broken | Show spinner, disable button, display "Refreshing..." |
| Marking article read hides it immediately | User accidentally loses article they wanted to read | Keep article visible with "undo" option for 5s |
| No indication why article scored high/low | User doesn't trust LLM scoring | Show score rationale ("Matched: machine learning, python") |
| Feed errors hidden | User doesn't know feed is broken for weeks | Display warning badge on broken feeds with error message |
| All unread articles in one list | Overwhelming when returning after vacation | Group by date ("Today", "This Week", "Older") |
| No keyboard shortcuts | Power users forced to click everything | Add j/k navigation, m to mark read, r to refresh |
| LLM takes 10s per article | UI feels sluggish | Score in background, show articles immediately without score |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Docker Compose**: Compose file exists but missing restart policies, health checks, resource limits, named volumes
- [ ] **Feed Refresh**: Scheduler runs but doesn't handle errors per-feed, logs failures but doesn't track in database
- [ ] **Article Display**: Shows title/content but doesn't sanitize HTML (XSS risk)
- [ ] **Dark Mode**: Theme toggle works but doesn't persist across sessions (no localStorage sync)
- [ ] **Read Status**: API endpoint exists but doesn't handle concurrent updates (race conditions)
- [ ] **Ollama Integration**: Model inference works but doesn't handle model loading time, missing models, or timeout
- [ ] **Database**: SQLite works but not configured for WAL mode, busy timeout, or checkpoint management
- [ ] **Backup**: Docker volumes defined but no documented backup/restore procedure

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SQLite locked errors | LOW | Add WAL mode + busy timeout, restart containers |
| Data loss from volume | HIGH | Restore from backup (requires backup to exist), re-fetch feeds |
| Broken RSS feed | LOW | Mark feed as disabled, alert user, provide manual test button |
| Hydration errors | MEDIUM | Add 'use client' directives, inject ColorModeScript, rebuild |
| Ollama model quality issues | MEDIUM | Download better model, adjust prompt engineering, re-score articles |
| Feed polling too aggressive | LOW | Implement rate limiting, respect TTL headers |
| Docker disk full (logs) | LOW | Configure log rotation, prune old logs, restart containers |
| LLM scoring latency | MEDIUM | Move to async queue, pre-score articles, reduce context size |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SQLite write concurrency | M1 (Docker setup) | Test concurrent writes in integration tests |
| RSS parsing fragility | M1 (MVP) + M2 (Feed Mgmt) | Per-feed error tracking, manual refresh works |
| Docker volume data loss | M1 (Docker setup) | `docker-compose down && up` preserves data |
| Ollama quantization quality | M3 (LLM Scoring) | Scoring consistency test suite (10 sample articles) |
| Chakra UI hydration | M1 (MVP frontend) | `npm run build` produces no hydration warnings |
| Feed polling performance | M2 (Feed Management) | Support 50+ feeds without >5min refresh cycles |
| LLM scoring latency | M3 (LLM Scoring) | Articles appear in UI within 1s, scoring async |
| No backup strategy | M1 (Docker setup) | Documented backup commands, test restore succeeds |
| Security: SSRF in feed URLs | M2 (Add feeds via UI) | Private IP validation in feed creation endpoint |
| UX: No refresh feedback | M1 (MVP frontend) | Loading state visible, button disabled during refresh |

---

## Sources

**RSS Feed Best Practices:**
- [RSS Feed Best Practices - Kevin Cox](https://kevincox.ca/2022/05/06/rss-feed-best-practices/)
- [Parsing RSS At All Costs](https://www.xml.com/pub/a/2003/01/22/dive-into-xml.html)
- [RSS Feed Polling Strategy](https://help.rss.app/en/articles/11100642-guide-to-refresh-rate)
- [RSS Feed Troubleshooting](https://visualping.io/blog/rss-is-not-working)

**SQLite Concurrency:**
- [SQLite Concurrent Writes and Database Locked Errors](https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/)
- [PocketBase SQLite Concurrency Discussion](https://github.com/pocketbase/pocketbase/discussions/5524)
- [Abusing SQLite to Handle Concurrency](https://blog.skypilot.co/abusing-sqlite-to-handle-concurrency/)
- [FastAPI with SQLite Deployment](https://medium.com/@vladkens/deploy-fastapi-application-with-sqlite-on-fly-io-5ed1185fece1)

**Ollama Integration:**
- [Common Mistakes in Local LLM Deployments (Medium - blocked)](https://sebastianpdw.medium.com/common-mistakes-in-local-llm-deployments-03e7d574256b)
- [How to Use Local LLMs with Ollama](https://www.f22labs.com/blogs/how-to-use-local-llms-with-ollama-a-complete-guide/)
- [Complete Ollama Tutorial 2026](https://dev.to/proflead/complete-ollama-tutorial-2026-llms-via-cli-cloud-python-3m97)
- [Local LLM Hosting Guide 2025](https://medium.com/@rosgluk/local-llm-hosting-complete-2025-guide-ollama-vllm-localai-jan-lm-studio-more-f98136ce7e4a)

**Docker Compose Production:**
- [Stop Misusing Docker Compose in Production](https://dflow.sh/blog/stop-misusing-docker-compose-in-production-what-most-teams-get-wrong)
- [Docker Compose Tricks for Home Server](https://www.xda-developers.com/docker-compose-tricks-that-made-my-home-server-more-reliable/)
- [Avoid Docker Compose Pitfalls](https://moldstud.com/articles/p-avoid-these-common-docker-compose-pitfalls-tips-and-best-practices)
- [Docker Volume Backup Best Practices](https://www.virtualizationhowto.com/2024/11/best-way-to-backup-docker-containers-volumes-and-home-server/)
- [Docker Compose Deploy Specification](https://docs.docker.com/reference/compose-file/deploy/)

**Next.js + Chakra UI:**
- [Hydration Failed: Debugging Next.js and Chakra UI](https://medium.com/@lehetar749/hydration-failed-debugging-next-js-v15-and-chakra-ui-component-issues-707b53730257)
- [Using Chakra UI with Next.js 13](https://github.com/chakra-ui/chakra-ui/discussions/6908)
- [Common Pitfalls Using ActiveLink in Chakra UI](https://infinitejs.com/posts/common-pitfalls-activelink-chakra-ui-nextjs/)
- [Troubleshooting Chakra UI SSR Issues](https://www.mindfulchase.com/explore/troubleshooting-tips/front-end-frameworks/troubleshooting-chakra-ui-ssr,-theming,-performance,-and-accessibility-in-enterprise-react-apps.html)

---
*Pitfalls research for: Personal RSS Reader with LLM Curation*
*Researched: 2026-02-04*
