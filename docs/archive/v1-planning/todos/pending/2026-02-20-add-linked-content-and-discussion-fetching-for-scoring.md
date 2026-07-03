---
created: 2026-02-20T21:43:53.500Z
title: Add linked content and discussion fetching for scoring
area: backend
files: []
---

## Problem

Link aggregator feeds (Hacker News, Lobsters, Reddit, etc.) publish RSS items where the actual content lives behind a link — the feed entry itself is just a title and URL. The current scoring and categorization pipeline only sees the RSS metadata (title, summary, feed-level description), which means it misses the real substance of the article.

Additionally, these aggregator entries often have a separate discussion/comments URL. The discussion thread can contain valuable signal about whether the linked content is worth reading — e.g., expert commentary, corrections, or debate — but we currently ignore it entirely.

## Solution

1. **New user setting** (opt-in): "Fetch linked content for scoring" or similar. When enabled:
   - During feed processing, detect if an article's content is just a link to external content (heuristic: short body, prominent outbound URL, known aggregator feed patterns)
   - Fetch the linked page and extract its main content (readability-style extraction)
   - Feed the extracted content into the categorization and scoring pipeline alongside the original article metadata

2. **Discussion URL detection and summarization**:
   - Detect if the feed entry has a separate comments/discussion URL (HN `comments` link, Reddit thread, etc.)
   - Optionally fetch and summarize the discussion
   - Surface a "discussion summary" or "discussion worth reading" signal to the user

3. **Key design considerations**:
   - Rate limiting and politeness (respect robots.txt, add delays)
   - Caching fetched content to avoid re-fetching on re-score
   - Handling fetch failures gracefully (fall back to RSS-only scoring)
   - Content extraction quality (may need readability/trafilatura-style library)
   - Token budget management — linked articles can be long, need to truncate/summarize before sending to LLM
   - Whether discussion fetching is a separate setting from content fetching
