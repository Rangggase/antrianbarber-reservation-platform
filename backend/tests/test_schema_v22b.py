"""Schema and migration tests use an isolated SQLite database, never local PostgreSQL."""
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Base, Barber, Booking, Customer, Schedule, Service

TABLES = {"customers", "barbers", "services", "schedules", "bookings", "staff_users"}


def test_models_and_foreign_keys():
    assert TABLES == set(Base.metadata.tables)
    fks = {fk.target_fullname for fk in Base.metadata.tables["bookings"].foreign_keys}
    assert fks == {"customers.id", "barbers.id", "services.id"}
    assert {fk.target_fullname for fk in Base.metadata.tables["schedules"].foreign_keys} == {"barbers.id"}
    assert {fk.target_fullname for fk in Base.metadata.tables["staff_users"].foreign_keys} == {"barbers.id"}


def test_constraints_and_relationships_in_isolated_sqlite():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    @event.listens_for(engine, "connect")
    def set_fk(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        customer = Customer(full_name="Demo User", phone="08000000123")
        barber = Barber(code="raka", full_name="Raka")
        service = Service(code="classic", name="Classic", duration_minutes=45, price_idr=55000)
        session.add_all([customer, barber, service]); session.commit()
        session.refresh(customer); session.refresh(barber); session.refresh(service)
        start = datetime(2027, 1, 10, 3, 0, tzinfo=timezone.utc)
        booking = Booking(reference_code="DEMO-0001", customer_id=customer.id,
                          barber_id=barber.id, service_id=service.id,
                          starts_at=start, ends_at=start + timedelta(minutes=45), price_idr=55000)
        session.add(booking); session.commit()
        assert session.scalar(select(Booking).where(Booking.reference_code == "DEMO-0001")) is not None
        assert booking.customer.full_name == "Demo User"

    with Session(engine) as session:
        session.add(Service(code="invalid", name="Wrong", duration_minutes=0, price_idr=-10))
        with pytest.raises(IntegrityError):
            session.commit()
    engine.dispose()


def test_migration_upgrade_downgrade_sqlite_smoke(tmp_path, monkeypatch):
    # SQLite smoke tests common DDL; real PostgreSQL exclusion constraint
    # is independently verified through the user's pgAdmin/DBeaver checks.
    url = f"sqlite+pysqlite:///{(tmp_path / 'schema-test.db').as_posix()}"
    monkeypatch.setenv("DATABASE_URL", url)
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "head")
    engine = create_engine(url)
    assert TABLES.issubset(set(inspect(engine).get_table_names()))
    with engine.connect() as conn:
        assert conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == "20261116_03"
    command.downgrade(config, "base")
    assert not TABLES.intersection(set(inspect(engine).get_table_names()))
    engine.dispose()
