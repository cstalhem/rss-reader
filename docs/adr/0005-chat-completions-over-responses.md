# LLM calls stay on Chat Completions, not the Responses API — until a tool-use feature lands

Azure/OpenAI recommend the Responses API for new projects, but every Responses advantage (server-side state via `previous_response_id`, reasoning-item reuse and its 40–80% cache gains, hosted tools, background mode) requires multi-turn or agentic behavior this app deliberately doesn't have. Our workload is stateless single-turn batch structured output, for which the two surfaces are documented as semantically equivalent — while Responses would add an Azure region gate (~28-region allowlist), a `store: true` default that persists prompts (including the user's interests prose) on Azure for 30 days unless suppressed on every call, and re-verification of the hard-won typed-error contract in the wrapper. Chat Completions is GA on the same `/openai/v1` surface, not deprecated, with no sunset.

## Consequences

- Revisit when the first tool-use feature lands — most likely the `search_categories` tool ADR-0001 flagged for revisit, or fetch-through via hosted web search. OpenAI has begun gating reasoning-model tool calling away from Chat Completions (GPT-5.4+), so tool use is the trigger, not a judgment call.
- Also revisit on any Chat Completions deprecation signal, or if "pro"-tier models (Responses-only) become worth routing to.
- Migration stays cheap by design: `chat.completions.parse` appears exactly once (the wrapper seam). The checklist when it happens: `messages`→`input`, `response_format=`→`text_format=`, `.choices[0].message.parsed`→`.output_parsed`, refusals move into output items, `store=False` on every call, confirm deployment regions support `/openai/v1/responses`.
