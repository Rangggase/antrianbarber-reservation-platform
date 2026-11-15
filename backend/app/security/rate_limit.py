"""Small in-process API rate limiter for local development / single-worker QA.

IMPORTANT: Each Python process has independent state, and restarts reset counters.
For public multi-worker deployment use a shared-store (Redis) / gateway limiter.
Never read X-Forwarded-For directly: only trust server-parsed request.client.
"""
from __future__ import annotations

from collections import deque
from math import ceil
from os import getenv
from threading import Lock
from time import monotonic

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class SlidingWindowLimiter:
    def __init__(self, window_seconds: int = 60, max_keys: int = 10000):
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._entries: dict[tuple[str, str], deque[float]] = {}
        self._lock = Lock()

    def check(self, client: str, category: str, limit: int, *, now: float | None = None) -> tuple[bool, int]:
        if limit < 1:
            raise ValueError('Rate limit must be >= 1')
        moment = monotonic() if now is None else now
        cutoff = moment - self.window_seconds
        key = (client, category)
        with self._lock:
            events = self._entries.get(key)
            if events is None:
                if len(self._entries) >= self.max_keys:
                    # Prune idle keys to keep memory bounded; do not evict active
                    # clients (that would allow simple rate-limit bypass).
                    for old_key, old_events in tuple(self._entries.items()):
                        if not old_events or old_events[-1] <= cutoff:
                            self._entries.pop(old_key, None)
                if len(self._entries) >= self.max_keys:
                    return False, self.window_seconds
                events = deque()
                self._entries[key] = events
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                return False, max(1, ceil(events[0] + self.window_seconds - moment))
            events.append(moment)
            return True, 0

    def reset_for_tests(self) -> None:
        with self._lock:
            self._entries.clear()


RATE_LIMITER = SlidingWindowLimiter()


def _policy(method: str, path: str) -> tuple[str, str, int] | None:
    # category, configuration env key, default requests per 60 seconds
    if method == 'GET' and path == '/api/v1/availability':
        return ('availability', 'AB_RL_AVAILABILITY_PER_MINUTE', 180)
    if method == 'POST' and path == '/api/v1/bookings':
        return ('create', 'AB_RL_CREATE_PER_MINUTE', 30)
    if path.startswith('/api/v1/bookings/'):
        rest = path[len('/api/v1/bookings/'):]
        if '/' not in rest and rest and method == 'GET':
            return ('detail', 'AB_RL_DETAIL_PER_MINUTE', 90)
        if rest.endswith('/cancel') and rest.count('/') == 1 and method == 'POST':
            return ('cancel', 'AB_RL_CANCEL_PER_MINUTE', 30)
    return None


def _limit_from_env(name: str, default: int) -> int:
    raw = getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f'{name} must be a positive integer') from exc
    if not 1 <= value <= 100000:
        raise RuntimeError(f'{name} must be between 1 and 100000')
    return value


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        selected = _policy(request.method, request.url.path)
        if selected:
            category, env_key, default = selected
            # Uses ASGI server's client address. Proxy trust must be configured
            # in Uvicorn, not from untrusted HTTP headers here.
            address = request.client.host if request.client else 'unknown'
            limit = _limit_from_env(env_key, default)
            allowed, retry_after = RATE_LIMITER.check(address, category, limit)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={'detail': 'Terlalu banyak permintaan. Coba lagi nanti.', 'code': 'rate_limited'},
                    headers={'Retry-After': str(retry_after), 'Cache-Control': 'no-store'},
                )
        return await call_next(request)
