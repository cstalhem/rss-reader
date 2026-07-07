# Fetch-through extracts HTML with trafilatura, then reuses the existing html_to_markdown converter

trafilatura can emit its extracted main content directly as markdown, so the obvious path is `extract(html, output_format="markdown")`. We deliberately do *not*: we call `extract(html, output_format="html")` to get the cleaned main-content HTML, then run that through the existing `markdown.py` `html_to_markdown` (bs4 + markdownify) — the same converter RSS content already flows through. This makes `html_to_markdown` the single canonical markdown converter in the codebase, reached additively (no change to the RSS ingest path).

The reason is consistency of LLM input. Fetched content and RSS content then share one markdown flavor *and* one tag-stripping policy (drop `script/style/iframe/noscript`, strip `a/img/figure` to text) — which matters for the evals planned post-2.0, where uniformly-formatted inputs are easier to reason about, and which strips link/image noise that costs tokens without adding relevance signal. The alternative markdown-flavor divergence is invisible to the LLM but would fragment eval data.

We fetch the page ourselves via `httpx` and pass the HTML string to trafilatura (extraction only) — trafilatura's own downloader is sync/urllib3, blocks the event loop, and does no content-type filtering, so it is unused. Requires `trafilatura>=2.1.0` (floors `lxml>=6.1.1`, which ships Python 3.14 wheels).

## Consequences

- Trafilatura is used purely as an extraction library; all networking, timeouts, size limits, content-type checks, and per-host politeness are owned by our fetch code (see ADR-0011).
- Extracted content is stored only in `linked_content_markdown`, never overwriting the RSS `content_markdown` — so the reader surface and RSS fallback are untouched.
- Char budgets for prompt content (`content.py`) move into config as part of this work, since fetched full-articles routinely hit the budget where RSS summaries did not, and the right value is unknown until evals.
