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

### Akun staf (admin / barber)
Isi `STAFF_JWT_SECRET` di `.env`, lalu buat akun. Password diminta lewat prompt (tersembunyi) atau variabel `STAFF_PASSWORD`; tidak pernah lewat argumen perintah. Minimal 12 karakter.
```powershell
.\.venv\Scripts\python.exe -m scripts.create_staff --username admin --full-name "Admin" --role admin
.\.venv\Scripts\python.exe -m scripts.create_staff --username raka --full-name "Raka Pratama" --role barber --barber-code raka
```
Menjalankan perintah yang sama untuk username yang ada akan mereset password-nya. `admin` melihat semua barber; `barber` hanya antreannya sendiri. Login frontend ada di `/staff/login`.

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

**Staf** (`/api/v1/staff`, header `Authorization: Bearer <token>`, respons `Cache-Control: no-store`):
| Method | Path | Fungsi |
| --- | --- | --- |
| POST | `/login` | Login, mengembalikan JWT (batas 10 percobaan/menit per klien) |
| GET | `/me` | Profil akun yang sedang login |
| GET | `/queue?date&barber_id` | Antrean harian (WIB); barber otomatis dibatasi ke barber miliknya |
| POST | `/bookings/{kode}/status` | Ubah status: `confirmed`, `in_service`, `completed`, `cancelled`, `no_show` |

Alur status: `pending → confirmed | cancelled`, `confirmed → in_service | cancelled | no_show` (no_show hanya setelah jam mulai), `in_service → completed`; `completed`, `cancelled`, `no_show` final. Nomor antrean diberikan saat pertama kali `confirmed`: berurutan per barber per hari WIB dan tidak pernah dipakai ulang. `GET /bookings/{kode}` untuk pelanggan kini juga memuat `queue_number`, `ahead_count`, dan `estimated_wait_minutes` (perkiraan, hanya hari ini).

**Format error** (semua endpoint): `{"detail": "<pesan>", "code": "<kode>", "request_id": "<id>"}`. Kode antara lain `slot_unavailable`, `slot_taken`, `customer_day_conflict`, `invalid_token`, `booking_not_found`, `validation_error` (disertai `errors[]`), `rate_limited`, `database_unavailable`, `internal_error`. Header `X-Request-ID` ada di setiap respons dan muncul di log.

Migrasi: lihat juga [README_MIGRATION_v2_2b.md](README_MIGRATION_v2_2b.md). Migrasi `20261115_02` menambah indeks unik "satu tiket aktif per pelanggan per hari (WIB)", dan `20261116_03` menambah tabel `staff_users` serta indeks unik nomor antrean; jalankan `alembic upgrade head` pada database dev Anda.

## Struktur
```text
backend/
├── app/
│   ├── api/            # health.py, reservations.py (router tipis)
│   ├── api/staff.py    # login, antrean, ubah status
│   ├── services/       # booking_service.py, staff_service.py (aturan bisnis)
│   ├── security/       # rate_limit.py, passwords.py (scrypt), staff_auth.py (JWT)
│   ├── schemas.py  errors.py  observability.py
│   ├── config.py  database.py  models.py  main.py
├── alembic/            # migrasi skema
├── scripts/            # seed data demo
├── tests/
├── requirements.txt        # dependensi runtime
└── requirements-dev.txt    # + pytest, httpx
```
