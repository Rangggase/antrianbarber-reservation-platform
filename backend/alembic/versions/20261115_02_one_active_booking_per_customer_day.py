"""Enforce one active booking per customer per local (Asia/Jakarta) day in the database.

Until now this rule was only checked in application code. The booking endpoint is
already race-free in practice (it locks the customer row with SELECT ... FOR UPDATE),
but that protection lives in one code path. A partial unique index makes the database
the final arbiter for EVERY writer (future admin endpoints, scripts, manual SQL).
PostgreSQL only; SQLite (used by quick unit tests) keeps relying on the application check.

Revision ID: 20261115_02
Revises: 20261108_01

If the upgrade fails with a unique violation, the table already holds two active
bookings for one customer on one local day. Cancel or fix one of them, then rerun.
"""
from alembic import op

revision = "20261115_02"
down_revision = "20261108_01"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_bookings_customer_local_day_active"


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    # timestamptz AT TIME ZONE <constant zone> is IMMUTABLE, so it is allowed in an index.
    op.execute(f"""
        CREATE UNIQUE INDEX {INDEX_NAME}
        ON bookings (customer_id, ((starts_at AT TIME ZONE 'Asia/Jakarta')::date))
        WHERE status IN ('pending', 'confirmed', 'in_service', 'completed')
    """)


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(f"DROP INDEX IF EXISTS {INDEX_NAME}")
