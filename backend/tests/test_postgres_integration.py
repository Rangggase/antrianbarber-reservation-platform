"""Real PostgreSQL integration tests: database-enforced booking rules and concurrency.

Skipped unless TEST_DB_NAME (or TEST_DATABASE_URL) points to a database whose name ends
with "_test"; the schema of that database is DROPPED and recreated. Never point it at
real data. Create it with:  python -m scripts.create_test_db
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import os
from pathlib import Path
import threading
from zoneinfo import ZoneInfo

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.reservations import get_session
from app.config import get_test_database_url
from app.main import app
from app.models import Barber, Booking, Customer, Schedule, Service
from app.security.rate_limit import RATE_LIMITER

TEST_URL = get_test_database_url()
pytestmark = pytest.mark.skipif(TEST_URL is None, reason="TEST_DB_NAME / TEST_DATABASE_URL not set")

JKT = ZoneInfo("Asia/Jakarta")
DAY_INDEX = "uq_bookings_customer_local_day_active"
HEAD = "20261115_02"
SECRET = "postgres-integration-secret-at-least-32-characters"


def _alembic(action: str, revision: str) -> None:
    mp = pytest.MonkeyPatch()
    mp.setenv("DATABASE_URL", TEST_URL.render_as_string(hide_password=False))
    try:
        config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        getattr(command, action)(config, revision)
    finally:
        mp.undo()


@pytest.fixture(scope="module")
def pg_engine():
    engine = create_engine(TEST_URL, pool_size=10, pool_pre_ping=True)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    _alembic("upgrade", "head")
    yield engine
    engine.dispose()


@pytest.fixture()
def db(pg_engine):
    with pg_engine.begin() as conn:
        conn.execute(text("TRUNCATE bookings, schedules, customers, barbers, services RESTART IDENTITY CASCADE"))
    with Session(pg_engine) as s:
        s.add_all([Barber(code="raka", full_name="Raka"), Barber(code="dimas", full_name="Dimas")])
        s.add(Service(code="fade", name="Fade", duration_minutes=60, price_idr=75000))
        s.commit()
        for barber_id in (1, 2):
            for weekday in range(7):
                s.add(Schedule(barber_id=barber_id, weekday=weekday, start_time=datetime(2000, 1, 1, 9).time(), end_time=datetime(2000, 1, 1, 17).time()))
        s.commit()
    return pg_engine


def at(day: datetime, hour: int, minute: int = 0) -> datetime:
    return day.replace(hour=hour, minute=minute, second=0, microsecond=0)


def future_day(offset: int = 10) -> datetime:
    return datetime.now(JKT).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=offset)


def add_customer(session: Session, phone: str) -> int:
    customer = Customer(full_name="Demo", phone=phone)
    session.add(customer)
    session.flush()
    return customer.id


def add_booking(session: Session, customer_id: int, start: datetime, *, barber_id: int = 1, minutes: int = 60, status: str = "pending", code: str | None = None) -> None:
    session.add(Booking(
        reference_code=code or f"AB-T-{customer_id}-{barber_id}-{int(start.timestamp())}-{status}",
        customer_id=customer_id, barber_id=barber_id, service_id=1,
        starts_at=start, ends_at=start + timedelta(minutes=minutes), status=status, price_idr=75000,
    ))
    session.commit()


def violation(exc: IntegrityError) -> tuple[str, str | None]:
    return exc.orig.sqlstate, exc.orig.diag.constraint_name


# --- barber overlap: exclusion constraint ---------------------------------------

def test_overlapping_bookings_for_one_barber_are_rejected(db):
    day = future_day()
    with Session(db) as s:
        a, b = add_customer(s, "081100000001"), add_customer(s, "081100000002")
        add_booking(s, a, at(day, 10))
        with pytest.raises(IntegrityError) as err:
            add_booking(s, b, at(day, 10, 30))
        s.rollback()
    assert violation(err.value)[0] == "23P01"


def test_back_to_back_bookings_are_allowed(db):
    day = future_day()
    with Session(db) as s:
        a, b = add_customer(s, "081100000001"), add_customer(s, "081100000002")
        add_booking(s, a, at(day, 10))
        add_booking(s, b, at(day, 11))  # range is [start, end): touching is not overlapping


def test_cancelled_booking_does_not_block_the_slot(db):
    day = future_day()
    with Session(db) as s:
        a, b = add_customer(s, "081100000001"), add_customer(s, "081100000002")
        add_booking(s, a, at(day, 10), status="cancelled")
        add_booking(s, b, at(day, 10))


def test_different_barbers_can_share_a_time(db):
    day = future_day()
    with Session(db) as s:
        a, b = add_customer(s, "081100000001"), add_customer(s, "081100000002")
        add_booking(s, a, at(day, 10), barber_id=1)
        add_booking(s, b, at(day, 10), barber_id=2)


# --- one active booking per customer per local day: partial unique index --------

def test_second_active_booking_on_same_local_day_is_rejected(db):
    day = future_day()
    with Session(db) as s:
        a = add_customer(s, "081100000001")
        add_booking(s, a, at(day, 9), barber_id=1)
        with pytest.raises(IntegrityError) as err:
            add_booking(s, a, at(day, 14), barber_id=2)
        s.rollback()
    assert violation(err.value) == ("23505", DAY_INDEX)


def test_cancelled_booking_and_other_days_do_not_count(db):
    day = future_day()
    with Session(db) as s:
        a = add_customer(s, "081100000001")
        add_booking(s, a, at(day, 9), status="cancelled")
        add_booking(s, a, at(day, 14))
        add_booking(s, a, at(day + timedelta(days=1), 14))


def test_rule_uses_jakarta_calendar_day_not_utc(db):
    day = future_day()
    with Session(db) as s:
        a = add_customer(s, "081100000001")
        # 00:30 WIB is 17:30 UTC of the PREVIOUS date, yet it is the same local day as 20:00 WIB.
        add_booking(s, a, at(day, 0, 30), barber_id=1)
        with pytest.raises(IntegrityError) as err:
            add_booking(s, a, at(day, 20), barber_id=2)
        s.rollback()
        assert violation(err.value) == ("23505", DAY_INDEX)
        # 00:30 WIB the next local day is a different day, even though its UTC date equals day.
        add_booking(s, a, at(day + timedelta(days=1), 0, 30), barber_id=2)


def test_migration_roundtrip_removes_and_restores_the_index(pg_engine):
    def index_exists() -> bool:
        with pg_engine.connect() as conn:
            return conn.execute(text("SELECT 1 FROM pg_indexes WHERE indexname = :n"), {"n": DAY_INDEX}).scalar() is not None

    assert index_exists()
    _alembic("downgrade", "20261108_01")
    try:
        assert not index_exists()
    finally:
        _alembic("upgrade", "head")
    assert index_exists()
    with pg_engine.connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == HEAD


# --- concurrency through the real API -------------------------------------------

@pytest.fixture()
def api(db, monkeypatch):
    monkeypatch.setenv("BOOKING_TOKEN_SECRET", SECRET)
    for key in ("AB_RL_AVAILABILITY_PER_MINUTE", "AB_RL_CREATE_PER_MINUTE"):
        monkeypatch.setenv(key, "100000")
    RATE_LIMITER.reset_for_tests()

    def _session():
        with Session(db) as s:
            yield s

    app.dependency_overrides[get_session] = _session
    yield db
    app.dependency_overrides.pop(get_session, None)
    RATE_LIMITER.reset_for_tests()


def slots_for(day_offset: int) -> list[str]:
    day = (datetime.now(JKT).date() + timedelta(days=day_offset)).isoformat()
    with TestClient(app) as c:
        response = c.get("/api/v1/availability", params={"barber_id": 1, "service_id": 1, "date": day})
    assert response.status_code == 200, response.text
    return response.json()["slots"]


def payload(start: str, phone: str, barber_id: int = 1) -> dict:
    return {"full_name": "Pelanggan Demo", "phone": phone, "barber_id": barber_id, "service_id": 1, "starts_at": start}


def race(bodies: list[dict]) -> list[int]:
    """Fire all requests at the same moment; return the sorted HTTP status codes."""
    barrier = threading.Barrier(len(bodies))
    clients = [TestClient(app) for _ in bodies]

    def worker(index: int) -> int:
        barrier.wait(timeout=15)
        return clients[index].post("/api/v1/bookings", json=bodies[index]).status_code

    with ThreadPoolExecutor(len(bodies)) as pool:
        return sorted(pool.map(worker, range(len(bodies))))


def count_bookings(engine) -> int:
    with engine.connect() as conn:
        return conn.execute(text("SELECT count(*) FROM bookings")).scalar_one()


def test_concurrent_requests_for_one_slot_produce_exactly_one_booking(api):
    slots = slots_for(2)
    for round_no in range(4):
        before = count_bookings(api)
        # Service is 60 min and slots are 30 min apart: step by 2 so rounds never overlap each other.
        codes = race([payload(slots[round_no * 2], f"08120000{round_no}{i:03d}") for i in range(4)])
        assert codes == [201, 409, 409, 409], codes
        assert count_bookings(api) == before + 1


def test_concurrent_requests_for_one_phone_produce_exactly_one_booking_per_day(api):
    # End-to-end guarantee. (The customer-row lock already serialises these; the partial unique
    # index is proven separately by the direct constraint tests above.)
    for round_no in range(4):
        slots = slots_for(3 + round_no)
        phone = f"08130000{round_no:04d}"  # brand-new customer each round: races the customer insert too
        before = count_bookings(api)
        codes = race([payload(slots[i * 2], phone) for i in range(3)])  # non-overlapping, so only the day rule can reject
        assert codes == [201, 409, 409], codes
        assert count_bookings(api) == before + 1


def test_conflict_responses_carry_stable_codes(api):
    slots = slots_for(2)
    with TestClient(app) as c:
        assert c.post("/api/v1/bookings", json=payload(slots[0], "081400000001")).status_code == 201
        taken = c.post("/api/v1/bookings", json=payload(slots[0], "081400000002"))
        again = c.post("/api/v1/bookings", json=payload(slots[2], "081400000001"))  # free slot, same customer + day
    assert taken.status_code == 409 and taken.json()["code"] == "slot_unavailable"
    assert again.status_code == 409 and again.json()["code"] == "customer_day_conflict"
