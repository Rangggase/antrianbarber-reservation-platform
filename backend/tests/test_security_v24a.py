"""v2.4a security regression, isolated SQLite only: NEVER touches the real PostgreSQL DB."""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.reservations import get_session
from app.models import Base, Barber, Booking, Schedule, Service

JKT = ZoneInfo('Asia/Jakarta')


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv('BOOKING_TOKEN_SECRET', 'v24a-test-only-strong-secret-please-do-not-use-live-1234')
    engine = create_engine('sqlite+pysqlite:///:memory:',
        connect_args={'check_same_thread': False}, poolclass=StaticPool)

    @event.listens_for(engine, 'connect')
    def _enable_foreign_keys(connection, _record):
        connection.execute('PRAGMA foreign_keys=ON')

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Barber(code='raka', full_name='Raka Demo', is_active=True))
        session.add(Service(code='classic', name='Classic Demo',
                            duration_minutes=45, price_idr=55000, is_active=True))
        session.commit()
        for weekday in range(7):
            session.add(Schedule(barber_id=1, weekday=weekday,
                                 start_time=time(9), end_time=time(17), is_active=True))
        session.commit()

    def override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_session, None)
        engine.dispose()


def make_booking(client, phone, index=0):
    date_str = (datetime.now(JKT) + timedelta(days=2)).date().isoformat()
    slots = client.get('/api/v1/availability', params={
        'barber_id': 1, 'service_id': 1, 'date': date_str,
    })
    assert slots.status_code == 200
    starts = slots.json()['slots']
    assert len(starts) > index
    response = client.post('/api/v1/bookings', json={
        'full_name': 'Pelanggan Uji', 'phone': phone, 'barber_id': 1,
        'service_id': 1, 'starts_at': starts[index],
    })
    assert response.status_code == 201, response.text
    return response.json()


def test_no_token_or_invalid_token_cannot_read_booking(client):
    ticket = make_booking(client, '081234567801')
    path = f"/api/v1/bookings/{ticket['reference_code']}"
    for headers in ({}, {'X-Booking-Token': 'invalid-token'}):
        response = client.get(path, headers=headers)
        assert response.status_code == 403
        assert 'phone' not in response.text
        assert 'full_name' not in response.text


def test_token_for_ticket_a_does_not_open_ticket_b(client):
    a = make_booking(client, '081234567802')
    b = make_booking(client, '081234567803')
    path = f"/api/v1/bookings/{b['reference_code']}"
    wrong = client.get(path, headers={'X-Booking-Token': a['access_token']})
    assert wrong.status_code == 403
    correct = client.get(path, headers={'X-Booking-Token': b['access_token']})
    assert correct.status_code == 200
    assert correct.json()['reference_code'] == b['reference_code']


def test_wrong_token_cannot_cancel_or_change_status(client):
    ticket = make_booking(client, '081234567804')
    path = f"/api/v1/bookings/{ticket['reference_code']}"
    assert client.post(path + '/cancel').status_code == 403
    assert client.post(path + '/cancel', headers={'X-Booking-Token': 'wrong'}).status_code == 403
    current = client.get(path, headers={'X-Booking-Token': ticket['access_token']})
    assert current.status_code == 200
    assert current.json()['status'] == 'pending'


def test_booking_response_does_not_expose_personal_data(client):
    ticket = make_booking(client, '081234567805')
    assert 'phone' not in ticket and 'full_name' not in ticket
    assert 'access_token' in ticket
    path = f"/api/v1/bookings/{ticket['reference_code']}"
    response = client.get(path, headers={'X-Booking-Token': ticket['access_token']})
    assert response.status_code == 200
    fields = set(response.json().keys())
    assert 'phone' not in fields and 'full_name' not in fields
    assert 'access_token' not in fields


def test_secret_rotation_invalidates_previous_token(client, monkeypatch):
    ticket = make_booking(client, '081234567806')
    path = f"/api/v1/bookings/{ticket['reference_code']}"
    headers = {'X-Booking-Token': ticket['access_token']}
    assert client.get(path, headers=headers).status_code == 200
    monkeypatch.setenv('BOOKING_TOKEN_SECRET', 'v24a-another-strong-secret-for-rotation-test-xyz')
    assert client.get(path, headers=headers).status_code == 403


def test_booking_rejects_short_secret_without_writing(client, monkeypatch):
    day = (datetime.now(JKT) + timedelta(days=2)).date().isoformat()
    slots = client.get('/api/v1/availability', params={
        'barber_id': 1, 'service_id': 1, 'date': day,
    }).json()['slots']
    monkeypatch.setenv('BOOKING_TOKEN_SECRET', 'short')
    result = client.post('/api/v1/bookings', json={
        'full_name': 'Pelanggan Uji', 'phone': '081234567807',
        'barber_id': 1, 'service_id': 1, 'starts_at': slots[0],
    })
    assert result.status_code == 503


def test_cors_denies_unlisted_origin(client):
    response = client.options('/api/v1/bookings', headers={
        'Origin': 'https://attacker.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,X-Booking-Token',
    })
    assert response.status_code == 400
    assert response.headers.get('access-control-allow-origin') != 'https://attacker.example'


def test_cors_allows_local_dev_origin(client):
    response = client.options('/api/v1/bookings', headers={
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,X-Booking-Token',
    })
    assert response.status_code == 200
    assert response.headers.get('access-control-allow-origin') == 'http://localhost:5173'
