"""LLM prompt templates and response schemas for category grouping.

Response models are used as Azure structured-output schemas: keep them free
of JSON-schema constraint keywords and defaults that strict mode rejects —
rules are enforced by the prompt and validated in the router.
"""

from pydantic import BaseModel


class GroupSuggestion(BaseModel):
    parent: str
    children: list[str]


class GroupingResponse(BaseModel):
    groups: list[GroupSuggestion]


def build_grouping_prompt(
    all_categories: list[str],
    existing_groups: dict[str, list[str]],
) -> tuple[str, str]:
    """Build system prompt and user message for category grouping suggestions.

    Args:
        all_categories: All category display names
        existing_groups: Current parent->children mapping for context

    Returns:
        Tuple of (system_prompt, user_message)
    """
    categories_list = "\n".join(f"- {name}" for name in sorted(all_categories))

    existing_section = ""
    if existing_groups:
        group_lines = []
        for parent, children in sorted(existing_groups.items()):
            children_str = ", ".join(children)
            group_lines.append(f"  {parent} > {children_str}")
        existing_section = f"""

**Current groups (for context):**
{chr(10).join(group_lines)}
"""

    system_prompt = """Group categories into logical parent-child relationships.

**Rules (follow strictly):**
1. ONLY use the provided category names exactly as written. Do NOT create new categories.
2. Use broader categories as parents and narrower ones as children.
3. Each group must have at least TWO children. Never create a group with only one child — leave those categories ungrouped instead.
4. Categories that do not fit any group should remain unparented — do NOT force groupings.
5. No nested groups — only one level of parent-child.
6. Each category may appear in at most ONE group — never assign the same category to multiple parents."""

    user_message = f"""**All categories:**
{categories_list}
{existing_section}
Group these categories now."""

    return system_prompt, user_message
