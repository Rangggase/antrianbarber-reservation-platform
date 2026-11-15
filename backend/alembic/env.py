"""Alembic environment. Uses existing backend .env; secrets stay out of alembic.ini."""
from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from alembic import context

from app.config import get_database_url
from app.models import Base  # registers all five tables

config = context.config
if config.config_file_name:
    # Keep application loggers alive when migrations run inside the same process (tests).
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(
        url=str(get_database_url()),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    engine = create_engine(get_database_url(), poolclass=pool.NullPool)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
