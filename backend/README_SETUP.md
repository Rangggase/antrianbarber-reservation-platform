# Antrian Barber — Backend Starter v2.2a

Starter ini **tidak mengganti** file frontend dan **belum** menyimpan reservasi ke PostgreSQL. Fungsinya baru membuktikan server FastAPI dan koneksi database berjalan.

## 1. Ekstrak
Salin folder `backend` dari ZIP ke `D:\new another projectA\` sehingga sejajar dengan `frontend`.

## 2. Buat database via pgAdmin 4
- Hubungkan pgAdmin ke server PostgreSQL lokal.
- Klik kanan **Databases > Create > Database**.
- Database name: `antrian_barber_db` (jangan pakai database proyek lain).
- Owner: gunakan role yang kamu miliki, misalnya `postgres`.
- Simpan. Tidak perlu membuat tabel manual sekarang.

## 3. PyCharm terminal PowerShell
```powershell
cd "D:\new another projectA\backend"
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Buka file `.env` di PyCharm dan ganti `DB_PASSWORD` dengan password role PostgreSQL lokal yang kamu gunakan. Kalau role berbeda dari `postgres`, ubah `DB_USER` juga. Jangan kirim atau screenshot nilai password dan jangan commit `.env`.

Kalau `py -3` tidak dikenali, coba `python -m venv .venv`. Disarankan Python 3.11 atau lebih baru.

## 4. Cek pengujian lokal
```powershell
.\.venv\Scripts\python.exe -m pytest -q
```
Target: 2 tests passed. Tes ini memakai SQLite in-memory untuk *menguji endpoint*, bukan membuktikan koneksi PostgreSQL.

## 5. Jalankan backend
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Buka:
- http://127.0.0.1:8000/docs (Swagger UI)
- http://127.0.0.1:8000/api/health (server hidup)
- http://127.0.0.1:8000/api/health/db (koneksi PostgreSQL)

Target endpoint `/api/health/db`:
```json
{"status":"ok","database":"connected"}
```

Jika mendapat 503, periksa server PostgreSQL berjalan, nama database, role, port, dan nilai `.env`. Jangan mengirim password ke chat.

## 6. Fitur yang BELUM ada
Belum ada tabel, migrasi Alembic, API layanan/barber, otentikasi admin, atau penyimpanan booking. Itu tahap v2.2b—v2.3 setelah koneksi berhasil.

## Struktur proyek
```text
new another projectA/
├── AntrianBarber_Professional/  # v2.0, tetap aman
├── frontend/                   # React v2.1c, tetap aman
└── backend/                    # FastAPI v2.2a
    ├── app/
    │   ├── api/health.py
    │   ├── config.py
    │   ├── database.py
    │   └── main.py
    ├── tests/test_health.py
    ├── .env.example
    ├── .gitignore
    └── requirements.txt
```
