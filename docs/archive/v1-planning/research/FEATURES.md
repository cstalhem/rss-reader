# Feature Research

**Domain:** Personal RSS Reader with LLM-Powered Curation
**Researched:** 2026-02-04
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Feed subscription management | Core purpose of RSS readers | LOW | Add/remove feeds, OPML import/export for migration |
| Feed organization (folders/categories) | Users follow 10-100+ feeds | LOW | Nested folders standard, critical for scaling beyond ~20 feeds |
| Article list with metadata | Users scan many articles quickly | LOW | Title, source, publish date, preview text, read/unread status |
| Mark as read/unread | Track what's been consumed | LOW | Auto-mark on scroll or manual toggle, persist across sessions |
| Article search | Find past articles | MEDIUM | Search by title, content, source; essential with 100+ feeds |
| Clean reading view | RSS sells on ad-free reading | MEDIUM | Extract main content, remove clutter, readable typography |
| OPML import/export | Avoid vendor lock-in | LOW | Standard format, users expect to migrate freely between readers |
| Basic keyboard shortcuts | Speed is the whole point | LOW | j/k navigation, mark read, star/save - table stakes for daily use |
| Offline reading capability | Commutes, poor connectivity | MEDIUM | Cache articles locally, sync when online returns |
| Dark/light theme | Expected in 2026 | LOW | Already implemented in current project |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable for personal RSS reader with LLM focus.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **LLM scoring for interest** | Core differentiator: surface signal, hide noise | HIGH | Local Ollama scoring avoids cloud costs/privacy concerns |
| **Prose-style preferences** | "Show me articles like this, not like that" | HIGH | Natural language >> complex filter rules for personal use |
| **Multi-stage filtering pipeline** | Keyword filters → LLM → categories | MEDIUM | Efficient: cheap filters first, expensive LLM only on candidates |
| **Serendipity scoring** | "Interesting outside my usual topics" | HIGH | Separate from "relevant" - find surprising valuable content |
| **Automatic interest categorization** | Articles auto-tagged by topic | MEDIUM | Enables "what tech news did I miss?" without manual tagging |
| **Smart article previews** | Cards with key info + interest score | LOW | Visual hierarchy: high-interest articles stand out immediately |
| **In-app reader with original link** | Read without leaving + option to view source | LOW | Best of both: clean reading + verify/explore on publisher site |
| **Training feedback loop** | Mark "more/less like this" | MEDIUM | LLM learns from explicit feedback, improves over time |
| **Hide noisy feeds temporarily** | "Mute for 7 days" without unsubscribing | LOW | Handles announcement blogs that spike then go quiet |
| **Full-text extraction** | Fetch complete article for summary-only feeds | MEDIUM | Many publishers only provide excerpts in RSS - extraction fixes this |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a personal RSS reader.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time sync across devices** | "I want mobile + desktop in sync" | Solo developer, single-user tool - adds massive complexity for sync conflicts, server costs | Export/import feed list via OPML, or future: read-only mobile view of single instance |
| **Social sharing built-in** | "Share to Twitter/LinkedIn easily" | Feature bloat - RSS readers should get out of the way | Copy link (Cmd+C) - OS handles sharing to any app user wants |
| **Algorithmic discovery feeds** | "Suggest new sources like Feedly" | Defeats purpose of RSS: user control vs algorithm curation | Manual discovery via web search, blog recommendations, OPML sharing |
| **Email newsletter integration** | "Turn newsletters into feeds" | Scope creep - different UX paradigm (email vs RSS) | Keep separate: newsletters in email, RSS in reader |
| **Built-in read-later queue** | "Save articles to read later" | Duplicates existing tools (Pocket, Instapaper, browser bookmarks) | Star/favorite within reader, export if needed to dedicated tool |
| **Podcast playback** | "Many feeds include podcasts" | Media player complexity for text-focused tool | External podcast app via RSS feed URL - separation of concerns |
| **Feed monitoring for keywords** | "Alert me when X is mentioned" | Niche power-user feature adds UI complexity | LLM scoring already surfaces interesting content - good enough for personal use |
| **Multi-user accounts** | "Share with family/team" | Personal tool, not collaboration software | Each person runs own instance if self-hosted desired |
| **Comment sections/discussions** | "Discuss articles with others" | Social features create moderation burden, privacy concerns | RSS is for reading - discuss externally (forums, social media) |

## Feature Dependencies

```
Feed Management (OPML, add/remove)
    ├──requires──> Feed Organization (folders)
    └──requires──> Feed List UI

Article List View
    ├──requires──> Mark Read/Unread
    ├──requires──> Search
    └──enhances──> Keyboard Shortcuts

LLM Scoring Pipeline
    ├──requires──> Feed Fetching (already built)
    ├──requires──> Article Storage (already built)
    ├──requires──> Prose-Style Preferences (user input)
    └──enhances──> Interest Categories (auto-tagging)

In-App Reader
    ├──requires──> Full-Text Extraction
    ├──requires──> Clean Content Display
    └──optional──> Link to Original Site

Training Feedback Loop
    ├──requires──> LLM Scoring (must exist to improve)
    └──requires──> Feedback UI (thumbs up/down or similar)

Keyword Filters (pre-LLM stage)
    ├──conflicts──> Pure LLM approach (if filters too aggressive, LLM never sees content)
    └──enhances──> Performance (reduces LLM calls)
```

### Dependency Notes

- **Feed Management → Organization:** Can't organize what doesn't exist; must add feeds first, then group them.
- **Article List → Read/Unread:** Core workflow: scan list, mark what's read - inseparable features.
- **LLM Scoring → Preferences:** LLM needs user's "voice" (preferences) to score accurately.
- **Keyword Filters ↔ LLM:** Balance required - filters save LLM calls, but overly aggressive filters hide potentially interesting articles from LLM.
- **In-App Reader → Full-Text Extraction:** Many feeds provide only summaries; extraction required for good in-app reading.
- **Training Feedback → LLM Scoring:** Feedback only useful if LLM scoring exists; creates improvement loop.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the LLM curation concept.

- [x] **Feed fetching & scheduling** — Already built (backend Phase 2 complete)
- [x] **Article storage (CRUD)** — Already built (backend Phase 2 complete)
- [ ] **Feed subscription UI** — Add/remove feeds, basic organization
- [ ] **Article list view** — Browse articles with metadata (title, source, date, preview)
- [ ] **Mark as read/unread** — Track consumption state
- [ ] **LLM scoring with Ollama** — Core differentiator: interest scoring
- [ ] **Prose-style preferences** — User defines "show me X, not Y" in natural language
- [ ] **Interest score display** — Visual indicator (color, badge, sort order) for article relevance
- [ ] **In-app reader** — Clean article view without leaving app
- [ ] **Link to original site** — Verify source, explore publisher site
- [ ] **Dark/light theme toggle** — Already implemented

**Why these for MVP:** Backend exists (feeds fetch, articles store). Frontend needs basic reading UI (list + reader) plus the core LLM differentiator. Without LLM scoring, this is just another RSS reader. LLM scoring validates the concept: "Can AI surface interesting articles from noisy feeds?"

### Add After Validation (v1.x)

Features to add once core is working and users (self) validate LLM curation works.

- [ ] **Keyword filters (pre-LLM)** — Reduce LLM calls, improve performance (trigger: >50 articles/day)
- [ ] **Interest categories (auto-tagging)** — "Tech", "Business", "Science" etc. (trigger: want to browse by topic)
- [ ] **Training feedback loop** — Mark "more/less like this" to improve LLM (trigger: accuracy needs tuning)
- [ ] **Full-text extraction** — Fetch complete articles for summary-only feeds (trigger: encounter truncated feeds)
- [ ] **OPML import/export** — Migrate feeds from old reader (trigger: want to switch readers)
- [ ] **Article search** — Find past articles by keyword (trigger: "where was that article about X?")
- [ ] **Folder organization** — Group feeds by category (trigger: >20 feeds becomes messy)
- [ ] **Keyboard shortcuts** — Speed up daily workflow (trigger: using reader daily, want faster navigation)
- [ ] **Starred/saved articles** — Bookmark for later reference (trigger: "I want to save this")
- [ ] **Hide noisy feeds temporarily** — Mute without unsubscribing (trigger: announcement blog spikes then goes quiet)

### Future Consideration (v2+)

Features to defer until product-market fit (personal satisfaction) is established.

- [ ] **Serendipity scoring** — Surface interesting articles outside usual topics (defer: requires good baseline LLM scoring first)
- [ ] **Advanced preference tuning** — Per-feed or per-category preferences (defer: complexity, may not need)
- [ ] **Offline reading** — Cache articles locally (defer: always online during use, not commuting)
- [ ] **Cross-device sync** — Desktop + mobile in sync (defer: solo developer, massive complexity)
- [ ] **Mobile app** — iOS/Android native (defer: web UI works on mobile browser for now)
- [ ] **Feed health monitoring** — Alert when feed breaks (defer: notice manually, not critical)
- [ ] **Advanced search filters** — Search by date range, source, score (defer: basic search sufficient initially)
- [ ] **Export scored articles** — Download CSV of high-interest articles (defer: niche use case)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Article list view | HIGH | LOW | P1 |
| In-app reader | HIGH | LOW | P1 |
| LLM scoring | HIGH | HIGH | P1 |
| Prose preferences | HIGH | MEDIUM | P1 |
| Mark as read/unread | HIGH | LOW | P1 |
| Feed subscription UI | HIGH | LOW | P1 |
| Interest score display | HIGH | LOW | P1 |
| Keyword filters | MEDIUM | LOW | P2 |
| Full-text extraction | MEDIUM | MEDIUM | P2 |
| OPML import/export | MEDIUM | LOW | P2 |
| Folder organization | MEDIUM | LOW | P2 |
| Article search | MEDIUM | MEDIUM | P2 |
| Keyboard shortcuts | MEDIUM | LOW | P2 |
| Starred/saved articles | MEDIUM | LOW | P2 |
| Training feedback | HIGH | MEDIUM | P2 |
| Interest categories | MEDIUM | MEDIUM | P2 |
| Hide noisy feeds | LOW | LOW | P2 |
| Serendipity scoring | MEDIUM | HIGH | P3 |
| Advanced preferences | LOW | HIGH | P3 |
| Offline reading | LOW | MEDIUM | P3 |
| Cross-device sync | LOW | HIGH | P3 |
| Mobile app | LOW | HIGH | P3 |

**Priority key:**
- **P1: Must have for launch** — Core reading experience + LLM differentiator
- **P2: Should have, add when possible** — Polish, power-user features, UX improvements
- **P3: Nice to have, future consideration** — Complex features that may not be needed

## LLM/AI-Powered Curation: Deep Dive

Since LLM curation is the core differentiator, here's detail on what makes it valuable:

### Why LLM Curation Matters (2026 Context)

- **Information overload:** RSS readers traditionally show everything in chronological order. Following 50+ feeds = hundreds of articles/day, most irrelevant.
- **Algorithm fatigue:** Social media algorithms optimize for engagement (outrage, clickbait). RSS offers user control, but still too noisy.
- **Serendipity loss:** Aggressive filtering hides unexpected-but-interesting content. Need balance: surface signal, preserve surprise.

### LLM Curation Approaches in 2026

| Approach | Example (from research) | Pros | Cons |
|----------|-------------------------|------|------|
| **Cloud LLM with ML training** | Feedly's Leo AI | Learns patterns (open/skip/save), improves over time | Privacy concerns, cloud costs, black box |
| **Text-based phrase classifiers** | NewsBlur Premium | Highlight/hide based on phrases, transparent | Manual training tedious, brittle to phrasing variations |
| **Embeddings + similarity** | RSSFilter | Learns from read articles, recommends similar | Requires read history, may create filter bubble |
| **Local LLM with prose preferences** | **This project (Precis-inspired)** | Privacy, natural language input, user control | LLM quality matters, slower than cloud, requires tuning |

### This Project's LLM Approach

**Design philosophy:**
1. **Privacy-first:** Local Ollama (no cloud calls, no data sharing)
2. **User control:** Prose preferences (explicit, auditable)
3. **Multi-stage efficiency:** Cheap filters first, expensive LLM only on candidates
4. **Transparency:** Show LLM reasoning ("scored 8/10 because X")

**Architecture:**
```
Feed Fetching (scheduled)
    ↓
Keyword Filters (cheap, rule-based)
    ↓
LLM Scoring (expensive, semantic)
    ↓
Interest Categories (optional, enhances browsing)
    ↓
UI Display (sorted by score, visual hierarchy)
```

**Expected workflow:**
1. User writes prose preferences: "I care about AI/ML research, startup funding news, and technical deep-dives on databases. I don't care about celebrity gossip, political opinion pieces, or cryptocurrency speculation."
2. Articles fetch from feeds (already working).
3. Keyword filters remove obvious noise (e.g., "crypto" in filter blocklist).
4. LLM scores remaining articles (1-10) based on prose preferences.
5. UI shows articles sorted by score, color-coded (high-interest = green, low = gray).
6. User reads high-interest articles, provides feedback ("more like this").
7. Feedback improves LLM scoring over time (future: training feedback loop).

**Why this works for personal use:**
- Solo developer, personal tool: no need for complex ML training infrastructure
- Local LLM: privacy preserved, no ongoing cloud costs
- Prose preferences: intuitive input (write, not configure complex rules)
- Serendipity preserved: LLM sees everything post-keyword-filters, can surface surprises

### LLM Feature Evolution

**v1 (MVP):**
- Static prose preferences (user writes once, LLM scores against it)
- Simple 1-10 scoring
- No feedback loop

**v1.x (Post-validation):**
- Training feedback: mark "more/less like this"
- LLM adjusts scoring based on feedback
- Interest categories: articles auto-tagged by topic

**v2+ (Future):**
- Serendipity scoring: separate from "relevance" - find interesting outliers
- Per-feed preferences: "This blog is for entertainment, score differently than tech blogs"
- Time-based preferences: "Friday afternoon = lighter content, Monday AM = deep research"

## Competitor Feature Analysis

| Feature | Feedly (Feature-Rich) | NewsBlur (Power-User) | The Old Reader (Minimal) | This Project |
|---------|------------------------|------------------------|--------------------------|--------------|
| LLM/AI curation | Leo AI (cloud, ML-trained) | Text-phrase classifiers | None (strict chronological) | Local Ollama, prose preferences |
| Feed limit (free) | 100 feeds | 64 feeds | Unlimited | Unlimited (self-hosted) |
| Organization | Folders, tags | Folders, tags, filters | Folders only | Folders (v1.x) |
| Reading view | In-app + link | In-app + full-text extraction | In-app + link | In-app + link |
| Keyboard shortcuts | Yes | Extensive | Basic | Basic (v1.x) |
| Mobile apps | iOS, Android | iOS, Android, web | Web only | Web (mobile-responsive) |
| Privacy model | Cloud-based, collects data | Cloud, RSS-only data | Cloud, minimal data | Local-first, no cloud |
| OPML import/export | Yes | Yes | Yes | Yes (v1.x) |
| Price | Free (100 feeds), Pro $6/mo | Free (64 feeds), Premium $36/year | Free | Free (self-hosted) |
| Best for | Casual users, discovery | Power users, complex workflows | Minimalists, privacy-focused | Solo users wanting LLM curation + privacy |

**Competitive positioning:**
- **vs Feedly:** Privacy-first (local LLM), prose preferences (vs black-box ML), free/self-hosted
- **vs NewsBlur:** Simpler LLM curation (prose vs manual phrase training), personal use (not power-user features)
- **vs The Old Reader:** LLM curation (vs pure chronological), active development (vs stagnant)
- **vs All:** Local Ollama + prose preferences = unique combo (privacy + natural language input)

## Reading Experience Best Practices (2026)

Based on research, what makes a good RSS reading experience:

### Content-First Design
- Main content gets prime screen space, minimal chrome
- Typography matters: readable font, appropriate line height, comfortable measure (60-75 characters)
- White space reduces overwhelm: cards with breathing room, not dense lists

### Visual Hierarchy
- High-interest articles stand out (color, size, position)
- Unread/read state clear at a glance
- Source attribution visible but not dominant

### Speed & Efficiency
- Keyboard shortcuts for navigation (j/k) and actions (mark read, star)
- Instant search (no loading spinners for local data)
- Smart defaults: articles sorted by interest, not just chronological

### Get Out of the Way
- "Good RSS services get out of the way as much as possible" (research finding)
- Minimal interface quirks, consistent interactions
- Don't make users think about the reader, focus on content

### Customization (But Not Too Much)
- Dark/light theme (essential in 2026)
- Font size (accessibility)
- Article density (compact vs spacious)
- Avoid: overwhelming settings, endless customization (feature creep)

### Trust & Transparency
- Link to original site (verify source, explore publisher)
- Show feed source clearly (which blog/news site?)
- LLM reasoning visible ("scored 8/10 because X") - transparency builds trust

## Sources

### General RSS Reader Features (2026):
- [The 3 best RSS reader apps in 2026 | Zapier](https://zapier.com/blog/best-rss-feed-reader-apps/)
- [Best 5 RSS Readers On The Web in 2026 - FeedSpot Blog](https://www.feedspot.com/blog/best-rss-reader/)
- [Best RSS Feed Readers 2026: Complete Comparison & Review Guide](https://vpntierlists.com/blog/best-rss-feed-readers-2025-complete-comparison-guide)
- [Is RSS Really Dead? Why 2026 Is the Year to Bring It Back](https://arekore.app/en/articles/rss-readers)

### AI/LLM-Powered RSS Readers:
- [Using LLMs to Build Smart RSS Readers - PhaseLLM Tutorial](https://phasellm.com/tutorial-smart-rss-reader)
- [Precis: AI-enabled RSS reader with notifications](https://github.com/leozqin/precis)
- [RLLM: LLM powered RSS reader](https://github.com/DanielZhangyc/RLLM)
- [RSSFilter: Smart RSS Feed Filtering & Recommendations](https://aichief.com/ai-data-management/rssfilter/)

### Reading Experience & UX:
- [RSS Reader User Interface Design Principles](https://www.feedviewer.app/answers/rss-reader-user-interface-design-principles)
- [Build A Static RSS Reader To Fight Your Inner FOMO — Smashing Magazine](https://www.smashingmagazine.com/2024/10/build-static-rss-reader-fight-fomo/)
- [Kill the algorithm in your head: RSS readers in 2026 | PC Gamer](https://www.pcgamer.com/software/kill-the-algorithm-in-your-head-lets-set-up-rss-readers-and-get-news-we-actually-want-in-2026/)

### Feature-Specific Research:
- [RSS reader keyboard shortcuts and power user features](https://github.com/yang991178/fluent-reader)
- [Full-text RSS extraction and readability](https://www.fivefilters.org/full-text-rss/)
- [OPML import/export guide](https://www.feedviewer.app/answers/how-to-export-import-feed-lists-between-rss-readers)
- [Self-hosted RSS readers comparison](https://awesome-selfhosted.net/tags/feed-readers.html)

### Competitor Analysis:
- [RSS Reader Showdown: Feedly vs Inoreader vs NewsBlur](https://vpntierlists.com/blog/rss-reader-showdown-feedly-vs-inoreader-vs-newsblur-vs-spark)
- [A deep dive into the RSS feed reader landscape](https://lighthouseapp.io/blog/feed-reader-deep-dive)
- [Minimal vs feature-rich RSS readers in 2026](https://vpntierlists.com/blog/best-rss-feed-readers-2025-complete-comparison-guide)

---
*Feature research for: Personal RSS Reader with LLM-Powered Curation*
*Researched: 2026-02-04*
*Confidence: HIGH (based on 2026 web search results, official documentation, competitor analysis)*
