# Feature Research: v1.1 Milestone

**Domain:** RSS Reader Configuration, Real-Time Updates, and LLM Feedback
**Researched:** 2026-02-14
**Confidence:** MEDIUM (HIGH for standard patterns, MEDIUM for LLM feedback integration due to emerging best practices)

## Context

This research focuses specifically on v1.1 milestone features for an existing RSS reader with LLM scoring. The base product already has:
- Article list with score badges, sort by score/date, filter tabs
- Article reader drawer with auto-mark-as-read
- Feed management: add, remove, rename, reorder
- Settings page with prose preferences and category weights
- LLM two-step pipeline: categorize → score

**v1.1 Goals:** Add configuration UI, real-time updates, feedback mechanisms, feed organization, and feed discovery.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Feed organization (folders/categories) | Core to RSS workflow — managing 50+ feeds without folders is painful | LOW | Hierarchical structure, drag-and-drop reordering, folder-level operations (mark all read, refresh) |
| Real-time updates when content changes | Modern web apps don't require manual refresh in 2026 | MEDIUM | SSE is standard pattern for one-way server→client push, simpler than WebSockets |
| Model configuration visibility | Local LLM users expect to see/control which model is running | LOW | Model picker, connection health indicator, basic parameters (temperature, context length) |
| Feed auto-discovery from URLs | Users paste blog URLs, not RSS URLs | LOW | Parse `<link type="application/rss+xml">` from HTML head, fallback to common paths (/feed, /rss, /atom.xml) |
| OPML import/export | RSS users switch readers frequently, need portability | LOW | OPML is XML format with feed list + folder structure, standard library support |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| LLM feedback loop (implicit + explicit) | The killer feature — scoring gets better as you use it | HIGH | Combine implicit signals (read time, scroll depth, immediate close) with explicit feedback (thumbs up/down, "more/less like this"). Meta's 2026 approach: 59.5%→71.5% accuracy by adding direct feedback to engagement signals. |
| Editable scoring prompts | Users see/modify LLM instructions, transparency builds trust | MEDIUM | Show current system prompts for categorize/score operations, allow editing with preview, validate before applying |
| Scoring transparency/explainability | Users understand WHY article got its score | LOW | Already have `score_reasoning` field — surface it in UI with expandable details |
| Real-time scoring progress | Show articles moving through pipeline | LOW | SSE updates when article transitions: `unscored→queued→scoring→scored`, with progress indicators |
| Score confidence indicators | Surface uncertainty when LLM isn't sure | MEDIUM | Track variance in scores across multiple LLM runs or use model confidence metrics, show as visual indicator |
| Category weight tuning per feed | Different feeds need different sensitivity | MEDIUM | Override global category weights at feed level (e.g., tech newsletters get higher weight for "technology" category) |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-user accounts | "What if my partner wants to use it?" | Adds auth, permissions, data isolation — massive complexity for single-user app | Deploy separate instance (Docker makes this trivial), keep architecture simple |
| Social features (share, comment, upvote) | "Like Reddit for RSS" | Requires user accounts, backend infrastructure, moderation, completely changes product focus | Keep personal, focus on curation. Export interesting articles to external tools. |
| Cloud sync | "I want it on phone and desktop" | Requires hosted backend, auth, conflict resolution, ongoing costs | Local-first design allows future P2P sync (Syncthing, Tailscale) without architecture changes |
| Real-time collaborative folders | "Share feeds with team" | Operational transforms, conflict resolution, presence — engineering nightmare | Export OPML, share via file. Keep single-user simplicity. |
| Automatic category creation | "Let LLM invent new categories" | Category drift, no user control, breaks weight tuning, makes scoring unstable | Fixed category taxonomy with periodic review, explicit user-driven updates |
| Full article re-scoring on preference changes | "Update all 10,000 articles when I change interests" | Expensive, slow, blocks pipeline, wastes LLM cycles | Score new articles with updated preferences, let old scores age out naturally |

---

## Feature Dependencies

```
[Feed Categories/Folders]
    └──requires──> [Folder-level operations]
                       └──requires──> [Batch article updates]

[Real-Time Push (SSE)]
    ├──enhances──> [Scoring Progress UI]
    ├──enhances──> [Live Feed Updates]
    └──enhances──> [Feedback Loop Responsiveness]

[LLM Feedback Loop]
    ├──requires──> [Feedback Data Storage]
    ├──requires──> [Scoring Pipeline Modification]
    └──enhances──> [Score Transparency]

[Editable Prompts]
    ├──requires──> [Prompt Validation]
    └──requires──> [Prompt Versioning]

[Feed Auto-Discovery]
    └──requires──> [HTML Parsing Library]

[Score Confidence Indicators]
    ├──requires──> [Multiple Scoring Runs] (expensive)
    └──conflicts──> [Fast Scoring Pipeline]
```

### Dependency Notes

- **Feed Categories requires Batch Operations:** Folder context actions (mark all read, refresh all) need efficient batch processing to avoid N+1 queries
- **SSE enhances multiple features:** Real-time push is architectural foundation that makes scoring progress, live updates, and feedback responsiveness feel instant
- **LLM Feedback Loop requires pipeline changes:** Can't just store feedback — must integrate into scoring algorithm (re-weight categories, adjust interest calculations, modify prompts)
- **Editable Prompts requires validation:** Users can break scoring with malformed prompts — need syntax validation, test run capability, rollback
- **Score Confidence conflicts with speed:** Running multiple scoring passes to measure variance is expensive (5-10x slower), conflicts with 30-second batch pipeline

---

## MVP Definition

This is for v1.1 (milestone after basic RSS reading is complete).

### Launch With (v1.1)

Features needed to deliver on the "configuration and feedback" promise.

- [ ] **Ollama Config UI** — Model picker, connection health, basic parameters (temperature, context window)
- [ ] **Real-Time Push (SSE)** — Instant updates when articles finish scoring, no manual refresh needed
- [ ] **Feed Categories** — Hierarchical folders, drag-and-drop, folder-level mark-as-read
- [ ] **Feed Auto-Discovery** — Parse RSS links from website URLs, handle common feed paths
- [ ] **Basic Feedback Loop** — Thumbs up/down on articles, store for future use (don't integrate into scoring yet)
- [ ] **Prompt Visibility** — Show current categorization and scoring prompts in settings (read-only)

### Add After Validation (v1.2)

Features to add once core feedback mechanisms are proven.

- [ ] **Editable Prompts** — Allow users to modify system prompts with validation and preview
- [ ] **Implicit Feedback Tracking** — Record read time, scroll depth, immediate close signals
- [ ] **Feedback-Driven Scoring** — Integrate feedback into scoring algorithm (category weight adjustments, interest score modifications)
- [ ] **Score Transparency** — Expandable reasoning in article cards showing why LLM assigned the score
- [ ] **Keyboard Shortcuts** — j/k navigation, r for refresh, m for mark read, etc.
- [ ] **OPML Import/Export** — Feed list portability

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Score Confidence Indicators** — Visual representation of scoring uncertainty (requires multiple LLM passes)
- [ ] **Per-Feed Category Weights** — Override global weights at feed level for specialized sources
- [ ] **Advanced Implicit Signals** — Click patterns, search-after-reading, bookmark timing
- [ ] **Prompt Versioning** — Track prompt changes over time, A/B test prompts
- [ ] **Batch Feedback Actions** — "More like these 5 articles" instead of one-by-one
- [ ] **Feedback Analytics** — Dashboard showing how feedback improves scoring accuracy over time

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Ollama Config UI | HIGH | LOW | P1 |
| Real-Time Push (SSE) | HIGH | MEDIUM | P1 |
| Feed Categories | HIGH | LOW | P1 |
| Feed Auto-Discovery | MEDIUM | LOW | P1 |
| Basic Feedback Loop | HIGH | LOW | P1 |
| Prompt Visibility | MEDIUM | LOW | P1 |
| Editable Prompts | MEDIUM | MEDIUM | P2 |
| Implicit Feedback Tracking | HIGH | MEDIUM | P2 |
| Feedback-Driven Scoring | HIGH | HIGH | P2 |
| Score Transparency | MEDIUM | LOW | P2 |
| Keyboard Shortcuts | MEDIUM | MEDIUM | P2 |
| OPML Import/Export | LOW | LOW | P2 |
| Score Confidence | LOW | HIGH | P3 |
| Per-Feed Weights | MEDIUM | MEDIUM | P3 |
| Prompt Versioning | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.1 launch (configuration + basic feedback)
- P2: Should have for v1.2 (integrated feedback loop)
- P3: Nice to have, future consideration (advanced features)

---

## Deep Dive: LLM Feedback Loop

### Types of Feedback Signals

**Explicit Feedback** (rare, <1% of interactions):
- Thumbs up/down on article
- "More/less like this" button
- Star ratings
- Manual category corrections
- Skip/hide actions

**Implicit Feedback** (abundant, >99% of interactions):
- **Read time:** <10s = not interested, >2min = highly interested
- **Scroll depth:** 0-25% = skimmed, 75-100% = engaged
- **Return visits:** Opened article multiple times
- **Immediate close:** Clicked, immediately went back (<3s)
- **Post-read actions:** Bookmarked, shared, searched for more
- **Time-of-day patterns:** When user reads certain topics

### Integration Strategies

**Phase 1 (v1.1): Collect**
Store feedback data without affecting scoring. Build dataset for analysis.

```python
# New table: article_feedback
feedback_type: str  # "thumbs_up", "thumbs_down", "skip"
read_duration_seconds: int | None
scroll_depth_percent: int | None
feedback_timestamp: datetime
```

**Phase 2 (v1.2): Category Weights**
Adjust category weights based on explicit feedback.

```python
# Logic: thumbs_up on "technology" article → increase technology weight
# thumbs_down on "politics" article → decrease politics weight
# Smoothed over multiple feedback events to avoid overreacting
```

**Phase 3 (v2.0): Personalized Scoring**
Modify interest_score calculations based on implicit patterns.

```python
# Articles similar to "long read time" articles get boosted
# Articles similar to "immediate close" articles get penalized
# Use embeddings to find "similar" articles (requires vector DB)
```

**Phase 4 (v2.1): Prompt Engineering**
Dynamically adjust system prompts based on feedback patterns.

```python
# If user consistently rejects "technical-deep-dive" articles,
# modify scoring prompt to penalize jargon-heavy content
```

### Feedback Loop Complexity

| Approach | Complexity | Effectiveness | Notes |
|----------|------------|---------------|-------|
| Store only | LOW | 0% | Baseline for future features |
| Category weight adjustment | LOW | 20-30% | Simple multiplication, fast, interpretable |
| Feature-based scoring | MEDIUM | 40-50% | Track article features (length, author, domain), adjust weights |
| Embedding-based similarity | HIGH | 60-70% | Requires vector DB (Milvus, Chroma), embedding model, similarity search |
| Prompt modification | HIGH | 30-50% (uncertain) | Hard to predict, can destabilize scoring, needs careful validation |
| Full RLHF pipeline | VERY HIGH | 70-85% | Requires labeled dataset (1000+ examples), fine-tuning infrastructure, not feasible for local Ollama |

**Recommendation for v1.2:** Start with category weight adjustment (LOW complexity, 20-30% effectiveness). This gives quick wins without destabilizing the scoring pipeline.

### Feedback Data Storage

**Recommended Approach: Separate Feedback Table**
```sql
CREATE TABLE article_feedback (
    id INTEGER PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id),
    feedback_type TEXT,  -- "thumbs_up", "thumbs_down", "skip", "implicit"
    read_duration_seconds INTEGER,
    scroll_depth_percent INTEGER,
    created_at TIMESTAMP
);
```

**Benefits:**
- Clean separation of concerns
- Easy to query feedback patterns
- Article table stays focused on content
- Can delete feedback without affecting articles
- Time-series data (multiple events per article)

**Alternative: Inline in Article Table** (not recommended)
- Feedback is time-series data, articles are entities
- Would need JSON column or lose history
- Harder to query patterns across articles

---

## Deep Dive: Ollama Configuration UI

### What Users Expect

Based on research of Ollama UI tools (Open WebUI, Askimo, LM Studio), users expect:

1. **Model Management:**
   - List available models (locally installed)
   - Pull/download new models from Ollama library
   - Delete models to free disk space
   - See model size, last used timestamp

2. **Connection Health:**
   - Visual indicator: green (connected), yellow (slow), red (disconnected)
   - Test connection button
   - Show Ollama host/port
   - Error messages when connection fails

3. **Model Configuration:**
   - Select model for categorization (e.g., `llama3.2:3b`)
   - Select model for scoring (e.g., `llama3.2:8b`)
   - Adjust temperature (0.0-1.0, default 0.8)
   - Adjust context window (`num_ctx`, default 2048)
   - Show model capabilities (e.g., "3B params, fast, good for classification")

4. **Prompt Visibility:**
   - Show current system prompts (read-only in v1.1)
   - Expandable text areas for categorization and scoring prompts
   - Copy-to-clipboard buttons for prompts

### Implementation Notes

**Model Picker:**
```typescript
// API endpoint: GET /api/ollama/models
// Returns: [{ name: "llama3.2:3b", size: "2.0GB", modified_at: "2026-02-10" }]

<Select value={categorizationModel} onChange={setCategorizationModel}>
  {models.map(m => <option value={m.name}>{m.name} ({m.size})</option>)}
</Select>
```

**Connection Health:**
```typescript
// API endpoint: GET /api/ollama/health
// Returns: { status: "healthy" | "degraded" | "unavailable", latency_ms: 45 }

const healthCheck = useQuery({
  queryKey: ['ollama-health'],
  queryFn: fetchOllamaHealth,
  refetchInterval: 10000, // Check every 10s
});

<Badge colorPalette={healthCheck.data.status === 'healthy' ? 'green' : 'red'}>
  {healthCheck.data.status}
</Badge>
```

**Parameters:**
```typescript
// Store in UserPreferences table
ollama_categorization_model: str = "llama3.2:3b"
ollama_scoring_model: str = "llama3.2:8b"
ollama_temperature: float = 0.8
ollama_num_ctx: int = 2048
```

### UI Location

**Settings Page → "LLM Configuration" Section:**
- Model selection (categorization + scoring)
- Connection status widget
- Temperature slider
- Context window input
- Prompts (expandable, read-only)

---

## Deep Dive: Real-Time Push (SSE)

### Why SSE vs WebSockets

| Criterion | SSE | WebSockets |
|-----------|-----|------------|
| Direction | Server → Client (one-way) | Bidirectional |
| Protocol | HTTP (simple) | Upgraded connection (complex) |
| Browser support | Native EventSource API | Native WebSocket API |
| Reconnection | Automatic | Manual implementation |
| Proxy/firewall | Works (HTTP) | Often blocked |
| Use case fit | Perfect for article updates | Overkill for our use case |

**Decision:** SSE is simpler and sufficient. We don't need client→server push during normal operation.

### What to Push

**Events to Stream:**
1. **Article scored:** `{ type: "article_scored", article_id: 123, composite_score: 15.2 }`
2. **Article state change:** `{ type: "article_state", article_id: 124, scoring_state: "scoring" }`
3. **Feed refreshed:** `{ type: "feed_refreshed", feed_id: 5, new_articles_count: 12 }`
4. **Scoring queue status:** `{ type: "queue_status", queued: 45, scoring: 3 }`

### Implementation Pattern

**Backend (FastAPI):**
```python
@router.get("/api/events")
async def stream_events(request: Request):
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break

            # Check for new events
            event = await event_queue.get()
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx
        }
    )
```

**Frontend (React):**
```typescript
useEffect(() => {
  const eventSource = new EventSource('/api/events');

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'article_scored') {
      queryClient.invalidateQueries(['articles']);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    // Retry with exponential backoff
  };

  return () => eventSource.close();
}, []);
```

### Performance Considerations

- **Connection overhead:** ~1KB/connection, trivial for single-user app
- **Event frequency:** Batch events (e.g., send queue status every 5s, not every article)
- **Reconnection:** Exponential backoff (1s, 2s, 4s, 8s, max 30s)
- **Missed events:** On reconnect, client queries latest state (eventual consistency)

---

## Deep Dive: Feed Categories/Folders

### Expected Behavior

**Organization:**
- Hierarchical folders (folders contain feeds)
- No nested folders in v1.1 (simplicity)
- Drag-and-drop to reorder feeds within folder
- Drag feed to different folder to move

**Folder Actions:**
- Mark all as read (all articles in folder's feeds)
- Refresh all feeds in folder
- Collapse/expand folder
- Rename folder
- Delete folder (moves feeds to "Uncategorized")

**Persistence:**
```sql
CREATE TABLE folders (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
);

ALTER TABLE feeds ADD COLUMN folder_id INTEGER REFERENCES folders(id);
ALTER TABLE feeds ADD COLUMN display_order INTEGER DEFAULT 0;
```

### UI Pattern

**Sidebar:**
```
Folders
  ├─ Technology (12)
  │   ├─ Hacker News (5)
  │   └─ TechCrunch (7)
  ├─ Startups (3)
  │   ├─ Y Combinator (2)
  │   └─ Product Hunt (1)
  └─ Uncategorized (0)
```

**Context Menu (right-click folder):**
- Mark all as read
- Refresh all feeds
- Rename folder
- Delete folder

**Drag-and-Drop:**
- Library: `@dnd-kit/core` (modern, accessible)
- Visual feedback during drag
- Drop zones highlighted
- Optimistic UI (instant update, sync in background)

---

## Deep Dive: Feed Auto-Discovery

### Discovery Methods

**1. RSS Autodiscovery (standard):**
Parse HTML for `<link>` tags in `<head>`:
```html
<link rel="alternate" type="application/rss+xml" href="/feed" title="Blog RSS" />
<link rel="alternate" type="application/atom+xml" href="/atom" title="Blog Atom" />
```

**2. Common Feed Paths (fallback):**
Try these paths if no `<link>` tags found:
- `/feed`
- `/feed/`
- `/rss`
- `/rss.xml`
- `/atom.xml`
- `/index.xml`

**3. WordPress/Ghost/Common Platforms (heuristics):**
Detect platform and use known feed paths:
- WordPress: `/feed/`, `/wp-rss2.php`
- Ghost: `/rss/`
- Medium: `/feed/`

### Implementation

**Backend:**
```python
@router.post("/api/feeds/discover")
async def discover_feed(url: str) -> DiscoverResult:
    # 1. Fetch HTML
    response = await httpx.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')

    # 2. Look for <link> tags
    rss_links = soup.find_all('link', type=['application/rss+xml', 'application/atom+xml'])
    if rss_links:
        return [urljoin(url, link['href']) for link in rss_links]

    # 3. Try common paths
    for path in ['/feed', '/rss', '/atom.xml']:
        feed_url = urljoin(url, path)
        if await is_valid_feed(feed_url):
            return [feed_url]

    # 4. Not found
    raise HTTPException(404, "No RSS feed found")
```

**Frontend:**
```typescript
// "Add Feed" dialog
<FormControl>
  <FormLabel>Website or Feed URL</FormLabel>
  <Input
    placeholder="https://example.com or https://example.com/feed"
    value={url}
    onChange={(e) => setUrl(e.target.value)}
  />
  <FormHelperText>
    Paste any website URL — we'll find the RSS feed automatically.
  </FormHelperText>
</FormControl>

// On submit:
const discovered = await discoverFeed(url);
if (discovered.length > 1) {
  // Show picker: "Found 2 feeds: Blog Posts, Podcast Episodes"
} else {
  // Auto-select single feed
}
```

### Error Handling

- **No feed found:** "We couldn't find an RSS feed at this URL. Try pasting the feed URL directly."
- **Multiple feeds:** "Found 3 feeds. Which one do you want?"
- **Invalid URL:** "Please enter a valid URL (e.g., https://example.com)"
- **Network error:** "Couldn't reach that URL. Check your connection and try again."

---

## Competitor Feature Analysis

Analysis based on 2026 RSS reader landscape: Feedly, Inoreader, NewsBlur, NetNewsWire.

| Feature | Feedly (commercial) | Inoreader (power user) | Our Approach |
|---------|---------------------|------------------------|--------------|
| Feed organization | Folders + "Boards" (visual) | Folders + tags + rules | Folders only (keep simple) |
| Real-time updates | WebSockets | Polling (30s) | SSE (simpler than WS, better than polling) |
| Content scoring | ML-based "Leo" (closed) | User-defined rules | LLM-based with user feedback (transparent) |
| Model configuration | N/A (cloud API) | N/A (rule-based) | Full Ollama control (differentiator) |
| Feedback mechanism | Thumbs up/down | Star ratings | Thumbs + implicit signals (hybrid) |
| Prompt editing | N/A | N/A | Direct prompt editing (unique to local LLM) |
| Feed discovery | Built-in search engine | Manual URL entry | Auto-discovery from any URL (better UX) |
| OPML support | Yes | Yes | Yes (table stakes) |
| Keyboard shortcuts | Extensive (20+) | Extensive (30+) | Core 10 only (avoid complexity) |
| Multi-device sync | Cloud-based | Cloud-based | Local-only (anti-feature for us) |

**Key Differentiators:**
1. **Transparent LLM scoring** — commercial tools use black-box ML, we show reasoning and allow prompt editing
2. **Local-first privacy** — no cloud, no tracking, no data sharing
3. **Feedback loop that learns** — not just thumbs up/down for training data, actually improves your personal scoring

**Table Stakes We Must Match:**
1. Feed folders (everyone has this)
2. OPML import/export (portability is expected)
3. Real-time updates (modern web standard)
4. Feed auto-discovery (quality-of-life feature)

---

## Sources

### Ollama Configuration
- [How to Pull and Manage Models in Ollama](https://oneuptime.com/blog/post/2026-02-02-ollama-model-management/view)
- [Best Ollama Clients in 2026: Top 5 Tools (Including Askimo)](https://askimo.chat/blog/best-ollama-clients-2026/)
- [Modelfile Reference - Ollama](https://docs.ollama.com/modelfile)
- [Setting Parameters like Context Length and Temperature in Ollama Models](https://www.tspi.at/2025/08/10/ollamaparams.html)
- [GitHub - open-webui/open-webui](https://github.com/open-webui/open-webui)

### Real-Time Updates (SSE)
- [Why Server-Sent Events (SSE) are ideal for Real-Time Updates](https://talent500.com/blog/server-sent-events-real-time-updates/)
- [How to Stream Updates with Server-Sent Events in Node.js](https://oneuptime.com/blog/post/2026-01-24-nodejs-server-sent-events/view)
- [How to Implement Server-Sent Events (SSE) in React](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view)
- [Real-Time Updates with Server-Sent Events (SSE) in Next.js (TypeScript)](https://javascript.plainenglish.io/real-time-updates-with-server-sent-events-sse-in-next-js-typescript-a-beginners-guide-d7bb3e932269)

### LLM Feedback Loops
- [Active Learning and Human Feedback for Large Language Models](https://intuitionlabs.ai/articles/active-learning-hitl-llms)
- [Systems Design: How to Make LLMs Part of a Feedback Loop](https://www.hioscar.ai/13-systems-design-or-how-to-make-llms-part-of-a-feedback-loop)
- [Adapting the Facebook Reels RecSys AI Model Based on User Feedback](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/) — 59.5%→71.5% accuracy improvement
- [What Is Reinforcement Learning From Human Feedback (RLHF)?](https://www.ibm.com/think/topics/rlhf)
- [LLM Feedback Loop](https://www.nebuly.com/blog/llm-feedback-loop)

### Implicit Feedback Signals
- [Beyond Explicit and Implicit: How Users Provide Feedback](https://arxiv.org/html/2502.09869v1)
- [What is implicit feedback in recommender systems?](https://milvus.io/ai-quick-reference/what-is-implicit-feedback-in-recommender-systems)
- [Content-based filtering | Machine Learning | Google for Developers](https://developers.google.com/machine-learning/recommendation/content-based/basics)
- [Netflix Artificial Intelligence: The Truth Behind Personalized Content](https://litslink.com/blog/all-about-netflix-artificial-intelligence-the-truth-behind-personalized-content)

### Feed Organization
- [How to Manage and Organize Large RSS Feeds](https://www.wprssaggregator.com/manage-and-organize-large-rss-feeds/)
- [Best RSS Reader for Research: 7 Top Tools for Academics 2026](https://vpntierlists.com/blog/best-rss-readers-researchers-academics-2025)
- [Is RSS Really Dead? Why 2026 Is the Year to Bring It Back](https://arekore.app/en/articles/rss-readers)

### Feed Auto-Discovery
- [RSS Autodiscovery](https://www.rssboard.org/rss-autodiscovery)
- [How to find the RSS feed URL for almost any site](https://zapier.com/blog/how-to-find-rss-feed-url/)
- [Making Your RSS Feeds Automatically Discoverable](https://blog.jim-nielsen.com/2021/automatically-discoverable-rss-feeds/)

### RSS Reader UX
- [RSS Reader User Interface Design Principles](https://www.feedviewer.app/answers/rss-reader-user-interface-design-principles)
- [Best RSS Feed Readers 2026: Complete Comparison Guide](https://vpntierlists.com/blog/best-rss-feed-readers-2025-complete-comparison-guide)

---
*Feature research for: RSS Reader v1.1 Milestone (Configuration, Real-Time Updates, Feedback)*
*Researched: 2026-02-14*
