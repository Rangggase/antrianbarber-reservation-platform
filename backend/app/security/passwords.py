"""Password hashing with scrypt from the standard library (no extra native dependency).

Stored format: scrypt$<n>$<r>$<p>$<salt_b64>$<hash_b64>. Parameters are stored per hash so
they can be raised later without invalidating existing accounts.
"""
import base64
import hashlib
import hmac
import secrets

_N, _R, _P, _DKLEN = 2**14, 8, 1, 32  # ~16 MiB, within OpenSSL's default scrypt memory limit
MIN_PASSWORD_LENGTH = 12


def _derive(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=_DKLEN, maxmem=64 * 1024 * 1024)


def hash_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    salt = secrets.token_bytes(16)
    digest = _derive(password, salt, _N, _R, _P)
    b64 = lambda raw: base64.b64encode(raw).decode("ascii")  # noqa: E731
    return f"scrypt${_N}${_R}${_P}${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(hash_b64)
        actual = _derive(password, base64.b64decode(salt_b64), int(n), int(r), int(p))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# Verified for unknown usernames so response time does not reveal which usernames exist.
DUMMY_HASH = hash_password("not-a-real-account-password")
