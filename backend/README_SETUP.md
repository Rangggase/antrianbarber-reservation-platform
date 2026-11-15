# Antrian Barber — Backend (FastAPI + PostgreSQL)

REST API demo untuk katalog layanan, ketersediaan slot, dan reservasi. Belum production-ready dan belum memiliki login admin.

## Prasyarat
- Python 3.11+ (diuji di 3.12/3.13)
- PostgreSQL lokal (via pgAdmin 4 atau CLI)

## 1. Buat database
Di pgAdmin 4: **Databases > Create > Database**, nama `antrian_barber_db`. Tabel dibuat lewat migrasi, bukan manual.

Migrasi memakai ekstensi `btree_gist` (untuk mencegah dua booking bertabrakan pada satu barber), sehingga role database harus boleh menjalankan `CREATE EXTENSION`.

## 2. Siapkan lingkungan
```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```
Edit `.env`: isi `DB_PASSWORD` dan **`BOOKING_TOKEN_SECRET`** (minimal 32 karakter; tanpa ini booking mengembalikan 503). Jangan commit `.env`.

## 3. Migrasi dan data demo
```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m scripts.seed_demo
.\.venv\Scripts\python.exe -m scripts.seed_schedules_demo
```
Skrip seed idempoten dan hanya berisi data fiktif.

## 4. Jalankan tes
```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
Secara default tes memakai SQLite in-memory dan **melewati** tes PostgreSQL.

**Tes integrasi PostgreSQL** (exclusion constraint, indeks unik per hari, balapan konkurensi) memakai database terpisah. Skemanya di-DROP lalu dibuat ulang, jadi namanya wajib berakhiran `_test` dan jangan diarahkan ke data asli:
```powershell
$env:TEST_DB_NAME = "antrian_barber_test"      # kredensial DB_* diambil dari .env
.\.venv\Scripts\python.exe -m scripts.create_test_db
.\.venv\Scripts\python.exe -m pytest -q
```
Alternatifnya set `TEST_DATABASE_URL` penuh (dipakai di CI).

## 5. Jalankan server
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
- Swagger UI: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health dan `/api/health/db`

## Endpoint utama (`/api/v1`)
| Method | Path | Fungsi |
| --- | --- | --- |
| GET | `/services`, `/barbers` | Katalog aktif |
| GET | `/availability?barber_id&service_id&date` | Slot kosong |
| POST | `/bookings` | Buat reservasi, mengembalikan `access_token` |
| GET | `/bookings/{reference_code}` | Lihat reservasi (header `X-Booking-Token`) |
| POST | `/bookings/{reference_code}/cancel` | Batalkan reservasi (header `X-Booking-Token`) |

**Format error** (semua endpoint): `{"detail": "<pesan>", "code": "<kode>", "request_id": "<id>"}`. Kode antara lain `slot_unavailable`, `slot_taken`, `customer_day_conflict`, `invalid_token`, `booking_not_found`, `validation_error` (disertai `errors[]`), `rate_limited`, `database_unavailable`, `internal_error`. Header `X-Request-ID` ada di setiap respons dan muncul di log.

Migrasi: lihat juga [README_MIGRATION_v2_2b.md](README_MIGRATION_v2_2b.md). Migrasi `20261115_02` menambah indeks unik "satu tiket aktif per pelanggan per hari (WIB)"; jalankan `alembic upgrade head` pada database dev Anda.

## Struktur
```text
backend/
├── app/
│   ├── api/            # health.py, reservations.py (router tipis)
│   ├── services/       # booking_service.py (aturan bisnis)
│   ├── security/       # rate_limit.py
│   ├── schemas.py  errors.py  observability.py
│   ├── config.py  database.py  models.py  main.py
├── alembic/            # migrasi skema
├── scripts/            # seed data demo
├── tests/
├── requirements.txt        # dependensi runtime
└── requirements-dev.txt    # + pytest, httpx
```
