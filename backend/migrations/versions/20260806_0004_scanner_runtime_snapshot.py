"""Create durable scanner runtime snapshot.

Revision ID: 20260806_0004
Revises: 20260717_0003
Create Date: 2026-08-06
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260806_0004"
down_revision = "20260717_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scanner_runtime_snapshots",
        sa.Column("snapshot_key", sa.String(length=32), primary_key=True),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("scanner_runtime_snapshots")
