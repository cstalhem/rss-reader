# RSS Reader Backend

FastAPI backend for the RSS Reader application.

## Features

- RSS feed fetching and parsing
- Article storage with SQLite
- Scheduled feed refresh via APScheduler
- Health monitoring endpoint

## Development

```bash
cd backend
uv sync
uv run uvicorn backend.main:app --reload
```

## Configuration

Configuration via environment variables or `config/app.yaml`:

- `DATABASE__PATH` - SQLite database path (default: `./data/rss-reader.db`)
- `LOGGING__LEVEL` - Log level (default: `INFO`)
- `SCHEDULER__FEED_REFRESH_INTERVAL` - Feed refresh interval in seconds (default: `1800`)
