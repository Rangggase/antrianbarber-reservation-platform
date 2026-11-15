"""Weekly working hours and time off (leave) per barber. Admin-only use.

- The weekly schedule is replaced as a whole (replace-all): simple to reason about and to edit as a grid.
  Bookings that already exist are never touched, even if they fall outside the new hours.
- Time off blocks NEW bookings (see booking_service.available_starts). Adding time off over days that
  still have active bookings is refused, so no customer is silently left with a barber who is away.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..errors import AppError
from ..models import Barber, Booking, BarberTimeOff, Schedule
from ..schemas import ScheduleInterval, ScheduleView, TimeOffCreate
from .booking_service import LOCAL_ZONE

ACTIVE_STATUSES = ("pending", "confirmed", "in_service")


def _barber(session: Session, barber_id: int) -> Barber:
    barber = session.get(Barber, barber_id)
    if barber is None:
        raise AppError(404, "not_found", "Barber tidak ditemukan")
    return barber


def get_schedule(session: Session, barber_id: int) -> ScheduleView:
    barber = _barber(session, barber_id)
    today = datetime.now(LOCAL_ZONE).date()
    intervals = session.scalars(select(Schedule).where(Schedule.barber_id == barber_id, Schedule.is_active.is_(True))
                                .order_by(Schedule.weekday, Schedule.start_time)).all()
    time_off = session.scalars(select(BarberTimeOff).where(BarberTimeOff.barber_id == barber_id, BarberTimeOff.ends_on >= today)
                               .order_by(BarberTimeOff.starts_on, BarberTimeOff.id)).all()
    return ScheduleView(
        barber_id=barber.id, barber_name=barber.full_name,
        intervals=[ScheduleInterval.model_validate(i) for i in intervals],
        time_off=list(time_off),
    )


def replace_schedule(session: Session, barber_id: int, intervals: list[ScheduleInterval]) -> ScheduleView:
    _barber(session, barber_id)
    by_day: dict[int, list[ScheduleInterval]] = {}
    for item in intervals:
        if item.start_time >= item.end_time:
            raise AppError(422, "invalid_schedule", "Jam mulai harus sebelum jam selesai")
        by_day.setdefault(item.weekday, []).append(item)
    for day_items in by_day.values():
        ordered = sorted(day_items, key=lambda i: i.start_time)
        if any(a.end_time > b.start_time for a, b in zip(ordered, ordered[1:])):
            raise AppError(422, "invalid_schedule", "Rentang jam pada hari yang sama tidak boleh saling tumpang tindih")
    session.execute(delete(Schedule).where(Schedule.barber_id == barber_id))
    session.add_all(Schedule(barber_id=barber_id, weekday=i.weekday, start_time=i.start_time, end_time=i.end_time, is_active=True) for i in intervals)
    session.commit()
    return get_schedule(session, barber_id)


def _active_bookings_in(session: Session, barber_id: int, first: date, last: date) -> int:
    begin = datetime.combine(first, datetime.min.time(), LOCAL_ZONE).astimezone(timezone.utc)
    finish = datetime.combine(last + timedelta(days=1), datetime.min.time(), LOCAL_ZONE).astimezone(timezone.utc)
    return session.scalar(select(func.count(Booking.id)).where(
        Booking.barber_id == barber_id, Booking.status.in_(ACTIVE_STATUSES), Booking.starts_at >= begin, Booking.starts_at < finish,
    )) or 0


def add_time_off(session: Session, barber_id: int, body: TimeOffCreate) -> BarberTimeOff:
    _barber(session, barber_id)
    if body.ends_on < body.starts_on:
        raise AppError(422, "invalid_range", "Tanggal akhir harus sama dengan atau setelah tanggal awal")
    if body.ends_on < datetime.now(LOCAL_ZONE).date():
        raise AppError(422, "time_off_in_past", "Cuti harus mencakup hari ini atau hari mendatang")
    pending = _active_bookings_in(session, barber_id, body.starts_on, body.ends_on)
    if pending:
        raise AppError(409, "time_off_conflict", f"Masih ada {pending} reservasi aktif pada rentang itu. Batalkan atau selesaikan dulu.")
    record = BarberTimeOff(barber_id=barber_id, starts_on=body.starts_on, ends_on=body.ends_on, reason=(body.reason or "").strip() or None)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def delete_time_off(session: Session, time_off_id: int) -> None:
    record = session.get(BarberTimeOff, time_off_id)
    if record is None:
        raise AppError(404, "not_found", "Data cuti tidak ditemukan")
    session.delete(record)
    session.commit()
