"""Back-office rules: login, daily queue, booking status workflow and queue numbers.

Status workflow (everything else is rejected with 409 invalid_transition):

    pending    -> confirmed | cancelled
    confirmed  -> in_service | cancelled | no_show   (no_show only once the start time passed)
    in_service -> completed
    completed, cancelled, no_show are final.

A queue number is assigned once, when a booking is first confirmed: the next number for that
barber on that Asia/Jakarta day. Numbers are never reused. Assignment is serialised per barber
with a row lock, and a partial unique index is the safety net that makes duplicates impossible
even for writers that bypass this code (a collision, if it ever happens, is retried).
"""
from datetime import date, datetime, timedelta, timezone
import logging

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..errors import AppError
from ..models import Barber, Booking, StaffUser
from ..schemas import StaffBooking
from ..security.passwords import DUMMY_HASH, verify_password
from .booking_service import LOCAL_ZONE, _as_utc, _violation

logger = logging.getLogger("antrian_barber.staff")

TRANSITIONS: dict[str, tuple[str, ...]] = {
    "pending": ("confirmed", "cancelled"),
    "confirmed": ("in_service", "cancelled", "no_show"),
    "in_service": ("completed",),
}
ALL_STATUSES = ("pending", "confirmed", "in_service", "completed", "cancelled", "no_show")
QUEUE_CONSTRAINT = "uq_bookings_barber_local_day_queue"
MAX_QUEUE_RETRIES = 3


def authenticate(session: Session, username: str, password: str) -> StaffUser:
    user = session.scalar(select(StaffUser).where(StaffUser.username == username.strip().lower()))
    # Always run one scrypt verification so unknown usernames cost the same as wrong passwords.
    password_ok = verify_password(password, user.password_hash if user else DUMMY_HASH)
    if user is None or not user.is_active or not password_ok:
        raise AppError(401, "invalid_credentials", "Username atau password salah")
    user.last_login_at = datetime.now(timezone.utc)
    session.commit()
    return user


def _day_window(day: date) -> tuple[datetime, datetime]:
    begin = datetime.combine(day, datetime.min.time(), LOCAL_ZONE).astimezone(timezone.utc)
    return begin, begin + timedelta(days=1)


def _effective_barber(session: Session, staff: StaffUser, barber_id: int | None) -> int | None:
    if staff.role == "barber":
        if barber_id is not None and barber_id != staff.barber_id:
            raise AppError(403, "forbidden", "Anda hanya dapat melihat antrean barber Anda sendiri")
        return staff.barber_id
    if barber_id is not None and session.get(Barber, barber_id) is None:
        raise AppError(404, "not_found", "Barber tidak ditemukan")
    return barber_id


def _view(booking: Booking) -> StaffBooking:
    return StaffBooking(
        reference_code=booking.reference_code,
        customer_name=booking.customer.full_name,
        customer_phone=booking.customer.phone,
        barber_id=booking.barber_id,
        barber_name=booking.barber.full_name,
        service_id=booking.service_id,
        service_name=booking.service.name,
        starts_at=booking.starts_at,
        ends_at=booking.ends_at,
        status=booking.status,
        queue_number=booking.queue_number,
        price_idr=booking.price_idr,
        allowed_next=list(TRANSITIONS.get(booking.status, ())),
    )


def get_queue(session: Session, staff: StaffUser, day: date, barber_id: int | None) -> tuple[int | None, list[StaffBooking], dict[str, int]]:
    scope = _effective_barber(session, staff, barber_id)
    begin, end = _day_window(day)
    query = select(Booking).where(Booking.starts_at >= begin, Booking.starts_at < end)
    if scope is not None:
        query = query.where(Booking.barber_id == scope)
    bookings = list(session.scalars(query.order_by(Booking.starts_at, Booking.id)).all())
    counts = {status: 0 for status in ALL_STATUSES}
    for booking in bookings:
        counts[booking.status] = counts.get(booking.status, 0) + 1
    return scope, [_view(b) for b in bookings], counts


def _next_queue_number(session: Session, booking: Booking) -> int:
    # Serialise number assignment per barber: concurrent confirmations take turns instead of
    # racing (and retrying) for the same number. FOR NO KEY UPDATE does not block customers
    # creating bookings, whose foreign-key check only needs FOR KEY SHARE on the barber row.
    session.scalar(select(Barber.id).where(Barber.id == booking.barber_id).with_for_update(key_share=True))
    local_day = _as_utc(booking.starts_at).astimezone(LOCAL_ZONE).date()
    begin, end = _day_window(local_day)
    highest = session.scalar(select(func.max(Booking.queue_number)).where(
        Booking.barber_id == booking.barber_id, Booking.starts_at >= begin, Booking.starts_at < end,
    ))
    return (highest or 0) + 1


def change_status(session: Session, staff: StaffUser, reference_code: str, new_status: str) -> StaffBooking:
    for attempt in range(1, MAX_QUEUE_RETRIES + 1):
        booking = session.scalar(select(Booking).where(Booking.reference_code == reference_code).with_for_update())
        # Out-of-scope bookings look exactly like missing ones.
        if booking is None or (staff.role == "barber" and booking.barber_id != staff.barber_id):
            raise AppError(404, "booking_not_found", "Reservasi tidak ditemukan")
        allowed = TRANSITIONS.get(booking.status, ())
        if new_status not in allowed:
            options = ", ".join(allowed) if allowed else "tidak ada (status akhir)"
            raise AppError(409, "invalid_transition", f"Status {booking.status} tidak dapat diubah ke {new_status}. Pilihan: {options}")
        if new_status == "no_show" and _as_utc(booking.starts_at) > datetime.now(timezone.utc):
            raise AppError(409, "too_early", "Tandai tidak hadir hanya setelah jam reservasi dimulai")
        previous = booking.status
        if new_status == "confirmed" and booking.queue_number is None:
            booking.queue_number = _next_queue_number(session, booking)
        booking.status = new_status
        try:
            session.commit()
        except IntegrityError as exc:
            session.rollback()
            _, constraint = _violation(exc)
            if constraint == QUEUE_CONSTRAINT and attempt < MAX_QUEUE_RETRIES:
                logger.info("queue number collision, retrying attempt=%s", attempt)
                continue
            raise AppError(409, "conflict", "Konflik saat menyimpan; silakan ulangi") from exc
        session.refresh(booking)
        logger.info("status change staff_id=%s role=%s %s->%s", staff.id, staff.role, previous, new_status)
        return _view(booking)
    raise AssertionError("unreachable")  # pragma: no cover
