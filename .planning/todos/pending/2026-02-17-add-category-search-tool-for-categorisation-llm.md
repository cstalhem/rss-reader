---
created: 2026-02-17T18:16:46.184Z
title: Add category search tool for categorisation LLM
area: backend
files:
  - backend/src/backend/scoring.py
  - backend/src/backend/models.py
---

## Problem

The categorisation LLM currently receives the full list of existing categories embedded in the system prompt. As the category list grows, this approach has drawbacks:

- **Context window pressure**: Every category name and parent relationship takes tokens, reducing space available for the actual article analysis
- **Staleness**: The prompt is static per call — if categories were recently added or renamed, the prompt may be out of date until the next prompt rebuild
- **Accuracy**: The LLM must match category names/IDs from memory rather than looking them up, increasing the chance of hallucinated or misspelled category names

## Solution

Replace the embedded category list with an Ollama tool-use approach:

1. **Define a `search_categories` tool** that the categorisation model can call during inference to look up existing categories by keyword/substring
2. **Tool returns** matching category names, their parent relationships, and IDs — giving the LLM accurate, up-to-date information
3. **Fallback for new categories**: If no match is found, the LLM can still propose a new category name (which gets created on the backend as today)
4. **Parent lookup**: The tool should also support looking up parent categories so the LLM can assign children to the correct parent

This requires an Ollama model that supports tool use (e.g., Llama 3.1+). The implementation should:
- Add a tool definition to the categorisation prompt
- Implement the search function against the category data in the database
- Handle the tool-call / tool-response loop in the Ollama client interaction
- Gracefully fall back to the current embedded-list approach if the model doesn't support tool use
