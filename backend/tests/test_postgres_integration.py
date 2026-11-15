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
from app.models import Barber, Booking, Customer, Schedule, Service, StaffUser
from app.security.passwords import hash_password
from app.security.rate_limit import RATE_LIMITER

TEST_URL = get_test_database_url()
pytestmark = pytest.mark.skipif(TEST_URL is None, reason="TEST_DB_NAME / TEST_DATABASE_URL not set")

JKT = ZoneInfo("Asia/Jakarta")
DAY_INDEX = "uq_bookings_customer_local_day_active"
HEAD = "20261117_04"
QUEUE_INDEX = "uq_bookings_barber_local_day_queue"
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
        conn.execute(text("TRUNCATE bookings, schedules, customers, barbers, services, staff_users RESTART IDENTITY CASCADE"))
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


def test_migration_roundtrip_removes_and_restores_the_indexes_and_staff_table(pg_engine):
    def present(name: str) -> bool:
        with pg_engine.connect() as conn:
            return conn.execute(text("SELECT 1 FROM pg_indexes WHERE indexname = :n"), {"n": name}).scalar() is not None

    def staff_table() -> bool:
        with pg_engine.connect() as conn:
            return conn.execute(text("SELECT to_regclass('staff_users')")).scalar() is not None

    assert present(DAY_INDEX) and present(QUEUE_INDEX) and staff_table()
    _alembic("downgrade", "20261115_02")          # undo only the staff/queue migration
    try:
        assert not present(QUEUE_INDEX) and not staff_table() and present(DAY_INDEX)
        _alembic("downgrade", "20261108_01")
        assert not present(DAY_INDEX)
    finally:
        _alembic("upgrade", "head")
    assert present(DAY_INDEX) and present(QUEUE_INDEX) and staff_table()
    with pg_engine.connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == HEAD


def test_queue_number_is_unique_per_barber_per_local_day(db):
    day = future_day()
    with Session(db) as s:
        a, b, c, d = (add_customer(s, f"08150000000{i}") for i in range(4))
        add_booking(s, a, at(day, 9), barber_id=1)
        first = s.scalar(text("SELECT id FROM bookings ORDER BY id LIMIT 1"))
        s.execute(text("UPDATE bookings SET queue_number = 1 WHERE id = :i"), {"i": first})
        s.commit()
        add_booking(s, b, at(day, 11), barber_id=1)
        with pytest.raises(IntegrityError) as err:
            s.execute(text("UPDATE bookings SET queue_number = 1 WHERE customer_id = :c"), {"c": b})
            s.commit()
        s.rollback()
        assert violation(err.value) == ("23505", QUEUE_INDEX)
        # other barber, other day, and NULL numbers are all unaffected
        add_booking(s, c, at(day, 9), barber_id=2)
        add_booking(s, d, at(day + timedelta(days=1), 9), barber_id=1)
        s.execute(text("UPDATE bookings SET queue_number = 1 WHERE customer_id IN (:c, :d)"), {"c": c, "d": d})
        s.commit()


# --- concurrency through the real API -------------------------------------------

@pytest.fixture()
def api(db, monkeypatch):
    monkeypatch.setenv("BOOKING_TOKEN_SECRET", SECRET)
    monkeypatch.setenv("STAFF_JWT_SECRET", "postgres-staff-jwt-secret-at-least-32-characters")
    for key in ("AB_RL_AVAILABILITY_PER_MINUTE", "AB_RL_CREATE_PER_MINUTE", "AB_RL_LOGIN_PER_MINUTE", "AB_RL_STAFF_PER_MINUTE"):
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


# --- staff: concurrent confirmations get distinct queue numbers ------------------------

STAFF_PASSWORD = "postgres integration password"


def staff_login(db) -> dict:
    with Session(db) as s:
        s.add(StaffUser(username="admin", full_name="Admin", password_hash=hash_password(STAFF_PASSWORD), role="admin"))
        s.commit()
    with TestClient(app) as c:
        response = c.post("/api/v1/staff/login", json={"username": "admin", "password": STAFF_PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def confirm_all(headers: dict, refs: list[str]) -> list[tuple[int, int | None]]:
    """Confirm every booking at the same moment; return (http status, queue number) pairs."""
    barrier = threading.Barrier(len(refs))
    clients = [TestClient(app) for _ in refs]

    def worker(index: int):
        barrier.wait(timeout=15)
        response = clients[index].post(f"/api/v1/staff/bookings/{refs[index]}/status", json={"status": "confirmed"}, headers=headers)
        return response.status_code, (response.json().get("queue_number") if response.status_code == 200 else None)

    with ThreadPoolExecutor(len(refs)) as pool:
        return list(pool.map(worker, range(len(refs))))


def test_concurrent_confirmations_get_distinct_consecutive_queue_numbers(api):
    headers = staff_login(api)
    for round_no in range(3):
        day = future_day(20 + round_no)
        refs = []
        with Session(api) as s:
            for i in range(6):
                customer = add_customer(s, f"0816{round_no}{i:07d}")
                add_booking(s, customer, at(day, 9 + i), barber_id=1, code=f"AB-Q-{round_no}-{i}")
                refs.append(f"AB-Q-{round_no}-{i}")
        results = confirm_all(headers, refs)
        assert all(status == 200 for status, _ in results), results
        assert sorted(number for _, number in results) == [1, 2, 3, 4, 5, 6]


def test_confirmed_bookings_of_different_barbers_number_independently(api):
    headers = staff_login(api)
    day = future_day(30)
    refs = []
    with Session(api) as s:
        for barber_id in (1, 2):
            for i in range(2):
                customer = add_customer(s, f"0817{barber_id}{i:07d}")
                add_booking(s, customer, at(day, 9 + i), barber_id=barber_id, code=f"AB-B{barber_id}-{i}")
                refs.append(f"AB-B{barber_id}-{i}")
    results = confirm_all(headers, refs)
    assert [status for status, _ in results] == [200] * 4
    assert sorted(number for _, number in results) == [1, 1, 2, 2]
