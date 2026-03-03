"""add_feed_folders

Revision ID: 55f0f2e37b8a
Revises: 8c6f3c9b8f70
Create Date: 2026-02-24 22:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "55f0f2e37b8a"
down_revision: str | Sequence[str] | None = "8c6f3c9b8f70"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    columns = inspector.get_columns(table_name)
    return any(column["name"] == column_name for column in columns)


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    indexes = inspector.get_indexes(table_name)
    return any(index["name"] == index_name for index in indexes)


def _sqlite_index_exists(bind, index_name: str) -> bool:
    row = bind.execute(
        sa.text(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name = :index_name"
        ),
        {"index_name": index_name},
    ).first()
    return row is not None


def _foreign_key_exists(inspector: sa.Inspector, table_name: str, fk_name: str) -> bool:
    fks = inspector.get_foreign_keys(table_name)
    return any(fk.get("name") == fk_name for fk in fks)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _table_exists(inspector, "feed_folders"):
        op.create_table(
            "feed_folders",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column(
                "display_order",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
        )

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "feed_folders"):
        if not _index_exists(inspector, "feed_folders", "ix_feed_folders_name"):
            op.create_index(
                "ix_feed_folders_name", "feed_folders", ["name"], unique=False
            )

        if not _index_exists(
            inspector, "feed_folders", "ix_feed_folders_display_order"
        ):
            op.create_index(
                "ix_feed_folders_display_order",
                "feed_folders",
                ["display_order"],
                unique=False,
            )

        if not _sqlite_index_exists(bind, "ux_feed_folders_name_lower"):
            op.create_index(
                "ux_feed_folders_name_lower",
                "feed_folders",
                [sa.text("lower(name)")],
                unique=True,
            )

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "feeds") and not _column_exists(
        inspector,
        "feeds",
        "folder_id",
    ):
        with op.batch_alter_table("feeds") as batch_op:
            batch_op.add_column(sa.Column("folder_id", sa.Integer(), nullable=True))

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "feeds") and _column_exists(
        inspector, "feeds", "folder_id"
    ):
        if not _foreign_key_exists(
            inspector, "feeds", "fk_feeds_folder_id_feed_folders"
        ):
            with op.batch_alter_table("feeds") as batch_op:
                batch_op.create_foreign_key(
                    "fk_feeds_folder_id_feed_folders",
                    "feed_folders",
                    ["folder_id"],
                    ["id"],
                    ondelete="SET NULL",
                )

        inspector = sa.inspect(bind)
        if not _index_exists(inspector, "feeds", "ix_feeds_folder_id"):
            op.create_index("ix_feeds_folder_id", "feeds", ["folder_id"], unique=False)

        if not _index_exists(inspector, "feeds", "ix_feeds_folder_id_display_order"):
            op.create_index(
                "ix_feeds_folder_id_display_order",
                "feeds",
                ["folder_id", "display_order"],
                unique=False,
            )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "feeds"):
        if _index_exists(inspector, "feeds", "ix_feeds_folder_id_display_order"):
            op.drop_index("ix_feeds_folder_id_display_order", table_name="feeds")

        inspector = sa.inspect(bind)
        if _index_exists(inspector, "feeds", "ix_feeds_folder_id"):
            op.drop_index("ix_feeds_folder_id", table_name="feeds")

        inspector = sa.inspect(bind)
        if _column_exists(inspector, "feeds", "folder_id"):
            with op.batch_alter_table("feeds") as batch_op:
                batch_op.drop_column("folder_id")

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "feed_folders"):
        if _sqlite_index_exists(bind, "ux_feed_folders_name_lower"):
            op.drop_index("ux_feed_folders_name_lower", table_name="feed_folders")

        inspector = sa.inspect(bind)
        if _index_exists(inspector, "feed_folders", "ix_feed_folders_display_order"):
            op.drop_index("ix_feed_folders_display_order", table_name="feed_folders")

        inspector = sa.inspect(bind)
        if _index_exists(inspector, "feed_folders", "ix_feed_folders_name"):
            op.drop_index("ix_feed_folders_name", table_name="feed_folders")

        op.drop_table("feed_folders")
