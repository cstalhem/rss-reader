"""LLM prompt templates and response schemas for category grouping."""

from pydantic import BaseModel, Field


class GroupSuggestion(BaseModel):
    parent: str = Field(description="Category name to use as group parent (may be new)")
    children: list[str] = Field(
        description="Existing category names to place under this parent", min_length=2
    )


class GroupingResponse(BaseModel):
    groups: list[GroupSuggestion] = Field(
        default_factory=list, description="Suggested groupings"
    )


class ThemeResponse(BaseModel):
    themes: list[str] = Field(description="Proposed parent group theme names")


def build_theme_proposal_prompt(all_categories: list[str]) -> str:
    """Build prompt asking the LLM to propose broad thematic parent group names.

    This prompt deliberately omits existing groups to avoid anchoring bias.
    """
    categories_list = "\n".join(f"- {name}" for name in sorted(all_categories))

    return f"""Propose broad thematic group names that could organize these categories.

**All categories:**
{categories_list}

**Rules:**
1. Themes should be broader than individual categories — each theme is a potential parent group name.
2. Aim for themes that could each contain 2-20 categories.
3. Propose enough themes to cover most categories.
4. Theme names should be concise and descriptive (1-3 words).
5. Do not reuse exact category names as themes — create broader labels.

Propose the themes now."""


def build_assignment_prompt(all_categories: list[str], themes: list[str]) -> str:
    """Build prompt asking the LLM to assign categories to proposed themes.

    Takes the themes from phase 1 and asks the model to create parent-child
    assignments using those themes as group parents.
    """
    categories_list = "\n".join(f"- {name}" for name in sorted(all_categories))
    themes_list = "\n".join(f"- {theme}" for theme in themes)

    return f"""Assign each category to the best-fitting theme. Each theme becomes a parent group.

**All categories:**
{categories_list}

**Proposed themes:**
{themes_list}

**Rules (follow strictly):**
1. Use the provided category names exactly as written for children.
2. Use the proposed theme names as parent group names.
3. Each group must have at least two children. Never create a group with only one child — leave those categories ungrouped instead.
4. Categories that do not clearly fit any theme may remain ungrouped.
5. No nested groups — only one level of parent-child.
6. Each category may appear in at most one group.
7. If a group would have more than 15-20 children, break it into multiple smaller, more focused groups.

Assign the categories now."""


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

**Current groups (these are incomplete — many categories above are not yet assigned to any group):**
{chr(10).join(group_lines)}

Review and improve these groups. Add ungrouped categories to existing groups where they logically fit, and create new groups where multiple ungrouped categories share a clear theme.
"""

    return f"""Group these categories into logical parent-child relationships.

**All categories:**
{categories_list}
{existing_section}
**Rules (follow strictly):**
1. Use the provided category names exactly as written for children. Parent names may be new if no existing category fits as a good parent.
2. Use broader categories as parents and narrower ones as children.
3. Each group must have at least TWO children. Never create a group with only one child — leave those categories ungrouped instead.
4. Categories that do not clearly fit any group may remain ungrouped — but before leaving a category unparented, check if it could join an existing group or form a new group with other ungrouped categories.
5. No nested groups — only one level of parent-child.
6. Each category may appear in at most ONE group — never assign the same category to multiple parents.
7. Keep groups focused — if a group would have more than 15-20 children, break it into multiple smaller, more focused groups instead.

Group these categories now."""
