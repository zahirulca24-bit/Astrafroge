"""Widen signal lifecycle event IDs for deterministic transition keys.

Revision ID: 20260808_0005
Revises: 20260806_0004
Create Date: 2026-08-08
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260808_0005"
down_revision = "20260806_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Allow ``<64-char signal id>:<sequence>`` lifecycle event IDs."""

    with op.batch_alter_table("signal_lifecycle_history") as batch_op:
        batch_op.alter_column(
            "event_id",
            existing_type=sa.String(length=64),
            type_=sa.String(length=128),
            existing_nullable=False,
        )


def downgrade() -> None:
    """Restore the original width; downgrade requires compatible stored values."""

    with op.batch_alter_table("signal_lifecycle_history") as batch_op:
        batch_op.alter_column(
            "event_id",
            existing_type=sa.String(length=128),
            type_=sa.String(length=64),
            existing_nullable=False,
        )
