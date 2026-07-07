# All LLM tasks go through Azure AI Foundry; the local-first principle is retired

v2 deletes v1's provider plugin layer (~1,700 LOC: provider Protocol/registry, Ollama/Google routers, per-provider settings UI, encrypted key storage, model download manager) in favor of a single Azure OpenAI client using the `openai` SDK with structured outputs. Per-task model routing survives as a `llm.tasks` map in `app.yaml` (task → deployment name + batch size); endpoint and API key come from env vars.

## Why

v1's founding assumption was "local-first, no external APIs" — Ollama for privacy and zero cost. In practice, local models delivered inconsistent structured output (hand-rolled validation and retry throughout the pipeline) and capability ceilings the curation quality kept hitting. This deliberately trades that principle away: article content is sent to Azure, scoring requires network, and there is per-token cost. Accepted for a single-user app whose value lives in scoring quality.

## Consequences

- Rate-limit behavior differs from Ollama's; the scoring queue backoff needs retuning, not just re-pointing.
- Structured outputs (JSON-schema-enforced responses) replace hand-rolled validation — and enable the schema-level vocabulary enforcement in ADR-0001.
- No provider settings UI exists in v2; changing models is a config-file edit.
