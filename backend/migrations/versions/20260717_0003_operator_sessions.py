"""Create durable operator sessions.

Revision ID: 20260717_0003
Revises: 20260717_0002
Create Date: 2026-08-05
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260717_0003"
down_revision = "20260717_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "operator_sessions",
        sa.Column("session_hash", sa.String(length=64), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_operator_session_expires",
        "operator_sessions",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_operator_session_expires", table_name="operator_sessions")
    op.drop_table("operator_sessions")