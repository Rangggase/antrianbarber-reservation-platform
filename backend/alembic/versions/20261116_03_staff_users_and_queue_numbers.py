"""Staff accounts and per-barber daily queue numbers.

- staff_users: back-office accounts (role admin | barber) with scrypt password hashes.
- PostgreSQL only: partial unique index so a barber never gets two bookings with the
  same queue number on the same Asia/Jakarta day, even under concurrent confirmations.

Revision ID: 20261116_03
Revises: 20261115_02
"""
from alembic import op
import sqlalchemy as sa

revision = "20261116_03"
down_revision = "20261115_02"
branch_labels = None
depends_on = None

QUEUE_INDEX = "uq_bookings_barber_local_day_queue"


def upgrade() -> None:
    op.create_table(
        "staff_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("barber_id", sa.Integer(), sa.ForeignKey("barbers.id", ondelete="RESTRICT")),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("username", name="uq_staff_users_username"),
        sa.CheckConstraint("role IN ('admin', 'barber')", name="ck_staff_users_allowed_role"),
        sa.CheckConstraint(
            "(role = 'barber' AND barber_id IS NOT NULL) OR (role = 'admin' AND barber_id IS NULL)",
            name="ck_staff_users_barber_link",
        ),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"""
            CREATE UNIQUE INDEX {QUEUE_INDEX}
            ON bookings (barber_id, ((starts_at AT TIME ZONE 'Asia/Jakarta')::date), queue_number)
            WHERE queue_number IS NOT NULL
        """)


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"DROP INDEX IF EXISTS {QUEUE_INDEX}")
    op.drop_table("staff_users")
