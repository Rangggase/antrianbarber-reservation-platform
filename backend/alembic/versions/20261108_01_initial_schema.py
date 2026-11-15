"""Initial Antrian Barber relational schema (5 tables).

Revision ID: 20261108_01
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "20261108_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("phone", name="uq_customers_phone"),
    )
    op.create_table(
        "barbers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("specialty", sa.String(180)),
        sa.Column("bio", sa.Text()),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("code", name="uq_barbers_code"),
    )
    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price_idr", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("code", name="uq_services_code"),
        sa.CheckConstraint("duration_minutes > 0", name="ck_services_duration_positive"),
        sa.CheckConstraint("price_idr >= 0", name="ck_services_price_nonnegative"),
    )
    op.create_table(
        "schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("barber_id", sa.Integer(), sa.ForeignKey("barbers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(timezone=False), nullable=False),
        sa.Column("end_time", sa.Time(timezone=False), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_schedules_weekday_range"),
        sa.CheckConstraint("start_time < end_time", name="ck_schedules_valid_interval"),
        sa.UniqueConstraint("barber_id", "weekday", "start_time", "end_time", name="uq_schedule_barber_weekday_interval"),
    )
    op.create_index("ix_schedules_barber_weekday", "schedules", ["barber_id", "weekday"])
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reference_code", sa.String(32), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("barber_id", sa.Integer(), sa.ForeignKey("barbers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("service_id", sa.Integer(), sa.ForeignKey("services.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column("queue_number", sa.Integer()),
        sa.Column("price_idr", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("reference_code", name="uq_bookings_reference_code"),
        sa.CheckConstraint("starts_at < ends_at", name="ck_bookings_valid_interval"),
        sa.CheckConstraint("price_idr >= 0", name="ck_bookings_price_nonnegative"),
        sa.CheckConstraint("queue_number IS NULL OR queue_number > 0", name="ck_bookings_queue_positive"),
        sa.CheckConstraint("status IN ('pending', 'confirmed', 'in_service', 'completed', 'cancelled', 'no_show')", name="ck_bookings_allowed_status"),
    )
    op.create_index("ix_bookings_barber_start", "bookings", ["barber_id", "starts_at"])
    op.create_index("ix_bookings_customer_start", "bookings", ["customer_id", "starts_at"])
    op.create_index("ix_bookings_status_start", "bookings", ["status", "starts_at"])

    # PostgreSQL-only DB-level guard: overlapping appointments for one barber
    # cannot both exist, including under concurrent transactions.
    # Requires CREATE permission for btree_gist extension on this database.
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
        op.execute("""
            ALTER TABLE bookings
            ADD CONSTRAINT ex_bookings_barber_time_overlap
            EXCLUDE USING gist (
                barber_id WITH =,
                tstzrange(starts_at, ends_at, '[)') WITH &&
            ) WHERE (status IN ('pending', 'confirmed', 'in_service', 'completed'))
        """)


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS ex_bookings_barber_time_overlap")
    op.drop_index("ix_bookings_status_start", table_name="bookings")
    op.drop_index("ix_bookings_customer_start", table_name="bookings")
    op.drop_index("ix_bookings_barber_start", table_name="bookings")
    op.drop_table("bookings")
    op.drop_index("ix_schedules_barber_weekday", table_name="schedules")
    op.drop_table("schedules")
    op.drop_table("services")
    op.drop_table("barbers")
    op.drop_table("customers")
    # We deliberately keep btree_gist because other DB objects may use it.
