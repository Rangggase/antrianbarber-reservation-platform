"""REST API e2e against an isolated in-memory SQLite engine (no PostgreSQL touched)."""
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models import Base, Barber, Booking, Customer, Schedule, Service
from app.api.reservations import get_session

JKT = ZoneInfo("Asia/Jakarta")


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("BOOKING_TOKEN_SECRET", "test-only-signing-secret-at-least-32-characters")
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def _foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
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
    return datetime.now(JKT).date() + timedelta(days=2)


def _slot(client):
    response = client.get("/api/v1/availability", params={"barber_id": 1, "service_id": 1, "date": _day().isoformat()})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["timezone"] == "Asia/Jakarta"
    assert data["slots"]
    return data["slots"][0]


def _payload(start):
    return {"full_name": "Pelanggan Demo", "phone": "081234567890", "barber_id": 1, "service_id": 1, "starts_at": start}


def test_catalogs(client):
    assert len(client.get("/api/v1/services").json()) == 1
    assert len(client.get("/api/v1/barbers").json()) == 1


def test_create_get_cancel_and_slot_reopened(client):
    slot = _slot(client)
    result = client.post("/api/v1/bookings", json=_payload(slot))
    assert result.status_code == 201, result.text
    booking = result.json()
    assert booking["reference_code"].startswith("AB-")
    token = booking["access_token"]
    assert token and "phone" not in booking
    ref = booking["reference_code"]
    assert client.get(f"/api/v1/bookings/{ref}").status_code == 403
    assert client.get(f"/api/v1/bookings/{ref}", headers={"X-Booking-Token": "invalid"}).status_code == 403
    view = client.get(f"/api/v1/bookings/{ref}", headers={"X-Booking-Token": token})
    assert view.status_code == 200 and view.json()["status"] == "pending"
    assert slot not in client.get("/api/v1/availability", params={"barber_id":1,"service_id":1,"date":_day().isoformat()}).json()["slots"]
    cancel = client.post(f"/api/v1/bookings/{ref}/cancel", headers={"X-Booking-Token": token})
    assert cancel.status_code == 200 and cancel.json()["status"] == "cancelled"
    assert slot in client.get("/api/v1/availability", params={"barber_id":1,"service_id":1,"date":_day().isoformat()}).json()["slots"]
    assert client.post(f"/api/v1/bookings/{ref}/cancel", headers={"X-Booking-Token": token}).status_code == 409


def test_booking_same_slot_conflict(client):
    slot = _slot(client)
    assert client.post("/api/v1/bookings", json=_payload(slot)).status_code == 201
    response = client.post("/api/v1/bookings", json={**_payload(slot), "phone": "081234567891"})
    assert response.status_code == 409


def test_invalid_timestamp_and_phone(client):
    slot = _slot(client)
    assert client.post("/api/v1/bookings", json={**_payload(slot), "starts_at": "2028-01-01T09:00:00"}).status_code == 422
    assert client.post("/api/v1/bookings", json={**_payload(slot), "phone": "abc"}).status_code == 422


def test_empty_schedule_and_outside_calendar(client):
    target = _day()
    response = client.get("/api/v1/availability", params={"barber_id": 1,"service_id": 1,"date": (target + timedelta(days=70)).isoformat()})
    assert response.status_code == 422
    response = client.get("/api/v1/availability", params={"barber_id": 888,"service_id": 1,"date": target.isoformat()})
    assert response.status_code == 404


def test_secret_required_for_booking(client, monkeypatch):
    monkeypatch.delenv("BOOKING_TOKEN_SECRET", raising=False)
    response = client.post("/api/v1/bookings", json=_payload(_slot(client)))
    assert response.status_code == 503


def test_same_phone_different_time_same_day_conflict(client):
    slot1, slot2 = client.get('/api/v1/availability', params={
        'barber_id': 1, 'service_id': 1, 'date': _day().isoformat(),
    }).json()['slots'][:2]
    assert client.post('/api/v1/bookings', json=_payload(slot1)).status_code == 201
    assert client.post('/api/v1/bookings', json=_payload(slot2)).status_code == 409
