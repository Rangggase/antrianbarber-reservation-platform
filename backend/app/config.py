"""Konfigurasi koneksi lokal. Rahasia disimpan dalam .env (jangan di-commit)."""
import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.engine import URL

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


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
