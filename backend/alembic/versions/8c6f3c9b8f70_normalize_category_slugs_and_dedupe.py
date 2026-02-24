"""normalize_category_slugs_and_dedupe

Revision ID: 8c6f3c9b8f70
Revises: dff7a4c52b3c
Create Date: 2026-02-24 13:40:00.000000

"""

from collections import defaultdict
from collections.abc import Sequence

import sqlalchemy as sa
from slugify import slugify

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8c6f3c9b8f70"
down_revision: str | Sequence[str] | None = "dff7a4c52b3c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _normalize_slug(display_name: str | None, slug_value: str | None) -> str:
    """Compute canonical slug for a category row."""
    if display_name:
        normalized = slugify(display_name)
        if normalized:
            return normalized
    if slug_value:
        normalized = slugify(slug_value)
        if normalized:
            return normalized
    return ""


def _choose_canonical_id(
    rows: list[dict],
    child_counts: dict[int, int],
) -> int:
    """Pick the row to keep for a duplicate slug group."""
    return int(
        min(
            rows,
            key=lambda row: (
                0 if child_counts.get(int(row["id"]), 0) > 0 else 1,
                0 if row["parent_id"] is None else 1,
                int(row["id"]),
            ),
        )["id"]
    )


def upgrade() -> None:
    """Normalize category slugs and merge duplicate categories."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _table_exists(inspector, "categories"):
        return

    rows = [
        dict(row)
        for row in bind.execute(
            sa.text(
                """
                SELECT
                  id,
                  display_name,
                  slug,
                  parent_id,
                  weight,
                  is_hidden,
                  is_seen,
                  is_manually_created
                FROM categories
                ORDER BY id
                """
            )
        )
        .mappings()
        .all()
    ]
    if not rows:
        return

    child_counts: dict[int, int] = defaultdict(int)
    for row in rows:
        parent_id = row["parent_id"]
        if parent_id is not None:
            child_counts[int(parent_id)] += 1

    groups_by_slug: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        normalized = _normalize_slug(row["display_name"], row["slug"])
        if normalized:
            groups_by_slug[normalized].append(row)

    canonical_for_id: dict[int, int] = {int(row["id"]): int(row["id"]) for row in rows}
    group_updates: list[dict] = []

    for normalized_slug, group_rows in groups_by_slug.items():
        keep_id = _choose_canonical_id(group_rows, child_counts)
        duplicate_ids = [int(r["id"]) for r in group_rows if int(r["id"]) != keep_id]

        keep_row = next(row for row in group_rows if int(row["id"]) == keep_id)
        merged_weight = keep_row["weight"]
        if merged_weight is None:
            merged_weight = next(
                (row["weight"] for row in group_rows if row["weight"] is not None),
                None,
            )

        merged_is_hidden = any(bool(row["is_hidden"]) for row in group_rows)
        merged_is_seen = any(bool(row["is_seen"]) for row in group_rows)
        merged_is_manually_created = any(
            bool(row["is_manually_created"]) for row in group_rows
        )

        group_updates.append(
            {
                "keep_id": keep_id,
                "slug": normalized_slug,
                "duplicate_ids": duplicate_ids,
                "weight": merged_weight,
                "is_hidden": merged_is_hidden,
                "is_seen": merged_is_seen,
                "is_manually_created": merged_is_manually_created,
            }
        )

        for row in group_rows:
            canonical_for_id[int(row["id"])] = keep_id

    # Repoint parent references before deleting duplicate rows.
    for row in rows:
        row_id = int(row["id"])
        parent_id = row["parent_id"]
        if parent_id is None:
            continue

        canonical_parent = canonical_for_id.get(int(parent_id), int(parent_id))
        if canonical_parent == row_id:
            canonical_parent = None

        if canonical_parent != parent_id:
            bind.execute(
                sa.text("UPDATE categories SET parent_id = :parent_id WHERE id = :id"),
                {"id": row_id, "parent_id": canonical_parent},
            )

    has_links_table = _table_exists(inspector, "article_category_link")

    for update in group_updates:
        duplicate_ids = update["duplicate_ids"]
        if not duplicate_ids:
            continue

        if has_links_table:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO article_category_link (article_id, category_id)
                    SELECT l.article_id, :keep_id
                    FROM article_category_link l
                    WHERE l.category_id IN :duplicate_ids
                      AND NOT EXISTS (
                        SELECT 1
                        FROM article_category_link existing
                        WHERE existing.article_id = l.article_id
                          AND existing.category_id = :keep_id
                      )
                    """
                ).bindparams(sa.bindparam("duplicate_ids", expanding=True)),
                {
                    "keep_id": update["keep_id"],
                    "duplicate_ids": duplicate_ids,
                },
            )

            bind.execute(
                sa.text(
                    "DELETE FROM article_category_link WHERE category_id IN :duplicate_ids"
                ).bindparams(sa.bindparam("duplicate_ids", expanding=True)),
                {"duplicate_ids": duplicate_ids},
            )

        bind.execute(
            sa.text("DELETE FROM categories WHERE id IN :duplicate_ids").bindparams(
                sa.bindparam("duplicate_ids", expanding=True)
            ),
            {"duplicate_ids": duplicate_ids},
        )

    # Apply canonical slug + merged metadata after duplicate rows are removed.
    for update in group_updates:
        bind.execute(
            sa.text(
                """
                UPDATE categories
                SET
                  slug = :slug,
                  weight = :weight,
                  is_hidden = :is_hidden,
                  is_seen = :is_seen,
                  is_manually_created = :is_manually_created
                WHERE id = :id
                """
            ),
            {
                "id": update["keep_id"],
                "slug": update["slug"],
                "weight": update["weight"],
                "is_hidden": update["is_hidden"],
                "is_seen": update["is_seen"],
                "is_manually_created": update["is_manually_created"],
            },
        )


def downgrade() -> None:
    """Downgrade not supported for lossy category deduplication."""
    pass
