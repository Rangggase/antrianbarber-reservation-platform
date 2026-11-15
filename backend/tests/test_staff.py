"""Staff back office: login, token security, role scoping, status workflow, queue numbers.

Isolated SQLite only. Queue-number races on real PostgreSQL are in test_postgres_integration.py.
"""
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.reservations import get_session
from app.main import app
from app.models import Barber, Booking, Customer, Schedule, Service, StaffUser
from app.security.passwords import DUMMY_HASH, MIN_PASSWORD_LENGTH, hash_password, verify_password
from app.security.rate_limit import RATE_LIMITER
from app.services.booking_service import make_access_token
from app.models import Base

JKT = ZoneInfo("Asia/Jakarta")
JWT_SECRET = "staff-jwt-secret-for-tests-at-least-32-characters"
BOOKING_SECRET = "booking-secret-for-tests-at-least-32-characters"
PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)  # hashed once: scrypt is deliberately slow


@pytest.fixture()
def env(monkeypatch):
    monkeypatch.setenv("STAFF_JWT_SECRET", JWT_SECRET)
    monkeypatch.setenv("BOOKING_TOKEN_SECRET", BOOKING_SECRET)
    for key in ("AB_RL_AVAILABILITY_PER_MINUTE", "AB_RL_CREATE_PER_MINUTE", "AB_RL_LOGIN_PER_MINUTE", "AB_RL_STAFF_PER_MINUTE", "AB_RL_DETAIL_PER_MINUTE"):
        monkeypatch.setenv(key, "100000")
    RATE_LIMITER.reset_for_tests()
    yield monkeypatch
    RATE_LIMITER.reset_for_tests()


@pytest.fixture()
def engine(env):
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        # is_active is explicit everywhere: SQLite stores the server default "true" as a string.
        s.add_all([Barber(code="raka", full_name="Raka", is_active=True), Barber(code="dimas", full_name="Dimas", is_active=True)])
        s.add(Service(code="fade", name="Fade", duration_minutes=60, price_idr=75000, is_active=True))
        s.commit()
        for barber_id in (1, 2):
            for weekday in range(7):
                s.add(Schedule(barber_id=barber_id, weekday=weekday, start_time=time(9), end_time=time(17), is_active=True))
        s.add_all([
            StaffUser(username="admin", full_name="Admin", password_hash=PASSWORD_HASH, role="admin", is_active=True),
            StaffUser(username="raka", full_name="Raka Staff", password_hash=PASSWORD_HASH, role="barber", barber_id=1, is_active=True),
            StaffUser(username="dimas", full_name="Dimas Staff", password_hash=PASSWORD_HASH, role="barber", barber_id=2, is_active=True),
            StaffUser(username="gone", full_name="Former", password_hash=PASSWORD_HASH, role="admin", is_active=False),
        ])
        s.commit()
    return engine


@pytest.fixture()
def client(engine):
    def _session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


def login(client, username="admin", password=PASSWORD):
    return client.post("/api/v1/staff/login", json={"username": username, "password": password})


def auth(client, username="admin"):
    response = login(client, username)
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def tomorrow():
    return datetime.now(JKT).date() + timedelta(days=1)


def add_booking(engine, *, barber_id=1, start=None, status="pending", phone="081200000001", minutes=60, code=None) -> str:
    start = start or datetime.combine(tomorrow(), time(10), JKT)
    with Session(engine) as s:
        customer = s.scalar(select(Customer).where(Customer.phone == phone)) or Customer(full_name=f"Pelanggan {phone[-3:]}", phone=phone)
        s.add(customer)
        s.flush()
        booking = Booking(
            reference_code=code or f"AB-T-{phone[-4:]}-{barber_id}-{int(start.timestamp())}",
            customer_id=customer.id, barber_id=barber_id, service_id=1,
            starts_at=start.astimezone(timezone.utc), ends_at=(start + timedelta(minutes=minutes)).astimezone(timezone.utc),
            status=status, price_idr=75000,
        )
        s.add(booking)
        s.commit()
        return booking.reference_code


def post_status(client, headers, ref, status):
    return client.post(f"/api/v1/staff/bookings/{ref}/status", json={"status": status}, headers=headers)


# --- passwords ---------------------------------------------------------------------

def test_password_hash_roundtrip_and_tamper_detection():
    stored = hash_password(PASSWORD)
    assert stored.startswith("scrypt$") and PASSWORD not in stored
    assert verify_password(PASSWORD, stored)
    assert not verify_password(PASSWORD + "x", stored)
    assert not verify_password(PASSWORD, stored[:-4] + "AAAA")
    assert not verify_password(PASSWORD, "garbage") and not verify_password(PASSWORD, "bcrypt$1$2$3$4$5")
    assert hash_password(PASSWORD) != stored  # random salt
    assert not verify_password("anything", DUMMY_HASH)


def test_short_passwords_are_refused():
    with pytest.raises(ValueError):
        hash_password("x" * (MIN_PASSWORD_LENGTH - 1))


# --- login & token security --------------------------------------------------------

def test_login_returns_token_and_user_and_is_not_cacheable(client):
    response = login(client, "raka")
    body = response.json()
    assert response.status_code == 200
    assert body["token_type"] == "bearer" and body["expires_in"] == 480 * 60
    assert body["user"] == {"id": 2, "username": "raka", "full_name": "Raka Staff", "role": "barber", "barber_id": 1}
    assert "password" not in response.text
    assert response.headers["Cache-Control"] == "no-store"


def test_username_is_case_insensitive_and_last_login_is_recorded(client, engine):
    assert login(client, "  ADMIN ").status_code == 200
    with Session(engine) as s:
        assert s.scalar(select(StaffUser.last_login_at).where(StaffUser.username == "admin")) is not None


def test_bad_credentials_are_indistinguishable(client):
    wrong_password = login(client, "admin", "not the password")
    unknown_user = login(client, "nobody")
    inactive = login(client, "gone")
    for response in (wrong_password, unknown_user, inactive):
        assert response.status_code == 401
        assert response.json()["code"] == "invalid_credentials"
    assert wrong_password.json()["detail"] == unknown_user.json()["detail"] == inactive.json()["detail"]


def test_login_is_rate_limited(client, env):
    env.setenv("AB_RL_LOGIN_PER_MINUTE", "3")
    codes = [login(client, "admin", "wrong password").status_code for _ in range(5)]
    assert codes == [401, 401, 401, 429, 429]


def test_login_fails_closed_when_jwt_secret_is_missing(client, env):
    env.delenv("STAFF_JWT_SECRET")
    response = login(client)
    assert response.status_code == 503 and response.json()["code"] == "staff_auth_not_configured"


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer"}, {"Authorization": "Basic abc"}, {"Authorization": "Bearer not.a.jwt"}])
def test_protected_endpoints_require_a_valid_bearer_token(client, headers):
    for method, path in (("get", "/api/v1/staff/me"), ("get", "/api/v1/staff/queue")):
        response = getattr(client, method)(path, headers=headers)
        assert response.status_code == 401 and response.json()["code"] == "unauthorized"
        assert response.headers["WWW-Authenticate"] == "Bearer"


def _forge(claims_override=None, secret=JWT_SECRET, algorithm="HS256"):
    now = datetime.now(timezone.utc)
    claims = {"sub": "1", "role": "admin", "iss": "antrian-barber", "iat": now, "exp": now + timedelta(minutes=30)}
    claims.update(claims_override or {})
    return {"Authorization": f"Bearer {jwt.encode(claims, secret, algorithm=algorithm)}"}


def test_expired_foreign_and_unsigned_tokens_are_rejected(client):
    now = datetime.now(timezone.utc)
    cases = {
        "expired": _forge({"exp": now - timedelta(minutes=1)}),
        "wrong secret": _forge(secret="another-secret-that-is-also-32-characters!!"),
        "wrong issuer": _forge({"iss": "someone-else"}),
        "alg none": {"Authorization": "Bearer " + jwt.encode({"sub": "1", "iss": "antrian-barber", "iat": now, "exp": now + timedelta(minutes=5)}, key=None, algorithm="none")},
        "no expiry": {"Authorization": "Bearer " + jwt.encode({"sub": "1", "iss": "antrian-barber", "iat": now}, JWT_SECRET, algorithm="HS256")},
        "unknown user": _forge({"sub": "999"}),
    }
    assert client.get("/api/v1/staff/me", headers=_forge()).status_code == 200  # control: a correct forged token works
    for name, headers in cases.items():
        assert client.get("/api/v1/staff/me", headers=headers).status_code == 401, name


def test_deactivating_an_account_revokes_its_token_immediately(client, engine):
    headers = auth(client, "raka")
    assert client.get("/api/v1/staff/me", headers=headers).status_code == 200
    with Session(engine) as s:
        s.scalar(select(StaffUser).where(StaffUser.username == "raka")).is_active = False
        s.commit()
    assert client.get("/api/v1/staff/me", headers=headers).status_code == 401


def test_a_customer_booking_token_is_not_a_staff_token(client, engine):
    ref = add_booking(engine)
    with Session(engine) as s:
        token = make_access_token(s.scalar(select(Booking).where(Booking.reference_code == ref)))
    assert client.get("/api/v1/staff/queue", headers={"Authorization": f"Bearer {token}"}).status_code == 401


# --- queue & role scoping ----------------------------------------------------------

def test_admin_sees_everyone_and_barber_only_their_own(client, engine):
    add_booking(engine, barber_id=1, phone="081200000001")
    add_booking(engine, barber_id=2, phone="081200000002")
    day = tomorrow().isoformat()
    admin = client.get("/api/v1/staff/queue", params={"date": day}, headers=auth(client, "admin")).json()
    assert {b["barber_id"] for b in admin["bookings"]} == {1, 2} and admin["barber_id"] is None
    raka = client.get("/api/v1/staff/queue", params={"date": day}, headers=auth(client, "raka")).json()
    assert {b["barber_id"] for b in raka["bookings"]} == {1} and raka["barber_id"] == 1
    assert raka["counts"]["pending"] == 1 and raka["counts"]["completed"] == 0
    only_two = client.get("/api/v1/staff/queue", params={"date": day, "barber_id": 2}, headers=auth(client, "admin")).json()
    assert {b["barber_id"] for b in only_two["bookings"]} == {2}


def test_barber_cannot_request_another_barbers_queue(client):
    response = client.get("/api/v1/staff/queue", params={"barber_id": 2}, headers=auth(client, "raka"))
    assert response.status_code == 403 and response.json()["code"] == "forbidden"


def test_queue_exposes_customer_contact_to_staff_and_is_not_cacheable(client, engine):
    add_booking(engine, phone="081234500001")
    response = client.get("/api/v1/staff/queue", params={"date": tomorrow().isoformat()}, headers=auth(client))
    row = response.json()["bookings"][0]
    assert row["customer_phone"] == "081234500001" and row["customer_name"] and row["allowed_next"] == ["confirmed", "cancelled"]
    assert response.headers["Cache-Control"] == "no-store"


def test_queue_groups_bookings_by_jakarta_day_not_utc(client, engine):
    late = datetime.combine(tomorrow(), time(0, 30), JKT)       # 17:30 UTC the previous date
    add_booking(engine, start=late, phone="081200000001")
    on_day = client.get("/api/v1/staff/queue", params={"date": tomorrow().isoformat()}, headers=auth(client)).json()
    day_before = client.get("/api/v1/staff/queue", params={"date": (tomorrow() - timedelta(days=1)).isoformat()}, headers=auth(client)).json()
    assert len(on_day["bookings"]) == 1 and day_before["bookings"] == []


# --- status workflow ---------------------------------------------------------------

def test_full_happy_path_pending_to_completed(client, engine):
    ref = add_booking(engine)
    headers = auth(client)
    for status in ("confirmed", "in_service", "completed"):
        response = post_status(client, headers, ref, status)
        assert response.status_code == 200 and response.json()["status"] == status
    assert response.json()["allowed_next"] == []


@pytest.mark.parametrize("start_status,target", [
    ("pending", "in_service"), ("pending", "completed"), ("pending", "no_show"),
    ("confirmed", "completed"), ("in_service", "cancelled"), ("in_service", "confirmed"),
    ("completed", "cancelled"), ("cancelled", "confirmed"), ("no_show", "confirmed"),
])
def test_invalid_transitions_are_rejected_with_409(client, engine, start_status, target):
    ref = add_booking(engine, status=start_status)
    response = post_status(client, auth(client), ref, target)
    assert response.status_code == 409 and response.json()["code"] == "invalid_transition"
    with Session(engine) as s:
        assert s.scalar(select(Booking.status).where(Booking.reference_code == ref)) == start_status


def test_unknown_target_status_is_a_validation_error(client, engine):
    ref = add_booking(engine)
    assert post_status(client, auth(client), ref, "pending").status_code == 422
    assert post_status(client, auth(client), ref, "banana").status_code == 422


def test_no_show_only_after_the_start_time(client, engine):
    future = add_booking(engine, status="confirmed", phone="081200000001")
    past_start = datetime.now(JKT) - timedelta(hours=2)
    past = add_booking(engine, status="confirmed", start=past_start, phone="081200000002")
    headers = auth(client)
    early = post_status(client, headers, future, "no_show")
    assert early.status_code == 409 and early.json()["code"] == "too_early"
    assert post_status(client, headers, past, "no_show").json()["status"] == "no_show"


def test_barber_can_only_change_their_own_bookings(client, engine):
    mine = add_booking(engine, barber_id=1, phone="081200000001")
    theirs = add_booking(engine, barber_id=2, phone="081200000002")
    headers = auth(client, "raka")
    assert post_status(client, headers, mine, "confirmed").status_code == 200
    other = post_status(client, headers, theirs, "confirmed")
    assert other.status_code == 404 and other.json()["code"] == "booking_not_found"  # same as a missing one
    assert post_status(client, headers, "AB-DOES-NOT-EXIST", "confirmed").json()["code"] == "booking_not_found"


def test_status_change_requires_authentication(client, engine):
    ref = add_booking(engine)
    assert client.post(f"/api/v1/staff/bookings/{ref}/status", json={"status": "confirmed"}).status_code == 401


def test_staff_cancel_reopens_the_slot_for_customers(client, engine):
    day = tomorrow().isoformat()
    slot_start = datetime.combine(tomorrow(), time(10), JKT)
    params = {"barber_id": 1, "service_id": 1, "date": day}
    slots = lambda: client.get("/api/v1/availability", params=params).json()["slots"]  # noqa: E731
    assert slot_start.isoformat() in slots()           # free to begin with (also proves slots exist at all)
    ref = add_booking(engine, start=slot_start)
    assert slot_start.isoformat() not in slots()       # taken
    assert post_status(client, auth(client), ref, "cancelled").status_code == 200
    assert slot_start.isoformat() in slots()           # free again


# --- queue numbers -----------------------------------------------------------------

def test_queue_numbers_are_sequential_per_barber_per_day_and_never_reused(client, engine):
    a = add_booking(engine, barber_id=1, phone="081200000001", start=datetime.combine(tomorrow(), time(9), JKT))
    b = add_booking(engine, barber_id=1, phone="081200000002", start=datetime.combine(tomorrow(), time(11), JKT))
    c = add_booking(engine, barber_id=2, phone="081200000003", start=datetime.combine(tomorrow(), time(9), JKT))
    d = add_booking(engine, barber_id=1, phone="081200000004", start=datetime.combine(tomorrow() + timedelta(days=1), time(9), JKT))
    headers = auth(client)
    numbers = {name: post_status(client, headers, ref, "confirmed").json()["queue_number"] for name, ref in (("a", a), ("b", b), ("c", c), ("d", d))}
    assert numbers == {"a": 1, "b": 2, "c": 1, "d": 1}  # per barber, per local day
    post_status(client, headers, a, "cancelled")
    e = add_booking(engine, barber_id=1, phone="081200000005", start=datetime.combine(tomorrow(), time(15), JKT))
    assert post_status(client, headers, e, "confirmed").json()["queue_number"] == 3  # 1 stays burned


def test_pending_bookings_have_no_queue_number_yet(client, engine):
    add_booking(engine)
    row = client.get("/api/v1/staff/queue", params={"date": tomorrow().isoformat()}, headers=auth(client)).json()["bookings"][0]
    assert row["queue_number"] is None


# --- customer view of the queue ----------------------------------------------------

def _public(client, engine, ref):
    with Session(engine) as s:
        token = make_access_token(s.scalar(select(Booking).where(Booking.reference_code == ref)))
    return client.get(f"/api/v1/bookings/{ref}", headers={"X-Booking-Token": token})


def test_customer_sees_position_and_estimated_wait_today(client, engine):
    today = datetime.now(JKT).date()
    # Fixed early-morning times keep "same local day" true whenever the test runs.
    one = add_booking(engine, status="confirmed", start=datetime.combine(today, time(0, 10), JKT), minutes=60, phone="081200000001")
    two = add_booking(engine, status="in_service", start=datetime.combine(today, time(1, 30), JKT), minutes=45, phone="081200000002")
    mine = add_booking(engine, status="pending", start=datetime.combine(today, time(3, 0), JKT), phone="081200000003")
    body = _public(client, engine, mine).json()
    assert body["ahead_count"] == 2 and body["estimated_wait_minutes"] == 105 and body["queue_number"] is None
    assert one != two  # sanity
    headers = auth(client)
    assert post_status(client, headers, mine, "confirmed").json()["queue_number"] == 1
    assert _public(client, engine, mine).json()["queue_number"] == 1


def test_customer_queue_info_is_absent_for_other_days_and_leaks_no_personal_data(client, engine):
    ref = add_booking(engine, phone="081299990001")  # tomorrow
    response = _public(client, engine, ref)
    body = response.json()
    assert body["ahead_count"] is None and body["estimated_wait_minutes"] is None
    assert "081299990001" not in response.text and "Pelanggan" not in response.text
    assert not {"phone", "full_name", "customer_name", "customer_phone"} & set(body)


# --- browser access (CORS) -----------------------------------------------------------

def test_cors_preflight_allows_the_authorization_header_for_the_dev_frontend(client):
    # The Playwright specs mock the API and set CORS headers themselves, so this is the only
    # test that proves a real browser's preflight for a Bearer request would succeed.
    response = client.options("/api/v1/staff/queue", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_cors_preflight_still_rejects_unknown_origins(client):
    response = client.options("/api/v1/staff/queue", headers={
        "Origin": "https://evil.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


# --- admin reports -------------------------------------------------------------------

def _report(client, headers, **params):
    return client.get("/api/v1/staff/reports", params=params, headers=headers)


def _day_at(offset: int, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(datetime.now(JKT).date() + timedelta(days=offset), time(hour, minute), JKT)


def test_report_totals_revenue_no_show_rate_and_peak_hours(client, engine):
    # day -1: 3 completed (one at 09:00 twice), 1 no_show, 1 cancelled, 1 pending. price is 75000 each.
    add_booking(engine, status="completed", start=_day_at(-1, 9), phone="081200000001")
    add_booking(engine, status="completed", start=_day_at(-1, 9, 30), phone="081200000002")
    add_booking(engine, status="completed", start=_day_at(-1, 14), barber_id=2, phone="081200000003")
    add_booking(engine, status="no_show", start=_day_at(-1, 16), barber_id=2, phone="081200000004")
    add_booking(engine, status="cancelled", start=_day_at(-1, 11), phone="081200000005")
    add_booking(engine, status="pending", start=_day_at(-1, 17), phone="081200000006")
    day = (datetime.now(JKT).date() - timedelta(days=1)).isoformat()
    body = _report(client, auth(client), start=day, end=day).json()
    assert body["counts"] == {"pending": 1, "confirmed": 0, "in_service": 0, "completed": 3, "cancelled": 1, "no_show": 1}
    assert body["completed"] == 3 and body["revenue_idr"] == 225000
    assert body["no_show_rate"] == 0.25                      # 1 / (3 completed + 1 no_show)
    assert body["peak_hours"][9] == 2 and body["peak_hours"][14] == 1 and body["peak_hours"][17] == 1
    assert body["peak_hours"][11] == 0 and body["peak_hours"][16] == 0   # cancelled and no_show are not "busy"
    assert len(body["peak_hours"]) == 24 and sum(body["peak_hours"]) == 4


def test_report_breaks_down_by_barber_and_service_sorted_by_revenue(client, engine):
    add_booking(engine, status="completed", start=_day_at(-1, 9), barber_id=1, phone="081200000001")
    add_booking(engine, status="completed", start=_day_at(-1, 11), barber_id=2, phone="081200000002")
    add_booking(engine, status="completed", start=_day_at(-1, 13), barber_id=2, phone="081200000003")
    add_booking(engine, status="no_show", start=_day_at(-1, 15), barber_id=1, phone="081200000004")
    day = (datetime.now(JKT).date() - timedelta(days=1)).isoformat()
    body = _report(client, auth(client), start=day, end=day).json()
    barbers = body["by_barber"]
    assert [(r["name"], r["completed"], r["no_show"], r["total"], r["revenue_idr"]) for r in barbers] == [
        ("Dimas", 2, 0, 2, 150000), ("Raka", 1, 1, 2, 75000)]
    assert body["by_service"] == [{"id": 1, "name": "Fade", "total": 4, "completed": 3, "no_show": 1, "revenue_idr": 225000}]


def test_report_range_uses_jakarta_days_and_excludes_outside_bookings(client, engine):
    inside = datetime.combine(datetime.now(JKT).date() - timedelta(days=1), time(0, 30), JKT)   # 17:30 UTC two dates ago
    add_booking(engine, status="completed", start=inside, phone="081200000001")
    add_booking(engine, status="completed", start=_day_at(-10, 10), phone="081200000002")
    yesterday = (datetime.now(JKT).date() - timedelta(days=1)).isoformat()
    day_before = (datetime.now(JKT).date() - timedelta(days=2)).isoformat()
    headers = auth(client)
    assert _report(client, headers, start=yesterday, end=yesterday).json()["completed"] == 1
    assert _report(client, headers, start=day_before, end=day_before).json()["completed"] == 0
    assert _report(client, headers).json()["completed"] == 2          # default range: the last 30 days


def test_empty_report_has_no_rate_and_zeroed_hours(client):
    body = _report(client, auth(client)).json()
    assert body["no_show_rate"] is None and body["revenue_idr"] == 0 and body["by_barber"] == []
    assert body["peak_hours"] == [0] * 24


def test_report_is_admin_only(client):
    assert _report(client, auth(client, "raka")).status_code == 403
    assert _report(client, {}).status_code == 401


@pytest.mark.parametrize("start,end,code", [("2026-02-10", "2026-02-01", "invalid_range"), ("2026-01-01", "2026-06-30", "range_too_large")])
def test_report_rejects_bad_ranges(client, start, end, code):
    response = _report(client, auth(client), start=start, end=end)
    assert response.status_code == 422 and response.json()["code"] == code


# --- schedule & time off (admin) -----------------------------------------------------

def _schedule_url(barber_id=1):
    return f"/api/v1/staff/barbers/{barber_id}/schedule"


def _slots(client, day, barber_id=1):
    return client.get("/api/v1/availability", params={"barber_id": barber_id, "service_id": 1, "date": day.isoformat()}).json()["slots"]


def test_admin_reads_the_weekly_schedule(client):
    body = client.get(_schedule_url(), headers=auth(client)).json()
    assert body["barber_name"] == "Raka" and body["time_off"] == []
    assert len(body["intervals"]) == 7 and body["intervals"][0] == {"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"}


def test_replacing_the_schedule_changes_the_offered_slots(client):
    day = tomorrow()
    assert len(_slots(client, day)) > 0
    new = {"intervals": [{"weekday": day.weekday(), "start_time": "13:00", "end_time": "15:00"}]}
    response = client.put(_schedule_url(), json=new, headers=auth(client))
    assert response.status_code == 200 and len(response.json()["intervals"]) == 1
    assert [s[11:16] for s in _slots(client, day)] == ["13:00", "13:30", "14:00"]   # 60-minute service inside 13:00-15:00
    assert len(_slots(client, day + timedelta(days=1))) == 0                       # every other weekday is now empty
    assert client.put(_schedule_url(), json={"intervals": []}, headers=auth(client)).json()["intervals"] == []


def test_schedule_replacement_does_not_touch_existing_bookings(client, engine):
    ref = add_booking(engine)
    client.put(_schedule_url(), json={"intervals": []}, headers=auth(client))
    with Session(engine) as s:
        assert s.scalar(select(Booking.status).where(Booking.reference_code == ref)) == "pending"


@pytest.mark.parametrize("intervals", [
    [{"weekday": 1, "start_time": "15:00", "end_time": "09:00"}],
    [{"weekday": 1, "start_time": "09:00", "end_time": "09:00"}],
    [{"weekday": 1, "start_time": "09:00", "end_time": "12:00"}, {"weekday": 1, "start_time": "11:00", "end_time": "14:00"}],
])
def test_invalid_schedules_are_rejected_and_keep_the_old_one(client, intervals):
    response = client.put(_schedule_url(), json={"intervals": intervals}, headers=auth(client))
    assert response.status_code == 422 and response.json()["code"] == "invalid_schedule"
    assert len(client.get(_schedule_url(), headers=auth(client)).json()["intervals"]) == 7


def test_back_to_back_intervals_and_bad_weekday(client):
    ok = [{"weekday": 2, "start_time": "09:00", "end_time": "12:00"}, {"weekday": 2, "start_time": "12:00", "end_time": "15:00"}]
    assert client.put(_schedule_url(), json={"intervals": ok}, headers=auth(client)).status_code == 200
    bad = {"intervals": [{"weekday": 7, "start_time": "09:00", "end_time": "10:00"}]}
    assert client.put(_schedule_url(), json=bad, headers=auth(client)).status_code == 422


def test_time_off_blocks_that_day_and_deleting_it_reopens_it(client):
    day = tomorrow() + timedelta(days=1)
    headers = auth(client)
    assert len(_slots(client, day)) > 0
    created = client.post("/api/v1/staff/barbers/1/time-off", json={"starts_on": day.isoformat(), "ends_on": day.isoformat(), "reason": "  Libur keluarga "}, headers=headers)
    assert created.status_code == 201 and created.json()["reason"] == "Libur keluarga"
    assert _slots(client, day) == []
    assert len(_slots(client, day + timedelta(days=1))) > 0 and len(_slots(client, day, barber_id=2)) > 0   # neighbours unaffected
    assert client.get(_schedule_url(), headers=headers).json()["time_off"][0]["id"] == created.json()["id"]
    assert client.delete(f"/api/v1/staff/time-off/{created.json()['id']}", headers=headers).status_code == 204
    assert len(_slots(client, day)) > 0


def test_a_customer_cannot_book_a_day_the_barber_is_on_leave(client):
    day = tomorrow() + timedelta(days=1)
    slot = _slots(client, day)[0]
    client.post("/api/v1/staff/barbers/1/time-off", json={"starts_on": day.isoformat(), "ends_on": day.isoformat()}, headers=auth(client))
    response = client.post("/api/v1/bookings", json={"full_name": "Pelanggan Demo", "phone": "081234567890", "barber_id": 1, "service_id": 1, "starts_at": slot})
    assert response.status_code == 409 and response.json()["code"] == "slot_unavailable"


def test_time_off_is_refused_while_active_bookings_exist(client, engine):
    add_booking(engine, status="confirmed")                        # tomorrow 10:00
    body = {"starts_on": tomorrow().isoformat(), "ends_on": (tomorrow() + timedelta(days=2)).isoformat()}
    response = client.post("/api/v1/staff/barbers/1/time-off", json=body, headers=auth(client))
    assert response.status_code == 409 and response.json()["code"] == "time_off_conflict" and "1 reservasi" in response.json()["detail"]
    assert client.get(_schedule_url(), headers=auth(client)).json()["time_off"] == []


def test_time_off_ignores_finished_or_cancelled_bookings_and_other_barbers(client, engine):
    add_booking(engine, status="cancelled", phone="081200000001")
    add_booking(engine, status="completed", phone="081200000002", start=datetime.combine(tomorrow(), time(12), JKT))
    add_booking(engine, barber_id=2, phone="081200000003", start=datetime.combine(tomorrow(), time(13), JKT))
    body = {"starts_on": tomorrow().isoformat(), "ends_on": tomorrow().isoformat()}
    assert client.post("/api/v1/staff/barbers/1/time-off", json=body, headers=auth(client)).status_code == 201


@pytest.mark.parametrize("starts,ends,code", [(0, -1, "invalid_range"), (-5, -2, "time_off_in_past")])
def test_time_off_rejects_backwards_and_past_ranges(client, starts, ends, code):
    today = datetime.now(JKT).date()
    body = {"starts_on": (today + timedelta(days=starts)).isoformat(), "ends_on": (today + timedelta(days=ends)).isoformat()}
    response = client.post("/api/v1/staff/barbers/1/time-off", json=body, headers=auth(client))
    assert response.status_code == 422 and response.json()["code"] == code


def test_schedule_endpoints_are_admin_only_and_validate_ids(client):
    barber = auth(client, "raka")
    body = {"starts_on": tomorrow().isoformat(), "ends_on": tomorrow().isoformat()}
    assert client.get(_schedule_url(), headers=barber).status_code == 403
    assert client.put(_schedule_url(), json={"intervals": []}, headers=barber).status_code == 403
    assert client.post("/api/v1/staff/barbers/1/time-off", json=body, headers=barber).status_code == 403
    assert client.delete("/api/v1/staff/time-off/1", headers=barber).status_code == 403
    assert client.get(_schedule_url(), headers={}).status_code == 401
    admin = auth(client)
    assert client.get(_schedule_url(99), headers=admin).status_code == 404
    assert client.delete("/api/v1/staff/time-off/999", headers=admin).status_code == 404


def test_cors_preflight_allows_put_and_delete_for_the_dev_frontend(client):
    for method in ("PUT", "DELETE"):
        response = client.options("/api/v1/staff/barbers/1/schedule", headers={
            "Origin": "http://localhost:5173", "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "authorization,content-type"})
        assert response.status_code == 200 and method in response.headers["access-control-allow-methods"]
