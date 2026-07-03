# Categories are a closed vocabulary with a single creation channel and alias memory

The categorization LLM can only assign categories from the active vocabulary, enforced by the response schema (not prompt instructions). New categories enter through exactly one channel — an explicit proposal field, used when nothing in the vocabulary fits — and go live immediately, flagged for user triage. Merging or renaming a category leaves an alias that deterministically resolves future proposals of the old name, so deleted junk can never be recreated.

## Why

v1 let category names flow in uncontrolled: any unrecognized string in the LLM response silently became a new category row. The scar tissue is visible in the code — a dedup migration (`8c6f3c9b8f70`), hallucinated-ID guards, and an "unhide hack" where the worker un-hides a category the user hid because prompt-level "NEVER assign" instructions proved unreliable. Closing the vocabulary at the schema level makes that entire bug class unrepresentable.

## Consequences

- There is no `hidden` category state. Suppression happens only through the weight axis (`block` zeroes an article's score; blocked articles remain inspectable in the blocked view). Blocked categories stay in the vocabulary so filtering stays labeled and auditable.
- Groups are display-only shelves (stored as `parent_id`, one level): no weight inheritance, never serialized into the prompt. This is what makes LLM auto-grouping safe — regrouping can never change what gets filtered.
- A `search_categories` tool for the LLM was considered and rejected: it solves a vocabulary-scale problem a single-user app doesn't have. Revisit only if the embedded list demonstrably hurts.
