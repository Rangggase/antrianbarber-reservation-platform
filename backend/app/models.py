"""Relational data models for the Antrian Barber reservation domain.

All bookings store instants in UTC (TIMESTAMPTZ in PostgreSQL).
Weekly schedule times are local wall-clock times in Asia/Jakarta.
"""
from datetime import datetime, time

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Index,
    Integer, MetaData, SmallInteger, String, Text, Time,
    UniqueConstraint, func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    bookings: Mapped[list["Booking"]] = relationship(back_populates="customer")


class Barber(Base):
    __tablename__ = "barbers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    specialty: Mapped[str | None] = mapped_column(String(180), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    schedules: Mapped[list["Schedule"]] = relationship(back_populates="barber")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="barber")


class Service(Base):
    __tablename__ = "services"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="duration_positive"),
        CheckConstraint("price_idr >= 0", name="price_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    price_idr: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    bookings: Mapped[list["Booking"]] = relationship(back_populates="service")


class Schedule(Base):
    """Recurring availability (weekday: Monday=0 .. Sunday=6) in Asia/Jakarta."""
    __tablename__ = "schedules"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday_range"),
        CheckConstraint("start_time < end_time", name="valid_interval"),
        UniqueConstraint("barber_id", "weekday", "start_time", "end_time", name="uq_schedule_barber_weekday_interval"),
        Index("ix_schedules_barber_weekday", "barber_id", "weekday"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    barber_id: Mapped[int] = mapped_column(ForeignKey("barbers.id", ondelete="RESTRICT"), nullable=False)
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_time: Mapped[time] = mapped_column(Time(timezone=False), nullable=False)
    end_time: Mapped[time] = mapped_column(Time(timezone=False), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    barber: Mapped[Barber] = relationship(back_populates="schedules")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("starts_at < ends_at", name="valid_interval"),
        CheckConstraint("price_idr >= 0", name="price_nonnegative"),
        CheckConstraint("queue_number IS NULL OR queue_number > 0", name="queue_positive"),
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'in_service', 'completed', 'cancelled', 'no_show')",
            name="allowed_status",
        ),
        Index("ix_bookings_barber_start", "barber_id", "starts_at"),
        Index("ix_bookings_customer_start", "customer_id", "starts_at"),
        Index("ix_bookings_status_start", "status", "starts_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference_code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    barber_id: Mapped[int] = mapped_column(ForeignKey("barbers.id", ondelete="RESTRICT"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id", ondelete="RESTRICT"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="pending")
    queue_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_idr: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    customer: Mapped[Customer] = relationship(back_populates="bookings")
    barber: Mapped[Barber] = relationship(back_populates="bookings")
    service: Mapped[Service] = relationship(back_populates="bookings")
