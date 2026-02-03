# RSS Reader

A personal RSS reader with LLM-powered relevance scoring.

## Purpose

A simple, local-first RSS reader designed for personal use. The application helps you stay on top of your feeds by automatically scoring articles based on your interests using a local LLM.

## Core Features

- **Feed Management** — Subscribe to RSS feeds and organize them into groups
- **LLM Relevance Scoring** — Automatically score and label articles based on personal preferences using Ollama
- **Smart Filtering** — Filter articles by read status, group, or relevance score
- **Full-Text Search** — Search across all articles

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python (FastAPI + SQLModel) |
| Frontend | Next.js |
| Database | SQLite |
| LLM | Ollama (local inference) |

## Design Philosophy

- **Local-first** — No cloud dependencies; everything runs on your machine
- **Simple** — Minimal moving parts; no microservices or message queues
- **Maintainable** — Clean architecture suitable for a solo developer
