"""Create the PostgreSQL database used by integration tests, if it does not exist.

Usage (from backend/):  TEST_DB_NAME=antrian_barber_test python -m scripts.create_test_db
Credentials come from .env (DB_*) or TEST_DATABASE_URL. The name must end with "_test".
"""
from sqlalchemy import create_engine, text

from app.config import get_test_database_url


def main() -> None:
    url = get_test_database_url()
    if url is None:
        raise SystemExit("Set TEST_DB_NAME (e.g. antrian_barber_test) or TEST_DATABASE_URL first.")
    maintenance = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with maintenance.connect() as conn:
            exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}).scalar()
            if exists:
                print(f"Database {url.database!r} already exists.")
            else:
                conn.execute(text(f'CREATE DATABASE "{url.database}"'))
                print(f"Database {url.database!r} created.")
    finally:
        maintenance.dispose()


if __name__ == "__main__":
    main()
