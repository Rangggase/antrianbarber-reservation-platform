"""Logging setup and per-request context (request id + access log).

The access log records method, path, status and duration only: never query strings,
request bodies, tokens, names or phone numbers.
"""
import logging
import os
import re
import uuid
from time import perf_counter

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("antrian_barber.access")
_REQUEST_ID_RE = re.compile(r"[A-Za-z0-9._-]{8,64}")


def configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = logging.getLevelName(level_name)
    if not isinstance(level, int):
        raise RuntimeError(f"LOG_LEVEL is not a valid level: {level_name!r}")
    root = logging.getLogger("antrian_barber")
    root.setLevel(level)
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root.addHandler(handler)
        root.propagate = False


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if _REQUEST_ID_RE.fullmatch(incoming) else uuid.uuid4().hex
        request.state.request_id = request_id
        started = perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "%s %s -> %s %.1fms request_id=%s",
            request.method, request.url.path, response.status_code, (perf_counter() - started) * 1000, request_id,
        )
        return response
