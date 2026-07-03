# Pitfalls Research

**Domain:** RSS Reader with LLM Scoring + SSE + Runtime Config
**Researched:** 2026-02-14
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: SSE Connections Through Traefik Get Buffered

**What goes wrong:**
SSE events don't reach the client in real-time. Updates that should appear instantly (article scored, feed refreshed) are delayed by 30-60 seconds or batched together when the proxy buffer fills. This defeats the entire purpose of using SSE instead of polling.

**Why it happens:**
Traefik (and nginx/HAProxy) buffer HTTP responses by default before forwarding to clients. SSE requires immediate flush of each event. Without explicit configuration, Traefik accumulates events until its buffer (~16KB) fills or a timeout triggers.

**How to avoid:**
1. Add `X-Accel-Buffering: no` header in FastAPI SSE response
2. Configure Traefik route middleware with buffering disabled:
   ```yaml
   http:
     middlewares:
       disable-buffering:
         buffering:
           maxResponseBodyBytes: 0
           memResponseBodyBytes: 0
           maxRequestBodyBytes: 0
           memRequestBodyBytes: 0
   ```
3. Test with `curl -N http://your-endpoint/sse` (the `-N` flag disables curl's buffering)

**Warning signs:**
- SSE demo works on localhost:8912 but not through Traefik URL
- Events arrive in bursts rather than individually
- Chrome DevTools Network tab shows "pending" status for 30+ seconds
- First event arrives immediately, subsequent events delayed

**Phase to address:**
Phase 1 (SSE Infrastructure) — Must verify end-to-end SSE delivery through production proxy before building UI that depends on it.

---

### Pitfall 2: @lru_cache Prevents Runtime Ollama Config Updates

**What goes wrong:**
User changes Ollama model in the UI, hits "Save", sees success message — but scoring still uses the old model. Even after waiting minutes, new articles get scored with the wrong model. The only fix is restarting the backend container.

**Why it happens:**
`get_settings()` is wrapped in `@lru_cache` (line 128 of config.py). The Settings object is created once on first call and reused forever. Updating the YAML config file or env vars has no effect on the cached instance. The scoring pipeline calls `get_settings()` and gets the stale cached copy.

**How to avoid:**
When implementing runtime config updates:
1. Add `get_settings.cache_clear()` after successful config save
2. OR replace `@lru_cache` with context-aware caching that checks modification time
3. OR create a `reload_settings()` endpoint that clears cache and rebuilds
4. Add integration test: change config via API, score article, verify new model was used (check Ollama logs)

**Warning signs:**
- Config update API returns 200 but behavior doesn't change
- Ollama logs show requests for old model name after config change
- Users report "changes don't take effect"
- Need to restart container to apply settings

**Phase to address:**
Phase 2 (Config UI) — The config update endpoint MUST clear the cache before claiming success. Test this with actual scoring after config change.

---

### Pitfall 3: Feedback Loop Causes Scoring Drift

**What goes wrong:**
After implementing LLM feedback (user marks high-scored article as boring → re-score with lower weight), scoring gradually becomes unreliable. Articles users like get scored low, articles they hate get scored high. Over weeks, the scoring feels "broken" and users stop trusting it.

**Why it happens:**
Catastrophic forgetting in continual learning. The LLM was trained on a broad distribution of content. Feedback from a single user (especially if their behavior is noisy — e.g., sometimes marks political articles interesting, sometimes blocks them) creates a non-i.i.d. training signal. The model "forgets" its original calibration and overfits to recent feedback.

This is a well-documented problem in RLHF systems: reward hacking (models learn to manipulate feedback), human evaluator limitations (inconsistent judgments), accuracy degradation over time, model drift, and bias amplification.

**How to avoid:**
1. **Don't fine-tune the model** — Ollama doesn't support it easily anyway. Use feedback to adjust prompt context or category weights, not model parameters.
2. **Implement feedback as scoring adjustments:**
   - User downvotes high-scored article → reduce weight of its categories by 0.1
   - User upvotes low-scored article → increase weight of its categories by 0.1
   - Keep category weights bounded (0.0 to 2.0) to prevent runaway
3. **Add decay:** Older feedback loses influence over time (e.g., weights drift back toward 1.0 by 0.01 per day)
4. **Require multiple signals:** Don't adjust weights based on 1-2 votes. Need 5+ votes in same direction to change a category weight.
5. **Aggregate at category level:** Don't store per-article feedback scores — aggregate to category weights in UserPreferences JSON column to avoid separate feedback table complexity for single-user app.

**Warning signs:**
- Category weights drift to extremes (0.0 or 2.0)
- Composite scores cluster at min/max instead of distributing
- User complains "your scoring used to be good, now it's random"
- Feedback applied immediately after single vote

**Phase to address:**
Phase 3 (Feedback Loop) — Design feedback as weight adjustment, not model retraining. Test stability over 100+ feedback events with conflicting signals.

---

### Pitfall 4: SQLite JSON Column Mutation Not Detected by SQLAlchemy

**What goes wrong:**
User updates category weights via settings UI. Frontend shows new weights. But when articles get scored, they still use the old weights. Even explicit save() and commit() calls don't persist the changes. Restart doesn't help — the weights revert to their old values.

**Why it happens:**
SQLAlchemy does NOT detect in-place mutations to JSON columns. If you do `preferences.topic_weights['technology'] = 'high'`, SQLAlchemy doesn't mark the object as dirty because the dict object's identity hasn't changed — only its contents have.

This is a known SQLAlchemy limitation: "The JSON type in SQLAlchemy does not detect in-place mutations to the structure when used with the ORM." Using `MutableDict.as_mutable(JSON)` helps for scalar values, but changes to lists and nested dicts still won't be detected.

**How to avoid:**
1. **Full reassignment pattern** (already documented in AGENTS.md):
   ```python
   # WRONG - silently fails
   preferences.topic_weights['technology'] = 'high'

   # CORRECT - forces SQLAlchemy to detect change
   preferences.topic_weights = {**preferences.topic_weights, 'technology': 'high'}
   ```

2. **Alternative: Use sqlalchemy-json library** with `mutable_json_type(nested=True)` for automatic tracking

3. **Verify in tests:** After JSON column update, query object from fresh session and verify changes persisted

**Warning signs:**
- Config updates succeed but don't persist after restart
- Logs show correct values but database queries return old values
- Manual SQL queries show JSON column unchanged after update
- Random updates "work" while others don't (depending on whether reassignment happened)

**Phase to address:**
Phase 2 (Config UI), Phase 3 (Feedback Loop) — Any endpoint that updates `topic_weights` or other JSON columns MUST use full reassignment pattern. Add test coverage for persistence.

---

### Pitfall 5: SQLite ALTER TABLE Breaks Foreign Keys

**What goes wrong:**
Adding `feed_category_id` column to `feeds` table via migration. Migration runs without errors. App starts. But when user tries to delete a feed, they get a foreign key constraint violation. Or worse, deletion succeeds but doesn't cascade to articles, leaving orphaned data.

**Why it happens:**
SQLite's limited ALTER TABLE support requires dropping the table and rebuilding it for most schema changes. If foreign keys are enabled (`PRAGMA foreign_keys=ON`, which you have in database.py line 30), dropping a table that other tables reference will fail. The migration "succeeds" by temporarily disabling foreign keys, but this can break constraint enforcement or repointing behavior.

SQLite 3.26+ automatically repoints foreign key constraints during table renames, even when `foreign_keys` pragma is OFF. This breaks migrations that expect the old behavior.

**How to avoid:**
1. **For simple column additions** (like `feed_category_id`), use ALTER TABLE ADD COLUMN — this works in SQLite without table rebuild:
   ```python
   conn.execute(text("ALTER TABLE feeds ADD COLUMN category_id INTEGER"))
   ```
2. **Test with foreign_keys=ON** — Your app has this enabled, so migrations must work with it enabled
3. **For complex changes** (rename column, change type), use batch migration pattern:
   ```python
   # Disable foreign keys
   conn.execute(text("PRAGMA foreign_keys=OFF"))
   # Rename old table
   conn.execute(text("ALTER TABLE feeds RENAME TO feeds_old"))
   # Create new table with desired schema
   conn.execute(text("CREATE TABLE feeds (...)"))
   # Copy data
   conn.execute(text("INSERT INTO feeds SELECT ... FROM feeds_old"))
   # Drop old table
   conn.execute(text("DROP TABLE feeds_old"))
   # Re-enable foreign keys
   conn.execute(text("PRAGMA foreign_keys=ON"))
   ```
4. **Verify constraints after migration:** Run a test delete operation to ensure CASCADE still works

**Warning signs:**
- Migration logs show "foreign_keys pragma" warnings
- Deletion operations fail after migration that adds foreign key column
- Orphaned records appear in child tables after parent deletion
- Migration succeeds in test but fails in production (different SQLite versions)

**Phase to address:**
Phase 4 (Feed Organization) — Test the `feed_category_id` migration thoroughly with foreign keys enabled. Verify cascade deletion still works.

---

### Pitfall 6: SSE Connection Leak from Client Reconnections

**What goes wrong:**
After 10 minutes of the app being open, browser tabs slow down. DevTools shows 15 open SSE connections to `/api/sse/events`. Backend memory usage climbs steadily. Eventually hits OOM and container restarts.

**Why it happens:**
EventSource automatically reconnects when connection drops (network blip, load balancer timeout, server restart). If the server doesn't properly track and close stale connections, each reconnection adds a new connection without removing the old one. A user who leaves a tab open for hours accumulates dozens of zombie connections.

The problem is exacerbated by: (1) Traefik/proxy timeout closes connection but server's generator keeps running, (2) Client reconnects but server doesn't detect the old connection died, (3) No cleanup of connections for disconnected clients.

**How to avoid:**
1. **Track connections with client ID:**
   ```python
   active_connections: dict[str, asyncio.Queue] = {}

   async def sse_endpoint(client_id: str):
       if client_id in active_connections:
           # Close old connection before opening new one
           old_queue = active_connections[client_id]
           await old_queue.put(None)  # Signal shutdown

       queue = asyncio.Queue()
       active_connections[client_id] = queue
       try:
           # Stream events
       finally:
           del active_connections[client_id]
   ```

2. **Detect client disconnections:**
   ```python
   async def event_generator(request: Request):
       try:
           while True:
               if await request.is_disconnected():
                   break
               yield event
       except asyncio.CancelledError:
           # Client disconnected
           pass
   ```

3. **Set reasonable proxy timeouts** — Configure Traefik to timeout idle SSE connections after 5 minutes. This forces reconnection and cleanup.

4. **Send periodic heartbeats** — Comment lines (`: keepalive\n\n`) every 30s prevent proxy timeouts and confirm client is alive

**Warning signs:**
- DevTools shows multiple connections to same SSE endpoint
- Backend memory usage grows over time without corresponding load
- SSE endpoint handler count in logs doesn't decrease
- Container CPU usage high even when no scoring happening

**Phase to address:**
Phase 1 (SSE Infrastructure) — Implement connection tracking and cleanup before building features that depend on SSE. Monitor connection count in production.

---

### Pitfall 7: Feed Auto-Discovery Opens SSRF Vulnerability

**What goes wrong:**
User enters `http://internal-server.local/` in the "Add Feed" field to discover RSS feeds. Backend follows a redirect or HTML link to `http://localhost:6379/CONFIG GET dir` (Redis admin). Attacker now has a way to probe internal network and potentially extract secrets or reconfigure services.

**Why it happens:**
Auto-discovery parses HTML from user-provided URL and follows `<link rel="alternate" type="application/rss+xml">` tags. If you fetch these URLs without validation, an attacker can:
1. Point feed URL to a malicious site that redirects to internal IPs
2. Host HTML with `<link>` pointing to internal services
3. Use this to scan internal network (timing attacks) or exploit unsecured internal APIs

Recent CVEs (GHSA-r57v-j88m-rwwf, GHSA-r55v-q5pc-j57f) show SSRF in RSS feed handling is a real attack vector.

**How to avoid:**
1. **Block private IP ranges** before making HTTP request:
   ```python
   from ipaddress import ip_address
   import socket

   def is_private_ip(hostname: str) -> bool:
       try:
           addr = ip_address(socket.gethostbyname(hostname))
           return addr.is_private or addr.is_loopback or addr.is_link_local
       except:
           return True  # Block if resolution fails

   if is_private_ip(parsed_url.hostname):
       raise ValueError("Private IP addresses not allowed")
   ```

2. **Validate schemes** — Only allow `http://` and `https://`, block `file://`, `ftp://`, etc.

3. **Limit redirects** — httpx default is 20 redirects. Set to 2-3 max.

4. **Timeout aggressively** — Set 5-second timeout for auto-discovery requests

5. **Don't follow all `<link>` tags blindly** — Parse only `rel="alternate"` with `type` matching RSS/Atom MIME types

6. **Sanitize and validate all user input** — LLM applications have specific SSRF risks. Use allowlists for structural elements, denylists for known malicious patterns.

**Warning signs:**
- Security scanner flags SSRF in feed creation endpoint
- User can trigger requests to arbitrary internal IPs
- Logs show requests to `localhost`, `127.0.0.1`, `169.254.x.x`, `10.x.x.x`
- Feed creation timeout increased to handle slow internal network scans

**Phase to address:**
Phase 5 (Feed Auto-Discovery) — MUST implement IP blocking before enabling this feature. If it's hard to secure, consider cutting the feature or making it admin-only.

---

### Pitfall 8: Race Condition When Ollama Model Switching During Scoring

**What goes wrong:**
User changes Ollama model from `qwen3:8b` to `llama3:8b` via Config UI. In the 30 seconds it takes Ollama to unload old model and load new one, scoring queue tries to process articles. Some articles get scored with qwen3, some fail with "model not loaded" errors, some get scored with llama3. Articles table has inconsistent scores from mixed models, breaking score comparisons.

**Why it happens:**
Ollama unloads models after inactivity. When switching models in config, the next scoring request triggers load of new model. If scoring queue processes batch of 5 articles and model switch happens mid-batch, Ollama might be in transition state. `OLLAMA_MAX_LOADED_MODELS` (default: 3) means old model might still be in memory, or might be evicted before new model loads.

With `OLLAMA_NUM_PARALLEL=1`, concurrent scoring requests queue in Ollama. If categorization_model and scoring_model are different and both are loading, requests can timeout.

**How to avoid:**
1. **Pause scoring queue during config updates:**
   ```python
   # In config update endpoint:
   scoring_queue.pause()
   get_settings.cache_clear()
   settings = get_settings()
   # Preload models
   await client.chat(model=settings.ollama.categorization_model, messages=[...])
   await client.chat(model=settings.ollama.scoring_model, messages=[...])
   scoring_queue.resume()
   ```

2. **Add retry with model-specific backoff** — If scoring fails with "model not found", wait 30s (time for Ollama to load) and retry

3. **Validate model exists before saving config:**
   ```python
   async def validate_ollama_model(model_name: str, host: str):
       client = AsyncClient(host=host)
       models = await client.list()
       if model_name not in [m['name'] for m in models['models']]:
           raise ValueError(f"Model {model_name} not found in Ollama")
   ```

4. **Use same model for categorization and scoring** — Simplifies memory management and reduces model swaps. For 8GB RAM, loading two 8B models might swap constantly.

5. **Use Ollama API for health checks** — The `/api/tags` endpoint is reliable for checking model availability. Test connection with appropriate timeouts (2s for local, 5s+ for remote).

**Warning signs:**
- Scoring errors spike after config changes
- Articles have `scoring_state='failed'` with "model not loaded" in logs
- Inconsistent score distribution after model change (some articles scored by old model)
- Ollama logs show rapid model load/unload cycles

**Phase to address:**
Phase 2 (Config UI) — Implement queue pausing and model preload validation before exposing model switching to users.

---

### Pitfall 9: Hierarchical Category Weight Resolution Confusion

**What goes wrong:**
User organizes categories into hierarchy: `technology` parent has `ai`, `blockchain`, `web-dev` children. Sets `technology` weight to "high" (2.0) and `ai` to "blocked" (0.0). Expects AI articles blocked, other tech articles boosted. Instead, AI articles still appear with high scores because parent weight overrides child.

**Why it happens:**
Weight inheritance with cascading creates ambiguous resolution rules: Does parent weight apply to all children? Do child weights override parents? What about partial overlaps? If an article has both `ai` and `blockchain` tags, which weight wins?

This is a known pitfall in hierarchical classification systems: error propagation where misclassification at higher levels cascades down, leading to incorrect predictions at all subsequent levels. A product wrongly categorized as "Electronics" instead of "Furniture" makes all furniture subcategories inaccessible.

Data imbalance within hierarchies makes this worse — certain branches have disproportionately more samples, so models prioritize larger categories while semantically important smaller categories are underrepresented.

**How to avoid:**
1. **Keep categories flat** (recommended for v1.1) — Single-level category list, no parent/child relationships. Article gets multiple categories, each with independent weight.

2. **If hierarchy needed** (v2.0+), use explicit resolution rules:
   - **Most specific wins:** Child weight overrides parent if both present
   - **Blocked is absolute:** If any category (parent or child) is blocked, score = 0
   - **Document clearly:** Show resolution rules in UI near category weight settings

3. **Avoid automatic category creation** — LLM-generated categories lead to unbounded growth and naming inconsistencies. Use fixed taxonomy with periodic manual review.

4. **Test weight resolution thoroughly:**
   ```python
   # Test case: article with ['ai', 'technology'] categories
   # Parent 'technology' = high (2.0), child 'ai' = blocked (0.0)
   # Expected: composite_score = 0 (blocked wins)
   assert compute_composite_score(...) == 0
   ```

**Warning signs:**
- Users confused about why blocked subcategory articles still appear
- Category weight changes have unexpected effects
- Articles with multiple categories score inconsistently
- Support questions: "How do parent/child weights interact?"

**Phase to address:**
Phase 4 (Category Grouping) — If adding hierarchy, define explicit resolution rules upfront. For v1.1, recommend keeping flat structure documented in FEATURES-v1.1.md.

---

### Pitfall 10: Chakra UI v3 Portal Performance with Many Components

**What goes wrong:**
Sidebar shows 50 feeds, each with a Menu (three-dot options). Page feels sluggish. Opening a menu takes 200-300ms. DevTools shows thousands of CSSStyleSheet instances. After navigating between pages a few times, browser tab becomes unresponsive.

**Why it happens:**
Chakra v3's Portal/Positioner pattern creates dynamic styles for positioning. If 50 Menu components are mounted (even if closed), each one creates CSSStyleSheet instances for potential positioning. With SSE pushing updates every few seconds causing re-renders, new stylesheets accumulate without garbage collection. This is a known issue (chakra-ui/chakra-ui#8706, #9698).

Emotion's CSS-in-JS generates new styles for dynamic props. If menu positioning props change on each render, new styles are injected on every update.

**How to avoid:**
1. **Lazy mount Portals** — Don't mount Menu until user clicks trigger:
   ```tsx
   {isOpen && (
     <Portal>
       <Menu.Positioner>
         <Menu.Content>...</Menu.Content>
       </Menu.Positioner>
     </Portal>
   )}
   ```

2. **Limit number of menus mounted** — Virtualize long feed lists (react-window), only mount visible feeds

3. **Memoize menu positioning** — Prevent unnecessary re-renders:
   ```tsx
   const positioning = useMemo(() => ({ placement: 'bottom-end' }), [])
   ```

4. **Monitor CSSStyleSheet count** — Add dev warning if count exceeds threshold:
   ```tsx
   useEffect(() => {
     const count = document.styleSheets.length
     if (count > 500) console.warn('High stylesheet count:', count)
   }, [])
   ```

5. **Use Chakra v3.7+** — Performance improvements landed in later v3 releases

**Warning signs:**
- DevTools Performance tab shows long "Recalculate Style" times
- `document.styleSheets.length` grows unbounded
- Menu open animation stutters
- Browser tab memory usage climbs during active use

**Phase to address:**
Phase 6 (UI Polish) — Implement lazy mounting for all Portal-based components. Test with 100+ feeds to verify performance.

---

### Pitfall 11: Chakra UI v3 Theme Token Changes Break Components

**What goes wrong:**
During UI polish phase, designer updates theme colors or semantic tokens. After applying changes, existing components render incorrectly: buttons lose their background, borders disappear, text becomes unreadable. Rolling back the theme changes fixes it, but you can't identify which components broke or why.

**Why it happens:**
Chakra v3 requires specific semantic token structure for `colorPalette` resolution. If custom colors don't define `solid`, `contrast`, `fg`, `muted`, `subtle`, `emphasized`, and `focusRing` tokens, components using `colorPalette="accent"` will fail to resolve colors and render with missing styles.

Visual breaking changes in design systems are common: darkening a Card background can break adopter's content that fails color contrast tests. Changing spatial properties (padding, margin, width, height, display) risks impacting layout composition that arranges components with other page elements.

Token value changes require wrapping in `{ value: "..." }` objects in v3, and `colorScheme` prop has changed to `colorPalette`. Missing these migrations causes silent rendering failures.

**How to avoid:**
1. **Verify semantic token completeness** before theme changes:
   ```typescript
   // All colorPalette values need these tokens
   const requiredTokens = ['solid', 'contrast', 'fg', 'muted', 'subtle', 'emphasized', 'focusRing']
   ```

2. **Test with real components** after theme changes — Don't just check theme file compiles, verify Button, Menu, Badge, Tag components render correctly with the new theme

3. **Use Chakra's built-in testing utilities** — Render components with new theme and snapshot test outputs

4. **Avoid changing spatial properties** in existing semantic tokens — These break layout. Add new tokens for new spacing needs.

5. **Document theme dependencies** — Note which components depend on which semantic tokens so changes can be risk-assessed

**Warning signs:**
- Components render with missing backgrounds or borders after theme update
- Console warnings about unresolved color tokens
- Contrast checker fails after updating colors
- Layout shifts after updating spacing tokens

**Phase to address:**
Phase 6 (UI Polish) — Before applying theme changes, verify all required semantic tokens exist and test with representative component set.

---

### Pitfall 12: Stale TypeScript Diagnostics After File Edits

**What goes wrong:**
Executor agent modifies `ArticleList.tsx` to add SSE support. VS Code shows red squiggles — "Property 'onArticleScored' does not exist". But the code runs fine. Running `npx tsc --noEmit` shows no errors. The red squiggles persist for minutes or until restarting TS server.

**Why it happens:**
VS Code's TypeScript language server caches type information. When files are edited externally (by agents, not through VS Code), the TS server doesn't always invalidate its cache. The stale diagnostics are false positives — the code is correct, but the TS server hasn't re-analyzed dependencies.

This is especially common with:
- Type changes in barrel exports (`src/lib/types.ts`)
- Hook signature changes (`src/hooks/useArticles.ts`)
- Adding new component props that reference newly added types

**How to avoid:**
1. **Don't trust diagnostics after agent edits** — Always run `npx tsc --noEmit` to get ground truth
2. **Restart TS server after agent edits** — In VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
3. **Configure TS server to watch mode** — In `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "incremental": true,
       "tsBuildInfoFile": ".tsbuildinfo"
     }
   }
   ```
4. **Agent should verify types** — Add `npx tsc --noEmit` to agent's verification checklist before marking task complete

**Warning signs:**
- Red squiggles appear after agent edit but code runs fine
- `bun dev` compiles successfully despite editor errors
- Restarting TS server makes errors disappear
- Errors reference types that clearly exist in the codebase

**Phase to address:**
All phases — This is a tooling issue, not a code issue. Executors should always verify with `tsc` before declaring success.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip SSE heartbeats | Simpler implementation | Connections timeout through proxies, users see stale data | Never (heartbeats are 2 lines of code) |
| Use polling instead of SSE | Avoid SSE complexity | Higher server load, delayed updates, poor UX | MVP only, remove in Phase 1 |
| Allow all IPs in feed discovery | Easier implementation | SSRF vulnerability, security risk | Never (IP blocking is ~10 lines) |
| Share same Ollama model for categorization and scoring | Lower memory usage | Less flexibility to tune | Acceptable (can change later without breaking data) |
| Manual ALTER TABLE migrations | No migration framework needed | Risk of human error, foreign key issues | Acceptable for this project (simple schema, single user) |
| Disable foreign keys during migration | Migration "works" | Orphaned data, constraint violations | Only if immediately re-enabled and tested |
| Skip feedback signal aggregation | Instant feedback response | Scoring drift from noisy signals | Never (leads to user distrust) |
| Store all SSE clients in memory | Simple connection tracking | Memory leak if not cleaned up | Acceptable if cleanup is implemented |
| Skip category weight bounds | Simpler math | Weights can drift to extremes, scoring breaks | Never (bounds checking is 1 line) |
| Flat category structure | Simple to implement | Less organizational flexibility | Acceptable for v1.1 (can add hierarchy in v2.0) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Ollama | Assume model is loaded before scoring | Preload model during config change or validate model exists before enqueueing articles |
| Traefik SSE | Default config (buffering enabled) | Add middleware to disable buffering for SSE routes, test with `curl -N` |
| SQLite migrations | ALTER TABLE without checking foreign_keys pragma | Test migrations with `PRAGMA foreign_keys=ON` (your production config) |
| SQLite JSON columns | Mutate in place (e.g., `dict['key'] = value`) | Full reassignment (e.g., `dict = {**dict, 'key': value}`) to trigger SQLAlchemy change detection |
| Pydantic Settings | Assume config reloads automatically | Call `get_settings.cache_clear()` after writing new config, test with integration test |
| feedparser | Trust all `<link>` tags in HTML | Validate scheme, block private IPs, limit redirects, timeout aggressively |
| EventSource browser API | Assume reconnection is handled | Implement server-side cleanup for duplicate connections, send heartbeats |
| Chakra UI Portal | Mount all Portals eagerly | Lazy mount Portal components, virtualize long lists |
| Chakra UI theme tokens | Change existing tokens | Add new tokens for new needs, avoid changing spatial properties |
| Hierarchical categories | Implicit weight inheritance | Define explicit resolution rules, document clearly, or use flat structure |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eager Portal mounting | Sluggish UI, high stylesheet count | Lazy mount Portals, virtualize lists | ~50+ Menu/Popover/Tooltip components mounted |
| No SSE connection limit | Memory grows unbounded | Limit to 1 connection per client ID, cleanup on disconnect | ~100+ concurrent connections (10+ browser tabs open) |
| Synchronous Ollama calls in scoring queue | Queue processing blocks | Already async with AsyncClient, verify no blocking calls | N/A (already implemented correctly) |
| No pagination in categories list | Slow query as categories grow | Acceptable (single-user app, categories grow slowly, ~100 max) | ~1000+ categories (unlikely) |
| Re-score all articles on preference change | Queue backlog, delayed scores | Only re-score recent unread articles (already implemented in `enqueue_recent_for_rescoring`) | N/A (already limited to recent) |
| SQLite without WAL mode | Database locked errors under load | Already enabled in database.py | N/A (already using WAL) |
| Unbounded category weight drift | Composite scores become extreme | Bound weights to [0.0, 2.0] range in feedback adjustment logic | After 100+ feedback events without bounds |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No IP validation in feed URLs | SSRF, internal network scanning | Block private IP ranges before making HTTP requests |
| No timeout on feed fetch | Slowloris-style DoS (attacker serves feed slowly) | Set 5s timeout for feed fetch, 10s for auto-discovery |
| Allow `file://` scheme in feed URLs | Local file disclosure | Whitelist only `http://` and `https://` |
| Trust feedparser output without sanitization | XSS via article content (if rendering raw HTML) | Already safe (storing text in DB, rendering with React's auto-escaping) |
| No rate limiting on config updates | Config thrash, excessive Ollama model loads | Add cooldown: 1 config update per 60s |
| Expose Ollama host directly to frontend | Users can bypass scoring, query models directly | Correct (Ollama on internal network, backend proxies requests) |
| No input validation for LLM config | Injection attacks via model names, prompt manipulation | Sanitize and validate all user input, use allowlists for structural elements |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback while config applies | User clicks "Save", sees success, but changes don't apply for 30s (model loading) | Show loading state: "Applying config, loading model..." with progress |
| Silent scoring failures | Articles stuck in "scoring" state forever | Add retry limit, move to "failed" state after 3 retries, show error in UI |
| No indication of SSE connection status | User doesn't know if real-time updates are working | Add subtle connection indicator (green dot in corner, gray if disconnected) |
| Blocked articles vanish | User blocks a category, articles disappear, user confused | Move to "Blocked" tab, allow user to unblock from there |
| Re-score queues everything | User updates interests, all 500 articles show "scoring" | Only re-score recent unread (already implemented), show "X articles queued for re-scoring" |
| Auto-discovery returns 50 feeds | Overwhelms user with choices | Limit to 5 most relevant (RSS/Atom only, skip comment feeds), let user enter URL manually |
| Hierarchical category confusion | User unsure how parent/child weights interact | Use flat structure, or document resolution rules clearly with examples |
| Feedback applied instantly | Single downvote changes category weight, scoring feels unstable | Aggregate feedback, require 5+ signals before adjusting weights |

## "Looks Done But Isn't" Checklist

- [ ] **SSE Implementation:** Often missing heartbeats — verify proxy doesn't timeout idle connections (test by leaving tab open 5 minutes)
- [ ] **SSE Implementation:** Often missing connection cleanup — verify client count decreases after tab close (check server logs)
- [ ] **SSE Implementation:** Often missing buffering config — verify events arrive instantly (test through production proxy, not localhost)
- [ ] **Config UI:** Often missing cache invalidation — verify scoring uses new model after config change (score article, check Ollama logs)
- [ ] **Config UI:** Often missing model validation — verify saving invalid model name shows error (test with `nonexistent:8b`)
- [ ] **Config UI:** Often missing queue pausing — verify no scoring errors during model switch (change model, check failed articles count)
- [ ] **Feedback Loop:** Often missing signal aggregation — verify single vote doesn't change weights drastically (test with 1 downvote, check topic_weights)
- [ ] **Feedback Loop:** Often missing weight bounds — verify weights can't drift to extremes (simulate 100 upvotes, check weight ≤ 2.0)
- [ ] **JSON Column Updates:** Often missing full reassignment — verify topic_weights persist after restart (update via API, restart, check DB)
- [ ] **Feed Organization:** Often missing CASCADE test — verify deleting category deletes/orphans feeds correctly (delete category, check feeds table)
- [ ] **Feed Auto-Discovery:** Often missing SSRF protection — verify `http://localhost` returns error (test with internal IP)
- [ ] **Feed Auto-Discovery:** Often missing timeout — verify slow feed doesn't hang server (test with `http://httpstat.us/200?sleep=30000`)
- [ ] **Category Hierarchy:** Often missing resolution rules — verify blocked subcategory blocks articles even if parent is high (if implementing hierarchy)
- [ ] **Theme Changes:** Often missing semantic token validation — verify all colorPalette components render after theme update

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale config cache | LOW | Restart backend container, config applies immediately |
| Scoring drift from bad feedback | MEDIUM | Reset `topic_weights` to default, re-score last 7 days of articles |
| SQLite foreign key corruption | HIGH | Restore from backup (if enabled), recreate schema, re-fetch all feeds |
| SQLite JSON mutation lost | LOW | Re-apply config via UI, verify with fresh query |
| SSE connection leak OOM | LOW | Restart backend, implement connection tracking to prevent recurrence |
| SSRF vulnerability exploited | MEDIUM | Check access logs for internal IPs, patch IP validation, rotate secrets if internal services accessed |
| Portal stylesheet leak | LOW | User refreshes page (clears stylesheets), implement lazy mounting to prevent recurrence |
| Ollama model not loaded | LOW | Wait 30s for model to load, or restart ollama container to clear state |
| Category weight drift | MEDIUM | Reset to defaults, implement bounds checking, re-score recent articles |
| Theme breaks components | LOW | Revert theme changes, verify semantic tokens, re-test components |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SSE buffering through Traefik | Phase 1 (SSE Infrastructure) | `curl -N` through production URL, events arrive individually |
| SSE connection leak | Phase 1 (SSE Infrastructure) | Monitor client count, open/close tabs, count decreases |
| Stale config cache | Phase 2 (Config UI) | Change model via API, score article, verify new model in Ollama logs |
| SQLite JSON mutation not detected | Phase 2 (Config UI) | Update topic_weights, restart app, verify changes persisted |
| Ollama model switching race | Phase 2 (Config UI) | Change model, immediately trigger scoring, verify no errors |
| Scoring drift from feedback | Phase 3 (Feedback Loop) | Simulate 100 conflicting votes, verify weights stay in bounds |
| Foreign key issues in migration | Phase 4 (Feed Organization) | Add category column, delete category, verify cascades |
| Category weight resolution confusion | Phase 4 (Category Grouping) | If implementing hierarchy, test blocked child with high parent |
| SSRF in auto-discovery | Phase 5 (Feed Auto-Discovery) | Test with `http://localhost`, `http://169.254.169.254`, verify blocked |
| Portal stylesheet leak | Phase 6 (UI Polish) | Open page with 100 feeds, check `document.styleSheets.length < 500` |
| Theme breaks components | Phase 6 (UI Polish) | Update theme, verify Button/Menu/Badge render correctly |
| Stale TypeScript diagnostics | All phases | Run `npx tsc --noEmit` after agent edits, verify no errors |

## Sources

**SSE + Traefik:**
- [Problem with streaming SSE server behind traefik - Traefik v2](https://community.traefik.io/t/problem-with-streaming-sse-server-behind-traefik/23007)
- [Help with proxying a Server Sent Event - Traefik v3](https://community.traefik.io/t/help-with-proxying-a-server-sent-event/25812)
- [Server-Side event in traefik? nginx ok - traefik => internal server error](https://community.traefik.io/t/server-side-event-in-traefik-nginx-ok-traefik-internal-server-error/12625)

**Pydantic Settings + lru_cache:**
- [Settings and Environment Variables - FastAPI](https://fastapi.tiangolo.com/advanced/settings/)
- [Pydantic BaseSettings hot-reload · pydantic/pydantic · Discussion #3048](https://github.com/pydantic/pydantic/discussions/3048)
- [Settings Management - Pydantic Validation](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)

**LLM Feedback Loops:**
- [Continual Learning with RL for LLMs](https://cameronrwolfe.substack.com/p/rl-continual-learning)
- [MIT's new fine-tuning method lets LLMs learn new skills without losing old ones | VentureBeat](https://venturebeat.com/orchestration/mits-new-fine-tuning-method-lets-llms-learn-new-skills-without-losing-old)
- [Handling LLM Model Drift in Production Monitoring, Retraining, and Continuous Learning](https://www.rohan-paul.com/p/ml-interview-q-series-handling-llm)
- [Catastrophic Forgetting In LLMs | by Cobus Greyling | Medium](https://cobusgreyling.medium.com/catastrophic-forgetting-in-llms-bf345760e6e2)
- [Reinforcement learning from human feedback - Wikipedia](https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback)
- [What is RLHF? - Reinforcement Learning from Human Feedback Explained - AWS](https://aws.amazon.com/what-is/reinforcement-learning-from-human-feedback/)
- [Open Problems and Fundamental Limitations of Reinforcement Learning from Human Feedback | OpenReview](https://openreview.net/forum?id=bx24KpJ4Eb)

**Feedback Loop Data Modeling:**
- [ANALYSIS OF HIDDEN FEEDBACK LOOPS IN CONTINUOUS MACHINE LEARNING SYSTEMS](https://arxiv.org/pdf/2101.05673)
- [13. Feedback Loops - Building Machine Learning Pipelines](https://www.oreilly.com/library/view/building-machine-learning/9781492053187/ch13.html)
- [Concept | Monitoring and feedback in the AI project lifecycle - Dataiku Knowledge Base](https://knowledge.dataiku.com/latest/mlops-o16n/model-monitoring/concept-monitoring-feedback.html)

**Hierarchical Categories:**
- [Enhancing Hierarchical Classification in Tree-Based Models Using Level-Wise Entropy Adjustment](https://www.mdpi.com/2504-2289/9/3/65)

**SQLite Migrations:**
- [SQLite Foreign Key Support](https://sqlite.org/foreignkeys.html)
- [#29182 (SQLite 3.26 breaks database migration ForeignKey constraint) – Django](https://code.djangoproject.com/ticket/29182)
- [Foreign keys prevent table altering migrations on SQLite when foreign keys pragma is on · Issue #4155 · knex/knex](https://github.com/knex/knex/issues/4155)
- [Running "Batch" Migrations for SQLite and Other Databases — Alembic](https://alembic.sqlalchemy.org/en/latest/batch.html)

**SQLite JSON Columns:**
- [Beware of JSON fields in SQLAlchemy - Adrià Mercader](https://amercader.net/blog/beware-of-json-fields-in-sqlalchemy/)
- [JSON attribute update is not detected if original ORM object was also modified · sqlalchemy/sqlalchemy · Discussion #11004](https://github.com/sqlalchemy/sqlalchemy/discussions/11004)
- [GitHub - edelooff/sqlalchemy-json: Full-featured JSON type with mutation tracking for SQLAlchemy](https://github.com/edelooff/sqlalchemy-json)

**SSRF in Feed Handling:**
- [Blind Server-Side Request Forgery (SSRF) in RSS feeds](https://github.com/glpi-project/glpi/security/advisories/GHSA-r57v-j88m-rwwf)
- [There is an SSRF vulnerability in ReadRSSFeedBlock](https://github.com/Significant-Gravitas/AutoGPT/security/advisories/GHSA-r55v-q5pc-j57f)
- [LLM Input Validation & Sanitization | Secure AI](https://apxml.com/courses/intro-llm-red-teaming/chapter-5-defenses-mitigation-strategies-llms/input-validation-sanitization-llms)
- [LLM Prompt Injection Prevention - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

**SSE Connection Lifecycle:**
- [Using server-sent events - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Real-Time Notifications in Python: Using SSE with FastAPI | by İnan DELİBAŞ | Medium](https://medium.com/@inandelibas/real-time-notifications-in-python-using-sse-with-fastapi-1c8c54746eb7)
- [FastAPI + SSE for LLM Tokens: Smooth Streaming without WebSockets | by Nikulsinh Rajput | Jan, 2026 | Medium](https://medium.com/@hadiyolworld007/fastapi-sse-for-llm-tokens-smooth-streaming-without-websockets-001ead4b5e53)

**SSE Connection Tracking:**
- [Server-Sent Events: A Practical Guide for the Real World](https://tigerabrodi.blog/server-sent-events-a-practical-guide-for-the-real-world)
- [SSE Connection Best Practices](https://help.validic.com/space/VCS/2526314497/SSE+Connection+Best+Practices)
- [Possible connection leak? A new SSE connection is opened on every onerror](https://github.com/Yaffle/EventSource/issues/144)

**Ollama API & Health Checks:**
- [Olla Health Checking - Automated Endpoint Monitoring - Olla](https://thushan.github.io/olla/concepts/health-checking/)
- [Is there a health check endpoint? · Issue #1378 · ollama/ollama](https://github.com/ollama/ollama/issues/1378)
- [ollama/docs/api.md at main · ollama/ollama](https://github.com/ollama/ollama/blob/main/docs/api.md)

**Ollama Concurrency:**
- [Parallel Computing Support for Concurrent Ollama Requests · Issue #11277](https://github.com/ollama/ollama/issues/11277)
- [How Ollama Handles Parallel Requests - Rost Glukhov](https://www.glukhov.org/post/2025/05/how-ollama-handles-parallel-requests/)
- [Does Ollama Use Parallelism Internally? - Collabnix](https://collabnix.com/does-ollama-use-parallelism-internally/)

**Chakra UI v3 Performance:**
- [Excessive CSSStyleSheet instances leaking · chakra-ui/chakra-ui · Discussion #8706](https://github.com/chakra-ui/chakra-ui/discussions/8706)
- [Performance extreme degradation since 3.6 to current · Issue #9698](https://github.com/chakra-ui/chakra-ui/issues/9698)
- [Unleashing the Plumbing Superhero: Fixing a Memory Leak caused by Emotion, Chakra-UI, and Dynamic Props!](https://engineering.deptagency.com/unleashing-the-plumbing-superhero-fixing-a-memory-leak-with-emotion-chakra-ui-and-dynamic-props)

**Chakra UI v3 Theme & Migration:**
- [Migration to v3 | Chakra UI](https://chakra-ui.com/docs/get-started/migration)
- [Chakra UI v2 to v3 - The Hard Parts | Codygo](https://codygo.com/blog/chakra-ui-v2-to-v3-easy-migration-guide/)
- [Visual Breaking Change in Design Systems | by Nathan Curtis | EightShapes | Medium](https://medium.com/eightshapes-llc/visual-breaking-change-in-design-systems-1e9109fac9c4)
- [Theming in Modern Design Systems](https://whoisryosuke.com/blog/2020/theming-in-modern-design-systems)

---
*Pitfalls research for: RSS Reader with LLM Scoring + SSE + Runtime Config*
*Researched: 2026-02-14*
