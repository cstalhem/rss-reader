# rss-reader

## Goal
Design a **simple, maintainable** personal RSS reader with:
- **Python backend**
- **Next.js frontend**
- **Ollama for LLM relevance scoring**
- **SQLite database**

This report focuses on a practical, low‑ops setup suitable for 2026 and beyond while keeping dependencies and moving parts minimal.

---

## Recommended Architecture (Simple & Local-First)

### High-Level Components
1. **Backend API (Python)**
   - **FastAPI** for REST API, docs, and async support.
   - **SQLModel (SQLAlchemy + Pydantic)** for models and SQLite persistence.
   - **feedparser** (or `feedgen` + `httpx`) for RSS fetch & parse.
   - **APScheduler** or **simple cron** for scheduled feed refresh.
   - **Ollama HTTP API** for LLM relevance scoring.

2. **Frontend (Next.js)**
   - App Router with a **list view** of articles.
   - **Feed admin UI** for add/remove/grouping.
   - **Filters** (unread, by group, by relevance score).

3. **Database (SQLite)**
   - Single DB file for feeds, articles, tags/groups, and relevance scores.
   - Optional FTS5 for full‑text search (simple and fast).

4. **LLM Layer (Ollama)**
   - Local model via `ollama serve`.
   - Use **structured prompt** to score relevance (0–1) and label.

---

## Why This Is the “Simplest Reasonable” 2026 Setup
- **No extra infrastructure**: SQLite + Ollama are local, no cloud dependencies.
- **FastAPI + SQLModel** keeps backend lean while providing validation and docs.
- **Next.js** provides the best developer experience and stable ecosystem for UI.
- **Ollama** gives local LLM inference with a simple HTTP API.

---

## Proposed Data Model (SQLite)

### Tables
- `feeds`
  - id, url, title, description, group_id, last_fetched_at
- `feed_groups`
  - id, name, sort_order
- `articles`
  - id, feed_id, title, url, author, published_at, summary, content
  - `is_read`, `relevance_score`, `relevance_label`, `llm_model`, `scored_at`
- `article_tags` (optional)
  - id, article_id, tag

### Recommended Indexes
- `(feed_id, published_at)`
- `(is_read, published_at)`
- `(relevance_score)`
- FTS5 virtual table on title + content for search

---

## LLM Relevance Scoring

### Simple Pipeline
1. Fetch new articles.
2. Extract **title + summary + content excerpt** (e.g., first 1,000–2,000 chars).
3. Call Ollama with a **short prompt** based on personal preferences.
4. Store numeric score + label.

### Example Prompt
```
You are classifying an RSS article for personal relevance.
User interests:
- <insert preferences>

Article:
Title: <title>
Summary: <summary>
Content: <excerpt>

Return JSON:
{"relevance_score": 0-1, "label": "high|medium|low", "reason": "short"}
```

### Ollama Integration
- Use `http://localhost:11434/api/generate` or `/api/chat`.
- Models: `llama3.1`, `mistral`, or any lightweight model optimized for local inference.
- Keep prompt short for speed.

---

## Backend Design

### API Endpoints
- `GET /feeds` — list feeds
- `POST /feeds` — add feed
- `DELETE /feeds/{id}` — remove feed
- `PATCH /feeds/{id}` — update feed/group
- `GET /groups` / `POST /groups` — manage feed groups
- `GET /articles` — list articles (filter by group, relevance, read)
- `PATCH /articles/{id}` — mark read/unread
- `POST /feeds/refresh` — manual refresh

### Background Fetching
**Simplest approach**:
- Run `python backend/refresh.py` with cron (every 30–60 min).

**Slightly nicer**:
- APScheduler inside FastAPI startup.

---

## Frontend UX (Next.js)

### Key Screens
1. **Article List View**
   - Sort by relevance or time.
   - Quick read/unread toggle.
2. **Feed Admin**
   - Add feed URL
   - Remove feed
   - Assign to group
3. **Article Detail View**
   - Full content + metadata
   - Relevance explanation (from LLM)

### Suggested UI Pattern
- Split view (list left, detail right) for fast triage.

---

## Deployment (Minimal Ops)

### Local Machine
- `ollama serve`
- `uvicorn` for backend
- `next dev` for frontend

### Simple Docker Compose Option
- `backend` (FastAPI)
- `frontend` (Next.js)
- `ollama` (model runtime)
- `sqlite` as a local volume

---

## Security & Personalization
- If used locally: minimal auth.
- If exposed remotely: basic auth or OAuth proxy.
- Store preferences in a `user_settings` table or `.env` file.

---

## Best Practices for 2026 Simplicity

- **Keep all logic local** (no external LLMs or hosted DBs).
- **Avoid microservices**.
- Prefer **cron + script** over message queues.
- Use **structured LLM output** (JSON) and validate it.

---

## Minimal Project Structure (Example)
```
/rss-reader
  /backend
    main.py
    models.py
    refresh.py
  /frontend
    app/
    components/
  rss.db
```

---

## Summary Recommendations
- **Backend**: FastAPI + SQLModel + feedparser + APScheduler.
- **Frontend**: Next.js App Router with a split list/detail UI.
- **LLM**: Ollama local inference with short JSON‑formatted prompts.
- **Storage**: SQLite + FTS5.

This stack is simple, future‑proof, and can scale to tens of thousands of articles without needing more infrastructure.
