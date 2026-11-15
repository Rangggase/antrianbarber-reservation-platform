"""Barber time off (leave days) that block new bookings.

Revision ID: 20261117_04
Revises: 20261116_03
"""
from alembic import op
import sqlalchemy as sa

revision = "20261117_04"
down_revision = "20261116_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "barber_time_off",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("barber_id", sa.Integer(), sa.ForeignKey("barbers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(180)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("ends_on >= starts_on", name="ck_barber_time_off_valid_range"),
    )
    op.create_index("ix_barber_time_off_barber_start", "barber_time_off", ["barber_id", "starts_on"])


def downgrade() -> None:
    op.drop_index("ix_barber_time_off_barber_start", table_name="barber_time_off")
    op.drop_table("barber_time_off")
