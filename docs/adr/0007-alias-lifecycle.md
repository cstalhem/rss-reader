# Alias lifecycle: verbs write alias memory, explicit creation erases it

Aliases (ADR-0001) are written and erased as side effects of category verbs — never managed directly. Rename always leaves an alias from the old slug to the category. Merge repoints the source's existing aliases to the target before deleting the source, then leaves an alias for the source's own name — resolution stays single-hop forever, no chains. Delete (single and batch) always leaves a discard alias (`target_id NULL`), so removed junk stays dead. Explicitly creating a category whose slug matches an alias — or renaming one onto it — deletes that alias: a deliberate human act overrides remembered names.

## Why

- **No flags, no options**: every verb has exactly one alias behavior, so the user never decides "leave an alias?" per action. A harmless extra alias beats a resurrected junk name; the resolution ladder checks live categories first, so a stale alias can never shadow a real one.
- **Merge repoints explicitly rather than relying on `ON DELETE SET NULL`**: letting the FK degrade the source's aliases would silently turn redirects into discards — proposals of "Artificial Intelligence" would be dropped instead of landing on the merge survivor. `SET NULL` remains only as the safety net for raw deletes, where discard is the correct meaning.
- **Aliases target ids, not names**: renames never invalidate existing aliases, and repointing is an UPDATE, not a rewrite.

## Consequences

- Block is not part of the alias story: it sets weight only, and the category stays live in the vocabulary (ADR-0001).
- Rename onto a live category's name is refused (409) and pointed at merge — the two verbs stay distinct.
- Aliases are user-visible read-only (list endpoint) for auditability, but have no CRUD of their own; the only way to remove one is to create or rename a category onto its name.
