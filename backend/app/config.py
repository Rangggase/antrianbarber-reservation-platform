"""Konfigurasi koneksi lokal. Rahasia disimpan dalam .env (jangan di-commit)."""
import os
import re
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.engine import URL

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)
_ORIGIN_RE = re.compile(r"https?://[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d{1,5})?")


def get_cors_origins() -> list[str]:
    """Allowed browser origins. CORS_ORIGINS (comma-separated) overrides the local defaults.

    Each entry must be a bare origin such as https://app.example.com. Wildcards and
    paths are rejected so a typo cannot silently open the API to every site.
    """
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return list(DEFAULT_CORS_ORIGINS)
    origins = [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]
    for origin in origins:
        if not _ORIGIN_RE.fullmatch(origin):
            raise RuntimeError(f"CORS_ORIGINS entry is not a valid origin (no wildcard or path): {origin!r}")
    return origins


def get_database_url():
    """SQLAlchemy URL menjaga password yang mengandung simbol khusus."""
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit
    return URL.create(
        drivername="postgresql+psycopg",
        username=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "antrian_barber_db"),
    )
