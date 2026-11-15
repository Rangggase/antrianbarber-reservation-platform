"""Uniform error responses: {"detail": str, "code": str, "request_id": str}.

`detail` stays a human-readable string (the frontend already depends on it) and
`code` is a stable machine-readable identifier.
"""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("antrian_barber.errors")

_DEFAULT_CODES = {
    400: "bad_request",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "rate_limited",
    503: "service_unavailable",
}
_LOCATION_PREFIXES = {"body", "query", "path", "header"}


class AppError(HTTPException):
    """HTTP error carrying a stable machine-readable code."""

    def __init__(self, status_code: int, code: str, detail: str):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _body(request: Request, detail: str, code: str, **extra) -> dict:
    body = {"detail": detail, "code": code, **extra}
    rid = _request_id(request)
    if rid:
        body["request_id"] = rid
    return body


async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = getattr(exc, "code", None) or _DEFAULT_CODES.get(exc.status_code, f"http_{exc.status_code}")
    detail = exc.detail if isinstance(exc.detail, str) else "Permintaan tidak dapat diproses"
    return JSONResponse(_body(request, detail, code), status_code=exc.status_code, headers=getattr(exc, "headers", None))


async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Only loc/msg/type are echoed: never the submitted values (they may contain personal data).
    errors = []
    for item in exc.errors():
        field = ".".join(str(part) for part in item.get("loc", ()) if part not in _LOCATION_PREFIXES)
        message = str(item.get("msg", "Nilai tidak valid")).removeprefix("Value error, ")
        errors.append({"field": field, "message": message, "type": item.get("type", "")})
    first = errors[0] if errors else {"field": "", "message": "Data tidak valid"}
    detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
    return JSONResponse(_body(request, detail, "validation_error", errors=errors), status_code=422)


async def _database_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
    logger.error("database unavailable request_id=%s error=%s", _request_id(request), type(exc.orig).__name__ if exc.orig else "OperationalError")
    return JSONResponse(_body(request, "Database sedang tidak tersedia. Coba lagi nanti.", "database_unavailable"), status_code=503)


async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error request_id=%s path=%s", _request_id(request), request.url.path)
    return JSONResponse(_body(request, "Terjadi kesalahan pada server", "internal_error"), status_code=500)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(OperationalError, _database_unavailable)
    app.add_exception_handler(Exception, _unhandled)
