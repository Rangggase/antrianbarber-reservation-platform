"""Admin reports, aggregated in Python so they behave the same on PostgreSQL and SQLite.

Definitions:
- revenue: sum of price_idr of `completed` bookings (price is frozen when the booking is made)
- no_show_rate: no_show / (completed + no_show); cancelled and still-open bookings are not "resolved"
- peak hours: bookings that were not cancelled or no-show, by Asia/Jakarta start hour
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..errors import AppError
from ..models import Barber, Booking, Service
from ..schemas import ReportResponse, ReportRow
from .booking_service import LOCAL_ZONE, _as_utc
from .staff_service import ALL_STATUSES

MAX_RANGE_DAYS = 92


def default_range() -> tuple[date, date]:
    end = datetime.now(LOCAL_ZONE).date()
    return end - timedelta(days=29), end


def _rows(names: dict[int, str], stats: dict[int, dict[str, int]]) -> list[ReportRow]:
    rows = [
        ReportRow(id=key, name=names.get(key, f"#{key}"), total=s["total"], completed=s["completed"], no_show=s["no_show"], revenue_idr=s["revenue"])
        for key, s in stats.items()
    ]
    return sorted(rows, key=lambda r: (-r.revenue_idr, -r.total, r.name))


def build_report(session: Session, start: date, end: date) -> ReportResponse:
    if end < start:
        raise AppError(422, "invalid_range", "Tanggal akhir harus sama dengan atau setelah tanggal awal")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise AppError(422, "range_too_large", f"Rentang laporan maksimal {MAX_RANGE_DAYS} hari")

    begin = datetime.combine(start, datetime.min.time(), LOCAL_ZONE).astimezone(timezone.utc)
    finish = datetime.combine(end + timedelta(days=1), datetime.min.time(), LOCAL_ZONE).astimezone(timezone.utc)
    bookings = session.execute(select(Booking.starts_at, Booking.status, Booking.price_idr, Booking.barber_id, Booking.service_id)
                               .where(Booking.starts_at >= begin, Booking.starts_at < finish)).all()

    counts = {status: 0 for status in ALL_STATUSES}
    peak = [0] * 24
    by_service: dict[int, dict[str, int]] = {}
    by_barber: dict[int, dict[str, int]] = {}
    revenue = 0
    for starts_at, status, price, barber_id, service_id in bookings:
        counts[status] = counts.get(status, 0) + 1
        if status not in ("cancelled", "no_show"):
            peak[_as_utc(starts_at).astimezone(LOCAL_ZONE).hour] += 1
        for table, key in ((by_service, service_id), (by_barber, barber_id)):
            stat = table.setdefault(key, {"total": 0, "completed": 0, "no_show": 0, "revenue": 0})
            stat["total"] += 1
            if status == "completed":
                stat["completed"] += 1
                stat["revenue"] += price
            elif status == "no_show":
                stat["no_show"] += 1
        if status == "completed":
            revenue += price

    resolved = counts["completed"] + counts["no_show"]
    return ReportResponse(
        start=start, end=end, counts=counts, completed=counts["completed"], revenue_idr=revenue,
        no_show_rate=round(counts["no_show"] / resolved, 4) if resolved else None,
        by_service=_rows({s.id: s.name for s in session.scalars(select(Service)).all()}, by_service),
        by_barber=_rows({b.id: b.full_name for b in session.scalars(select(Barber)).all()}, by_barber),
        peak_hours=peak,
    )
