"""Public demo reservation API, using the existing v2.2b SQLAlchemy schema.

API deliberately provides no admin access and never exposes booking PII without a
signed, client-held token. A true production system will need auth/rate limiting.
"""
import base64
from datetime import date, datetime, timedelta, timezone
import hashlib
import hmac
import os
import re
import secrets
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_engine
from ..models import Barber, Booking, Customer, Schedule, Service

router = APIRouter(prefix="/api/v1", tags=["Reservation Demo API"])
LOCAL_ZONE = ZoneInfo("Asia/Jakarta")
BLOCKING_STATUSES = ("pending", "confirmed", "in_service", "completed")
BOOKING_LEAD_MINUTES = 30
MAX_DAYS_IN_ADVANCE = 60


def get_session():
    with Session(get_engine()) as session:
        yield session


def _secret() -> bytes:
    secret = os.getenv("BOOKING_TOKEN_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="BOOKING_TOKEN_SECRET belum dikonfigurasi (minimal 32 karakter)")
    return secret.encode("utf-8")


def _make_access_token(booking: Booking) -> str:
    payload = f"booking:v1:{booking.id}:{booking.reference_code}".encode()
    digest = hmac.new(_secret(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def _authorize(booking: Booking, token: str | None):
    if not token or not hmac.compare_digest(token, _make_access_token(booking)):
        raise HTTPException(status_code=403, detail="Token reservasi tidak valid")


def _as_utc(dt: datetime) -> datetime:
    # SQLite testing returns timezone-naive timestamps; they were stored as UTC.
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _validate_date(day: date) -> None:
    today = datetime.now(LOCAL_ZONE).date()
    if day < today or day > today + timedelta(days=MAX_DAYS_IN_ADVANCE):
        raise HTTPException(status_code=422, detail="Tanggal harus antara hari ini dan 60 hari ke depan")


def _get_active(session: Session, model, object_id: int, name: str):
    record = session.get(model, object_id)
    if record is None or not record.is_active:
        raise HTTPException(status_code=404, detail=f"{name} tidak ditemukan atau tidak aktif")
    return record


def _available_starts(session: Session, barber_id: int, service: Service, day: date) -> list[datetime]:
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


class CatalogService(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    duration_minutes: int
    price_idr: int
    model_config = {"from_attributes": True}


class CatalogBarber(BaseModel):
    id: int
    code: str
    full_name: str
    specialty: str | None
    bio: str | None
    model_config = {"from_attributes": True}


class SlotList(BaseModel):
    date: date
    barber_id: int
    service_id: int
    timezone: str = "Asia/Jakarta"
    slots: list[datetime]


class BookingCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=20)
    barber_id: int = Field(gt=0)
    service_id: int = Field(gt=0)
    starts_at: datetime

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Nama minimal 2 karakter")
        return value

    @field_validator("phone")
    @classmethod
    def phone_indo(cls, value: str) -> str:
        value = re.sub(r"[\s-]", "", value)
        if not re.fullmatch(r"(?:\+62|0)8\d{8,11}", value):
            raise ValueError("Nomor ponsel Indonesia tidak valid")
        if value.startswith("+62"):
            value = "0" + value[3:]
        return value

    @field_validator("starts_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("starts_at harus ISO 8601 dengan zona waktu, contohnya +07:00")
        return value


class BookingView(BaseModel):
    reference_code: str
    barber_id: int
    service_id: int
    starts_at: datetime
    ends_at: datetime
    status: str
    price_idr: int
    # Does not return phone/name; reference_code alone grants no lookup.
    model_config = {"from_attributes": True}


class BookingCreated(BookingView):
    access_token: str


@router.get("/services", response_model=list[CatalogService])
def list_services(session: Session = Depends(get_session)):
    return session.scalars(select(Service).where(Service.is_active.is_(True)).order_by(Service.id)).all()


@router.get("/barbers", response_model=list[CatalogBarber])
def list_barbers(session: Session = Depends(get_session)):
    return session.scalars(select(Barber).where(Barber.is_active.is_(True)).order_by(Barber.id)).all()


@router.get("/availability", response_model=SlotList)
def get_availability(
    barber_id: Annotated[int, Query(gt=0)],
    service_id: Annotated[int, Query(gt=0)],
    day: Annotated[date, Query(alias="date")],
    session: Session = Depends(get_session),
):
    _validate_date(day)
    _get_active(session, Barber, barber_id, "Barber")
    service = _get_active(session, Service, service_id, "Layanan")
    return SlotList(date=day, barber_id=barber_id, service_id=service_id,
                    slots=_available_starts(session, barber_id, service, day))


@router.post("/bookings", response_model=BookingCreated, status_code=status.HTTP_201_CREATED)
def create_booking(body: BookingCreate, session: Session = Depends(get_session)):
    # Fail closed when token signing is not configured; no records are written.
    _secret()
    _get_active(session, Barber, body.barber_id, "Barber")
    service = _get_active(session, Service, body.service_id, "Layanan")
    start_local = body.starts_at.astimezone(LOCAL_ZONE)
    _validate_date(start_local.date())
    if start_local not in _available_starts(session, body.barber_id, service, start_local.date()):
        raise HTTPException(status_code=409, detail="Slot tidak tersedia atau tidak sesuai jadwal")
    start_utc = start_local.astimezone(timezone.utc)
    ends_utc = (start_local + timedelta(minutes=service.duration_minutes)).astimezone(timezone.utc)
    try:
        customer = session.scalar(select(Customer).where(Customer.phone == body.phone).with_for_update())
        if customer is None:
            customer = Customer(full_name=body.full_name, phone=body.phone)
            session.add(customer)
            session.flush()
        else:
            # Demo business rule: one active ticket per phone per local calendar day.
            # Race-free enforcement of this rule across concurrent requests requires
            # a further database migration; barber overlap is already DB-enforced.
            local_day_start = datetime.combine(start_local.date(), datetime.min.time(), LOCAL_ZONE)
            next_day_start = local_day_start + timedelta(days=1)
            duplicate = session.scalar(select(Booking.id).where(
                Booking.customer_id == customer.id,
                Booking.status.in_(BLOCKING_STATUSES),
                Booking.starts_at >= local_day_start.astimezone(timezone.utc),
                Booking.starts_at < next_day_start.astimezone(timezone.utc),
            ).limit(1))
            if duplicate is not None:
                raise HTTPException(status_code=409, detail="Nomor pelanggan sudah memiliki tiket aktif pada tanggal tersebut")
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
    except IntegrityError as exc:
        session.rollback()
        pgcode = getattr(getattr(exc, "orig", None), "sqlstate", None)
        if pgcode == "23P01":
            raise HTTPException(status_code=409, detail="Jadwal barber sudah dipesan") from exc
        if pgcode == "23505":
            raise HTTPException(status_code=409, detail="Konflik data saat menyimpan; silakan ulangi") from exc
        raise HTTPException(status_code=409, detail="Reservasi tidak dapat disimpan") from exc
    return BookingCreated(**BookingView.model_validate(booking).model_dump(),
                          access_token=_make_access_token(booking))


@router.get("/bookings/{reference_code}", response_model=BookingView)
def get_booking(
    reference_code: str,
    booking_token: Annotated[str | None, Header(alias="X-Booking-Token")] = None,
    session: Session = Depends(get_session),
):
    booking = session.scalar(select(Booking).where(Booking.reference_code == reference_code))
    if booking is None:
        raise HTTPException(status_code=404, detail="Reservasi tidak ditemukan")
    _authorize(booking, booking_token)
    return booking


@router.post("/bookings/{reference_code}/cancel", response_model=BookingView)
def cancel_booking(
    reference_code: str,
    booking_token: Annotated[str | None, Header(alias="X-Booking-Token")] = None,
    session: Session = Depends(get_session),
):
    booking = session.scalar(select(Booking).where(Booking.reference_code == reference_code))
    if booking is None:
        raise HTTPException(status_code=404, detail="Reservasi tidak ditemukan")
    _authorize(booking, booking_token)
    if booking.status not in ("pending", "confirmed"):
        raise HTTPException(status_code=409, detail="Reservasi sudah tidak dapat dibatalkan")
    if _as_utc(booking.starts_at) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="Waktu reservasi sudah dimulai")
    booking.status = "cancelled"
    session.commit()
    session.refresh(booking)
    return booking
