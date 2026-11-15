# Antrian Barber v2.2b — Database schema and Alembic migration

**Scope:** adds five relational tables and a first migration. Does not change the React frontend or create customer-facing API endpoints.

## Schema
- `customers`: customers, unique normalized phone (normalization will be added at API layer).
- `barbers`: barber profiles and codes (`raka`, `naufal`, `dimas` for synthetic seed).
- `services`: services with duration and price (IDR integer).
- `schedules`: recurring availability per barber, Monday=0 to Sunday=6, times interpreted as local **Asia/Jakarta** wall-clock time; no schedules are seeded.
- `bookings`: records booking time (`TIMESTAMPTZ`, store aware UTC), barber, service, customer, status, queue number and price snapshot.

**Integrity:** FKs, unique phone/codes, positive duration, nonnegative price, valid intervals and allowed status. PostgreSQL uses an exclusion constraint to prevent overlapping bookings by the same barber for active/completed statuses. It requires the `btree_gist` extension, created by the migration. If the role cannot create the extension, ask a PostgreSQL administrator to enable `btree_gist` in this database and rerun migration. `cancelled` and `no_show` do not block slots.

**Not yet implemented:** validation that a selected appointment fits working schedules, customer-level duplicate rules, queue number generation, admin login, REST CRUD endpoints. These belong to v2.2c+. Avoid treating this schema as a fully operating reservation service.

## Installation (Windows PowerShell, backend root)

1. Back up any real database before schema changes. Confirm the database is specifically `antrian_barber_db` in `.env`.
2. Copy **contents** of patch folder into existing `backend/` (merge folders). No `.env` or existing `app/main.py` is included.
3. Append `alembic>=1.13,<2` to `requirements.txt` (if absent), install:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe -m pytest -q
   ```

4. Check migration against your PostgreSQL:

   ```powershell
   .\.venv\Scripts\python.exe -m alembic current
   .\.venv\Scripts\python.exe -m alembic upgrade head
   .\.venv\Scripts\python.exe -m alembic current
   .\.venv\Scripts\python.exe -m alembic check
   ```

   Expect `20261108_01 (head)` from current and `No new upgrade operations detected` from check; inspect any output rather than forcing success. Do not run `downgrade` on actual PostgreSQL unless you intentionally want to DROP ALL FIVE TABLES (data loss).

5. Optional sample catalog (only synthetic barbers and services; no bookings or customers):

   ```powershell
   .\.venv\Scripts\python.exe -m scripts.seed_demo
   ```

## Verify in pgAdmin 4 / DBeaver

Connect to `antrian_barber_db` and run:

```sql
SELECT current_database(), current_user;
SELECT version_num FROM alembic_version;
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY table_name;
SELECT conname, contype FROM pg_constraint
WHERE conrelid='public.bookings'::regclass ORDER BY conname;
```

You should find `customers`, `barbers`, `services`, `schedules`, `bookings`, `alembic_version`, and exclusion constraint `ex_bookings_barber_time_overlap` (contype `x`).

## Security / migrations
- Do not put passwords in `alembic.ini` or commit `.env`.
- Keep backup copies outside the published repository.
- The optional catalog seed is re-runnable and does not overwrite existing records.
- SQLAlchemy model metadata is separate from actual DB migration. Never call `Base.metadata.create_all` on production DB to replace Alembic.
- The existing two health tests remain; new tests run against temporary SQLite, which **does not test** PostgreSQL exclusion constraints. Verify PostgreSQL migration separately.
