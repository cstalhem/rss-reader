# Rate-limit state is owned by the Azure wrapper and keyed by deployment, not by task

Azure OpenAI quotas (TPM/RPM) attach to *deployments*, so when one task trips a 429, every task routed to the same deployment is throttled too. v1 tracked rate-limit state per task in module globals inside the scoring code — arbitrary but harmless when "rate limiting" meant local Ollama contention, incorrect against Azure. In v2 the Azure client wrapper is the single owner of pause state (`pause_until` per deployment, set from `Retry-After` with a 60s fallback): it checks the pause before calling and raises a typed `LLMUnavailable(retry_in)` when throttled. Queue workers know nothing about rate limits — they catch `LLMUnavailable`, leave the batch `queued` without incrementing attempts, and let the next scheduler tick retry.

## Consequences

- Rate-limited retries never count toward an article's failure attempts; only real call failures (`LLMCallFailed`) do.
- The scoring status endpoint derives its rate-limited flags from wrapper state; the queue contributes only per-task activity (current article, phase).
- Do not reintroduce rate-limit tracking in queue code — a task-scoped pause is the bug this replaces.

## Considered options

- **Queue-owned pause state (v1 topology):** rejected — wrong scope (task vs deployment) and forces the queue to speak the transport's protocol (parsing SDK exceptions for retry delays).
- **Wrapper sleeps internally instead of raising:** rejected — holds worker coroutines mid-batch and hides pacing from the scheduler-tick model.
- **Proactive pacing (token budgets, remaining-quota headers):** rejected as over-engineering for a single-user app; reactive `Retry-After` is proportionate.
