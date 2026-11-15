"""No PostgreSQL connections or production database writes in this test module."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.reservations import get_session
from app.security.rate_limit import RATE_LIMITER, SlidingWindowLimiter, _policy


@pytest.fixture(autouse=True)
def clean_rate_limits():
    RATE_LIMITER.reset_for_tests()
    # FastAPI resolves dependencies even on invalid input. Stub DB access;
    # these tests only examine middleware, never touch any real database.
    original = app.dependency_overrides.get(get_session)
    app.dependency_overrides[get_session] = lambda: None
    try:
        yield
    finally:
        if original is None:
            app.dependency_overrides.pop(get_session, None)
        else:
            app.dependency_overrides[get_session] = original
        RATE_LIMITER.reset_for_tests()


def test_sliding_window_rejects_and_resets():
    limiter = SlidingWindowLimiter(window_seconds=60)
    assert limiter.check('1.2.3.4', 'create', 2, now=100) == (True, 0)
    assert limiter.check('1.2.3.4', 'create', 2, now=101) == (True, 0)
    assert limiter.check('1.2.3.4', 'create', 2, now=102) == (False, 58)
    assert limiter.check('1.2.3.4', 'create', 2, now=160) == (True, 0)


def test_client_and_action_are_scoped():
    limiter = SlidingWindowLimiter()
    assert limiter.check('client-a', 'create', 1, now=10)[0]
    assert not limiter.check('client-a', 'create', 1, now=11)[0]
    assert limiter.check('client-b', 'create', 1, now=11)[0]
    assert limiter.check('client-a', 'detail', 1, now=11)[0]


def test_fixed_storage_never_evicts_active_keys():
    limiter = SlidingWindowLimiter(max_keys=1)
    assert limiter.check('a', 'create', 1, now=10)[0]
    assert not limiter.check('b', 'create', 1, now=11)[0]
    assert not limiter.check('a', 'create', 1, now=11)[0]
    assert limiter.check('b', 'create', 1, now=70)[0]


def test_policy_only_matches_expected_routes():
    assert _policy('POST', '/api/v1/bookings')[0] == 'create'
    assert _policy('GET', '/api/v1/bookings/AB-DEMO')[0] == 'detail'
    assert _policy('POST', '/api/v1/bookings/AB-DEMO/cancel')[0] == 'cancel'
    assert _policy('GET', '/api/v1/availability')[0] == 'availability'
    assert _policy('GET', '/api/health') is None
    assert _policy('POST', '/api/v1/bookings/AB-DEMO') is None
    assert _policy('POST', '/api/v1/staff/login')[0] == 'login'
    assert _policy('GET', '/api/v1/staff/queue')[0] == 'staff'


def test_http_429_and_retry_after(monkeypatch):
    monkeypatch.setenv('AB_RL_CREATE_PER_MINUTE', '2')
    with TestClient(app) as client:
        # Validation rejects missing JSON, but rate limiting is earlier in stack.
        assert client.post('/api/v1/bookings').status_code == 422
        assert client.post('/api/v1/bookings').status_code == 422
        r = client.post('/api/v1/bookings')
        assert r.status_code == 429
        assert int(r.headers['Retry-After']) >= 1
        assert 'access_token' not in r.text


def test_ignore_spoofed_forwarded_for(monkeypatch):
    monkeypatch.setenv('AB_RL_CREATE_PER_MINUTE', '1')
    with TestClient(app) as client:
        assert client.post('/api/v1/bookings', headers={'X-Forwarded-For': '1.2.3.4'}).status_code == 422
        assert client.post('/api/v1/bookings', headers={'X-Forwarded-For': '5.6.7.8'}).status_code == 429


def test_cors_headers_remain_present_on_429(monkeypatch):
    monkeypatch.setenv('AB_RL_CREATE_PER_MINUTE', '1')
    with TestClient(app) as client:
        headers = {'Origin': 'http://localhost:5173'}
        client.post('/api/v1/bookings', headers=headers)
        r = client.post('/api/v1/bookings', headers=headers)
        assert r.status_code == 429
        assert r.headers.get('access-control-allow-origin') == 'http://localhost:5173'


def test_health_does_not_use_api_rate_limit(monkeypatch):
    monkeypatch.setenv('AB_RL_CREATE_PER_MINUTE', '1')
    with TestClient(app) as client:
        for _ in range(4):
            assert client.get('/api/health').status_code == 200
