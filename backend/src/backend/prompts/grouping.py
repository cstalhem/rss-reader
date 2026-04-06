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

    return f"""Propose parent group names that could organize the categories listed below.

**Rules:**
1. Theme names should be concise (1-2 words).
2. Themes may reuse a category name if it works as a broader parent.
3. Each theme should cover a distinct topic. If a theme would span multiple clearly different sub-domains, split it into separate, more specific themes.
4. Propose enough themes to cover as many categories as possible. No single theme should need more than ~25 children.

**Examples of good vs bad theme splitting:**

Given categories: Piano, Drums, Oil Painting, Sculpture, Ballet, Jazz, Hip Hop
- Bad: "Arts" (too broad — music, visual arts, and dance are distinct)
- Good: "Music", "Visual Arts", "Dance"

Given categories: Python, Docker, PostgreSQL, React, Kubernetes, MongoDB
- Bad: "Software" (covers everything)
- Good: "Programming Languages", "DevOps", "Databases", "Frontend"

Given categories: Cycling, Nutrition, Yoga, Surgery, Pharmacy, Marathon
- Bad: "Health" (mixes fitness, medicine, and diet)
- Good: "Fitness", "Medicine", "Nutrition"

**All categories:**
{categories_list}

Propose the themes now."""


def build_assignment_prompt(all_categories: list[str], themes: list[str]) -> str:
    """Build prompt asking the LLM to assign categories to proposed themes.

    Takes the themes from phase 1 and asks the model to create parent-child
    assignments using those themes as group parents.
    """
    categories_list = "\n".join(f"- {name}" for name in sorted(all_categories))
    themes_list = "\n".join(f"- {theme}" for theme in themes)

    return f"""Assign each category below to the best-fitting theme. Each theme becomes a parent group.

**Proposed themes:**
{themes_list}

**All categories:**
{categories_list}

**Examples of good vs bad assignment:**

Themes: "Fitness", "Cooking", "Medicine"
Categories: Yoga, Running, Recipes, Baking, Surgery, Pharmacy, Meal Prep, Stretching
- Bad: leaving "Meal Prep" ungrouped because it's not exactly "Cooking"
- Good: Fitness → Yoga, Running, Stretching | Cooking → Recipes, Baking, Meal Prep | Medicine → Surgery, Pharmacy

Themes: "Programming Languages", "DevOps", "Databases"
Categories: Python, Docker, PostgreSQL, CI/CD, Git, MySQL, Terraform, Ruby
- Bad: leaving "Git" and "CI/CD" ungrouped because they aren't exactly "DevOps tools"
- Good: Programming Languages → Python, Ruby | DevOps → Docker, CI/CD, Git, Terraform | Databases → PostgreSQL, MySQL

Themes: "Wildlife", "Agriculture", "Climate"
Categories: Bears, Farming, Drought, Irrigation, Wolves, Coral Reefs, Soil
- Bad: leaving "Irrigation" and "Soil" ungrouped
- Good: Wildlife → Bears, Wolves, Coral Reefs | Agriculture → Farming, Irrigation, Soil | Climate → Drought

**Rules (follow strictly):**
1. Use the provided category names exactly as written for children.
2. Use the proposed theme names as parent group names.
3. Each group must have at least two children.
4. Prefer assigning categories to a theme. Only leave a category ungrouped if it truly does not fit any theme. However, do not force unrelated categories into the same group just because the theme name is broad enough.
5. No nested groups — only one level of parent-child.
6. Each category may appear in at most one group.

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
