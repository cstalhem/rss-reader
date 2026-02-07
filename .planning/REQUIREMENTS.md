# Requirements: RSS Reader

**Defined:** 2026-02-04
**Core Value:** Surface interesting articles and hide noise automatically via local LLM curation

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Article Browsing

- [x] **BRWS-01**: User can view articles in a preview card layout showing title, snippet, source, and date
- [x] **BRWS-02**: User can mark articles as read/unread from the article list
- [x] **BRWS-03**: User can read article content in an in-app reader view
- [x] **BRWS-04**: User can open the original article URL in a new tab from the reader view
- [ ] **BRWS-05**: User can see an interest score indicator on each article card (requires LLM scoring)

### Feed Management

- [ ] **FEED-01**: User can add a new RSS feed by entering its URL
- [ ] **FEED-02**: User can remove an existing feed subscription

### LLM Curation

- [ ] **LLM-01**: System scores articles using local Ollama LLM based on user preferences
- [ ] **LLM-02**: User can write prose-style preferences describing their interests in natural language
- [ ] **LLM-03**: System applies keyword filters before LLM scoring to efficiently filter obvious noise
- [ ] **LLM-04**: Articles are sorted/prioritized by interest score in the article list
- [ ] **LLM-05**: Articles are auto-categorized by topic based on LLM analysis

### Infrastructure

- [x] **INFR-01**: Application runs via Docker Compose with backend and frontend services
- [x] **INFR-02**: Docker setup uses persistent named volumes for SQLite database
- [x] **INFR-03**: Docker services auto-restart on failure (restart: unless-stopped)
- [x] **INFR-04**: Docker services include health checks with proper startup ordering
- [x] **INFR-05**: Frontend supports dark/light theme toggle

### Backend Hardening

- [x] **BACK-01**: SQLite configured with WAL mode for concurrent read/write safety

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Search & Navigation

- **SRCH-01**: User can search articles by title and content
- **SRCH-02**: User can navigate articles with keyboard shortcuts (j/k, mark read)

### Feed Organization

- **FORG-01**: User can organize feeds into folders/categories
- **FORG-02**: User can filter article list by feed or folder
- **FORG-03**: User can import feeds from OPML file
- **FORG-04**: User can export feeds to OPML file

### LLM Enhancements

- **LLME-01**: User can see LLM reasoning for why an article was scored high/low
- **LLME-02**: User can provide feedback ("more/less like this") to improve scoring
- **LLME-03**: System supports serendipity scoring to surface unexpected interesting content
- ~~LLME-04~~: Moved to v1 as LLM-05

### Polish

- **PLSH-01**: Mobile-responsive layout
- **PLSH-02**: Data retention/cleanup to prevent database bloat
- **PLSH-03**: Full-text extraction for summary-only feeds
- **PLSH-04**: Starred/saved articles for bookmarking

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-user accounts | Personal use only, no auth needed |
| Cloud deployment | Runs on home server via Docker |
| Mobile native app | Web-first, responsive layout is sufficient |
| Real-time sync across devices | Single instance on home server |
| Social sharing | RSS readers should get out of the way; OS handles sharing |
| Email newsletter integration | Different UX paradigm; keep separate |
| Podcast playback | Text-focused tool; external podcast app via RSS URL |
| Algorithmic feed discovery | Defeats purpose of RSS (user control) |
| Comment sections | Social features create moderation burden |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRWS-01 | Phase 2 | Complete |
| BRWS-02 | Phase 2 | Complete |
| BRWS-03 | Phase 2 | Complete |
| BRWS-04 | Phase 2 | Complete |
| BRWS-05 | Phase 5 | Pending |
| FEED-01 | Phase 3 | Pending |
| FEED-02 | Phase 3 | Pending |
| LLM-01 | Phase 4 | Pending |
| LLM-02 | Phase 4 | Pending |
| LLM-03 | Phase 4 | Pending |
| LLM-04 | Phase 5 | Pending |
| LLM-05 | Phase 4 | Pending |
| INFR-01 | Phase 1 | Complete |
| INFR-02 | Phase 1 | Complete |
| INFR-03 | Phase 1 | Complete |
| INFR-04 | Phase 1 | Complete |
| INFR-05 | Phase 2 | Complete |
| BACK-01 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-04*
*Last updated: 2026-02-05 after roadmap creation*
