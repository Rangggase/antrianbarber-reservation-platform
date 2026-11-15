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
Tes memakai SQLite in-memory, jadi **tidak menguji** constraint khusus PostgreSQL (exclusion constraint).

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

Migrasi: lihat juga [README_MIGRATION_v2_2b.md](README_MIGRATION_v2_2b.md).

## Struktur
```text
backend/
├── app/
│   ├── api/            # health.py, reservations.py
│   ├── security/       # rate_limit.py
│   ├── config.py  database.py  models.py  main.py
├── alembic/            # migrasi skema
├── scripts/            # seed data demo
├── tests/
├── requirements.txt        # dependensi runtime
└── requirements-dev.txt    # + pytest, httpx
```
