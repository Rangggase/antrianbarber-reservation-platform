"""Reservation business rules. No FastAPI request/response objects here, only AppError.

Concurrency model: correctness never relies on the application-level checks alone.
PostgreSQL enforces (a) no overlapping bookings per barber (exclusion constraint) and
(b) one active booking per customer per local day (partial unique index); this module
turns those database violations into clear 409 responses. Concurrent requests for the
same phone are additionally serialised by locking the customer row.
"""
import base64
from datetime import date, datetime, timedelta, timezone
import hashlib
import hmac
import logging
import os
import secrets
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..errors import AppError
from ..models import Barber, Booking, Customer, Schedule, Service
from ..schemas import BookingCreate

logger = logging.getLogger("antrian_barber.booking")

LOCAL_ZONE = ZoneInfo("Asia/Jakarta")
BLOCKING_STATUSES = ("pending", "confirmed", "in_service", "completed")
BOOKING_LEAD_MINUTES = 30
MAX_DAYS_IN_ADVANCE = 60

CUSTOMER_PHONE_CONSTRAINT = "uq_customers_phone"
CUSTOMER_DAY_CONSTRAINT = "uq_bookings_customer_local_day_active"
CUSTOMER_DAY_MESSAGE = "Nomor pelanggan sudah memiliki tiket aktif pada tanggal tersebut"


# --- access tokens -------------------------------------------------------------

def _secret() -> bytes:
    secret = os.getenv("BOOKING_TOKEN_SECRET", "")
    if len(secret) < 32:
        raise AppError(503, "token_secret_missing", "BOOKING_TOKEN_SECRET belum dikonfigurasi (minimal 32 karakter)")
    return secret.encode("utf-8")


def make_access_token(booking: Booking) -> str:
    payload = f"booking:v1:{booking.id}:{booking.reference_code}".encode()
    digest = hmac.new(_secret(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def _authorize(booking: Booking, token: str | None) -> None:
    if not token or not hmac.compare_digest(token, make_access_token(booking)):
        raise AppError(403, "invalid_token", "Token reservasi tidak valid")


# --- helpers -------------------------------------------------------------------

def _as_utc(dt: datetime) -> datetime:
    # SQLite testing returns timezone-naive timestamps; they were stored as UTC.
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def validate_date(day: date) -> None:
    today = datetime.now(LOCAL_ZONE).date()
    if day < today or day > today + timedelta(days=MAX_DAYS_IN_ADVANCE):
        raise AppError(422, "date_out_of_range", "Tanggal harus antara hari ini dan 60 hari ke depan")


def get_active(session: Session, model, object_id: int, name: str):
    record = session.get(model, object_id)
    if record is None or not record.is_active:
        raise AppError(404, "not_found", f"{name} tidak ditemukan atau tidak aktif")
    return record


def available_starts(session: Session, barber_id: int, service: Service, day: date) -> list[datetime]:
    schedules = session.scalars(select(Schedule).where(
        Schedule.barber_id == barber_id,
        Schedule.weekday == day.weekday(),
        Schedule.is_active.is_(True),
    )).all()
    if not schedules:
        return []
    earliest = datetime.now(LOCAL_ZONE) + timedelta(minutes=BOOKING_LEAD_MINUTES)
    day_begin_utc = datetime.combine(day, datetime.min.time(), LOCAL_ZONE).astimezone(timezone.utc)
    day_end_utc = day_begin_utc + timedelta(days=1)
    booked = session.scalars(select(Booking).where(
        Booking.barber_id == barber_id,
        Booking.status.in_(BLOCKING_STATUSES),
        Booking.starts_at < day_end_utc,
        Booking.ends_at > day_begin_utc,
    )).all()
    result: list[datetime] = []
    for s in schedules:
        start = datetime.combine(day, s.start_time, LOCAL_ZONE)
        end = datetime.combine(day, s.end_time, LOCAL_ZONE)
        while start + timedelta(minutes=service.duration_minutes) <= end:
            finish = start + timedelta(minutes=service.duration_minutes)
            if start >= earliest and not any(
                start.astimezone(timezone.utc) < _as_utc(b.ends_at)
                and finish.astimezone(timezone.utc) > _as_utc(b.starts_at)
                for b in booked
            ):
                result.append(start)
            start += timedelta(minutes=30)
    return sorted(set(result))


# --- queries -------------------------------------------------------------------

def list_services(session: Session) -> list[Service]:
    return list(session.scalars(select(Service).where(Service.is_active.is_(True)).order_by(Service.id)).all())


def list_barbers(session: Session) -> list[Barber]:
    return list(session.scalars(select(Barber).where(Barber.is_active.is_(True)).order_by(Barber.id)).all())


def get_slots(session: Session, barber_id: int, service_id: int, day: date) -> list[datetime]:
    validate_date(day)
    get_active(session, Barber, barber_id, "Barber")
    service = get_active(session, Service, service_id, "Layanan")
    return available_starts(session, barber_id, service, day)


# --- create --------------------------------------------------------------------

def _violation(exc: IntegrityError) -> tuple[str | None, str | None]:
    orig = getattr(exc, "orig", None)
    sqlstate = getattr(orig, "sqlstate", None)
    constraint = getattr(getattr(orig, "diag", None), "constraint_name", None)
    return sqlstate, constraint


def _insert_booking(session: Session, body: BookingCreate, service: Service, start_local: datetime) -> Booking:
    start_utc = start_local.astimezone(timezone.utc)
    ends_utc = (start_local + timedelta(minutes=service.duration_minutes)).astimezone(timezone.utc)
    customer = session.scalar(select(Customer).where(Customer.phone == body.phone).with_for_update())
    if customer is None:
        customer = Customer(full_name=body.full_name, phone=body.phone)
        session.add(customer)
        session.flush()
    else:
        # The FOR UPDATE lock above serialises concurrent requests for one phone, so this check
        # is race-free here; the partial unique index guards every other writer.
        local_day_start = datetime.combine(start_local.date(), datetime.min.time(), LOCAL_ZONE)
        next_day_start = local_day_start + timedelta(days=1)
        duplicate = session.scalar(select(Booking.id).where(
            Booking.customer_id == customer.id,
            Booking.status.in_(BLOCKING_STATUSES),
            Booking.starts_at >= local_day_start.astimezone(timezone.utc),
            Booking.starts_at < next_day_start.astimezone(timezone.utc),
        ).limit(1))
        if duplicate is not None:
            raise AppError(409, "customer_day_conflict", CUSTOMER_DAY_MESSAGE)
    booking = Booking(
        reference_code=f"AB-{start_local:%Y%m%d}-{secrets.token_hex(5).upper()}",
        customer_id=customer.id,
        barber_id=body.barber_id,
        service_id=body.service_id,
        starts_at=start_utc,
        ends_at=ends_utc,
        status="pending",
        price_idr=service.price_idr,
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)
    return booking


def _conflict_from(exc: IntegrityError) -> AppError:
    sqlstate, constraint = _violation(exc)
    if sqlstate == "23P01":
        return AppError(409, "slot_taken", "Jadwal barber sudah dipesan")
    if sqlstate == "23505" and constraint == CUSTOMER_DAY_CONSTRAINT:
        return AppError(409, "customer_day_conflict", CUSTOMER_DAY_MESSAGE)
    if sqlstate == "23505":
        return AppError(409, "conflict", "Konflik data saat menyimpan; silakan ulangi")
    return AppError(409, "booking_not_saved", "Reservasi tidak dapat disimpan")


def create_booking(session: Session, body: BookingCreate) -> tuple[Booking, str]:
    # Fail closed when token signing is not configured; no records are written.
    _secret()
    get_active(session, Barber, body.barber_id, "Barber")
    service = get_active(session, Service, body.service_id, "Layanan")
    start_local = body.starts_at.astimezone(LOCAL_ZONE)
    validate_date(start_local.date())
    if start_local not in available_starts(session, body.barber_id, service, start_local.date()):
        raise AppError(409, "slot_unavailable", "Slot tidak tersedia atau tidak sesuai jadwal")
    for attempt in (1, 2):
        try:
            booking = _insert_booking(session, body, service, start_local)
            return booking, make_access_token(booking)
        except IntegrityError as exc:
            session.rollback()
            sqlstate, constraint = _violation(exc)
            if attempt == 1 and sqlstate == "23505" and constraint == CUSTOMER_PHONE_CONSTRAINT:
                # Two first-time requests for one phone raced on the customer row: retry once,
                # the winner's customer now exists and the day rule is evaluated normally.
                logger.info("retrying booking after concurrent customer insert")
                continue
            logger.info("booking rejected by database sqlstate=%s constraint=%s", sqlstate, constraint)
            raise _conflict_from(exc) from exc
    raise AssertionError("unreachable")  # pragma: no cover


# --- read / cancel -------------------------------------------------------------

def _find(session: Session, reference_code: str) -> Booking:
    booking = session.scalar(select(Booking).where(Booking.reference_code == reference_code))
    if booking is None:
        raise AppError(404, "booking_not_found", "Reservasi tidak ditemukan")
    return booking


def get_booking(session: Session, reference_code: str, token: str | None) -> Booking:
    booking = _find(session, reference_code)
    _authorize(booking, token)
    return booking


def cancel_booking(session: Session, reference_code: str, token: str | None) -> Booking:
    booking = _find(session, reference_code)
    _authorize(booking, token)
    if booking.status not in ("pending", "confirmed"):
        raise AppError(409, "not_cancellable", "Reservasi sudah tidak dapat dibatalkan")
    if _as_utc(booking.starts_at) <= datetime.now(timezone.utc):
        raise AppError(409, "already_started", "Waktu reservasi sudah dimulai")
    booking.status = "cancelled"
    session.commit()
    session.refresh(booking)
    return booking
