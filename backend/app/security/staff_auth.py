"""Staff JWT issuing and FastAPI dependencies.

Tokens are short-lived HS256 JWTs signed with STAFF_JWT_SECRET (separate from the public
booking-token secret). The user row is reloaded on every request, so deactivating an
account or changing its role takes effect immediately rather than at token expiry.
"""
from datetime import datetime, timedelta, timezone
import os

import jwt
from sqlalchemy.orm import Session

from ..errors import AppError
from ..models import StaffUser

ISSUER = "antrian-barber"
DEFAULT_TOKEN_MINUTES = 480


def _secret() -> str:
    secret = os.getenv("STAFF_JWT_SECRET", "")
    if len(secret) < 32:
        raise AppError(503, "staff_auth_not_configured", "STAFF_JWT_SECRET belum dikonfigurasi (minimal 32 karakter)")
    return secret


def token_lifetime_minutes() -> int:
    raw = os.getenv("STAFF_TOKEN_MINUTES", str(DEFAULT_TOKEN_MINUTES))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError("STAFF_TOKEN_MINUTES must be an integer") from exc
    if not 5 <= value <= 1440:
        raise RuntimeError("STAFF_TOKEN_MINUTES must be between 5 and 1440")
    return value


def issue_token(user: StaffUser) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    lifetime = token_lifetime_minutes()
    claims = {"sub": str(user.id), "role": user.role, "iss": ISSUER, "iat": now, "exp": now + timedelta(minutes=lifetime)}
    return jwt.encode(claims, _secret(), algorithm="HS256"), lifetime * 60


def _unauthorized(detail: str = "Sesi tidak valid atau sudah berakhir. Silakan login ulang.") -> AppError:
    err = AppError(401, "unauthorized", detail)
    err.headers = {"WWW-Authenticate": "Bearer"}
    return err


def authenticate_bearer(session: Session, authorization: str | None) -> StaffUser:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Login diperlukan.")
    try:
        claims = jwt.decode(token, _secret(), algorithms=["HS256"], issuer=ISSUER, options={"require": ["exp", "iat", "sub", "iss"]})
        user_id = int(claims["sub"])
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise _unauthorized() from None
    user = session.get(StaffUser, user_id)
    if user is None or not user.is_active:
        raise _unauthorized()
    return user
