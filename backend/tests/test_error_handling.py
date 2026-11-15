"""Uniform error format, request ids and logging hygiene (isolated SQLite; no PostgreSQL)."""
from datetime import datetime, time, timedelta
import logging
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.reservations import get_session
from app.main import app
from app.models import Base, Barber, Schedule, Service

JKT = ZoneInfo("Asia/Jakarta")
SECRET = "error-handling-test-secret-at-least-32-characters"


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("BOOKING_TOKEN_SECRET", SECRET)
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        s.add(Barber(code="raka", full_name="Demo Raka", is_active=True))
        s.add(Service(code="fade", name="Fade", duration_minutes=60, price_idr=75000, is_active=True))
        s.commit()
        for weekday in range(7):
            s.add(Schedule(barber_id=1, weekday=weekday, start_time=time(9), end_time=time(17), is_active=True))
        s.commit()

    def _session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_session, None)
    engine.dispose()


def _day():
    return (datetime.now(JKT).date() + timedelta(days=2)).isoformat()


def _first_slot(client):
    return client.get("/api/v1/availability", params={"barber_id": 1, "service_id": 1, "date": _day()}).json()["slots"][0]


def _payload(start, phone="081234567890"):
    return {"full_name": "Pelanggan Demo", "phone": phone, "barber_id": 1, "service_id": 1, "starts_at": start}


def test_unknown_route_uses_error_format_with_matching_request_id(client):
    response = client.get("/api/v1/does-not-exist")
    body = response.json()
    assert response.status_code == 404
    assert body["code"] == "not_found" and isinstance(body["detail"], str)
    assert body["request_id"] == response.headers["X-Request-ID"]


def test_validation_error_has_string_detail_and_never_echoes_input(client):
    secret_looking = "PHONE-SECRET-VALUE"
    response = client.post("/api/v1/bookings", json=_payload(_first_slot(client), phone=secret_looking))
    body = response.json()
    assert response.status_code == 422
    assert body["code"] == "validation_error"
    assert isinstance(body["detail"], str) and "phone" in body["detail"]
    assert body["errors"][0]["field"] == "phone"
    assert secret_looking not in response.text


def test_domain_errors_carry_stable_codes(client):
    slot = _first_slot(client)
    created = client.post("/api/v1/bookings", json=_payload(slot))
    assert created.status_code == 201
    ref = created.json()["reference_code"]
    assert client.get(f"/api/v1/bookings/{ref}").json()["code"] == "invalid_token"
    assert client.get("/api/v1/bookings/AB-00000000-NOPE").json()["code"] == "booking_not_found"
    assert client.post("/api/v1/bookings", json=_payload(slot, phone="081234567891")).json()["code"] == "slot_unavailable"
    second = client.get("/api/v1/availability", params={"barber_id": 1, "service_id": 1, "date": _day()}).json()["slots"][0]
    assert client.post("/api/v1/bookings", json=_payload(second)).json()["code"] == "customer_day_conflict"


def test_request_id_is_echoed_when_valid_and_replaced_when_not(client):
    ok = client.get("/api/health", headers={"X-Request-ID": "trace-12345678"})
    assert ok.headers["X-Request-ID"] == "trace-12345678"
    bad = client.get("/api/health", headers={"X-Request-ID": "bad id with spaces <script>"})
    assert bad.headers["X-Request-ID"] != "bad id with spaces <script>"
    assert len(bad.headers["X-Request-ID"]) == 32


def test_unhandled_exception_returns_500_without_leaking_details():
    def boom():
        raise RuntimeError("secret internal detail")
        yield  # pragma: no cover

    app.dependency_overrides[get_session] = boom
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            response = c.get("/api/v1/services")
    finally:
        app.dependency_overrides.pop(get_session, None)
    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert "secret internal detail" not in response.text


def test_database_outage_returns_503():
    def down():
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))
        yield  # pragma: no cover

    app.dependency_overrides[get_session] = down
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            response = c.get("/api/v1/services")
    finally:
        app.dependency_overrides.pop(get_session, None)
    assert response.status_code == 503
    assert response.json()["code"] == "database_unavailable"
    assert "connection refused" not in response.text


def test_access_log_never_contains_personal_data_or_tokens(client, caplog):
    logger = logging.getLogger("antrian_barber")
    logger.addHandler(caplog.handler)  # the app logger does not propagate to root
    try:
        with caplog.at_level(logging.INFO, logger="antrian_barber"):
            slot = _first_slot(client)
            created = client.post("/api/v1/bookings", json=_payload(slot, phone="081298765432"))
            token = created.json()["access_token"]
    finally:
        logger.removeHandler(caplog.handler)
    assert "POST /api/v1/bookings" in caplog.text
    for forbidden in ("081298765432", "Pelanggan Demo", token, slot):
        assert forbidden not in caplog.text
