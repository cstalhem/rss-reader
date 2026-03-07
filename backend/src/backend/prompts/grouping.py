"""LLM prompt templates and response schemas for category grouping."""

from pydantic import BaseModel, Field


class GroupSuggestion(BaseModel):
    parent: str = Field(description="Existing category name to use as group parent")
    children: list[str] = Field(
        description="Existing category names to place under this parent", min_length=1
    )


class GroupingResponse(BaseModel):
    groups: list[GroupSuggestion] = Field(
        default=[], description="Suggested groupings"
    )


def build_grouping_prompt(
    all_categories: list[str],
    existing_groups: dict[str, list[str]],
) -> str:
    """Build prompt for LLM-based category grouping suggestions.

    Args:
        all_categories: All non-hidden category display names
        existing_groups: Current parent->children mapping for context

    Returns:
        Prompt string for grouping
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

    return f"""Group these categories into logical parent-child relationships.

**All categories:**
{categories_list}
{existing_section}
**Rules (follow strictly):**
1. ONLY use the provided category names exactly as written. Do NOT create new categories.
2. Use broader categories as parents and narrower ones as children.
3. Each group must have at least one child.
4. Categories that do not fit any group should remain unparented — do NOT force groupings.
5. No nested groups — only one level of parent-child.

Group these categories now."""
