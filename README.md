# Antrian Barber — Reservation Platform

Aplikasi reservasi antrian barbershop, dibangun sebagai project portofolio.

**Status:** demo fullstack dalam pengembangan. Frontend dapat berjalan mandiri (mode demo, `localStorage`) atau terhubung ke backend FastAPI + PostgreSQL (mode API, lewat `VITE_DATA_SOURCE=api`, termasuk build produksi). Area staf (`/staff/login`, hanya mode API) menyediakan login admin/barber, antrean harian, alur status booking dengan nomor antrean, laporan (admin), serta pengaturan jam kerja dan cuti barber (admin). Belum ada deployment publik. Lihat [roadmap](frontend/docs/ROADMAP.md).

## Dokumentasi

- [Arsitektur sistem](docs/ARCHITECTURE.md): diagram komponen, alur booking dan konfirmasi, keputusan desain, batasan yang diketahui
- [Database](docs/DATABASE.md): ERD, constraint yang dijaga PostgreSQL, alur status, penanganan zona waktu
- [Studi kasus](frontend/docs/PORTFOLIO_CASE_STUDY.md) dan [laporan QA frontend](frontend/docs/qa/TEST_REPORT.md)
- [Panduan backend](backend/README_SETUP.md)

## Privasi dan data

Ini demo portofolio: **gunakan nama dan nomor HP fiktif.** Pada mode API, nama dan nomor HP disimpan apa adanya di database agar staf dapat menghubungi pelanggan, dan belum ada penghapusan otomatis. API publik tidak pernah mengembalikan data itu; hanya staf yang sudah login yang dapat melihatnya. Pada mode demo (default) data hanya ada di browser Anda. Jangan memasukkan data pelanggan nyata.

## Struktur

```
.
├── frontend/   # React + TypeScript + Vite (UI, booking, Playwright e2e)
└── backend/    # FastAPI + SQLAlchemy + Alembic (API, security, tests)
```

## Menjalankan

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Backend**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
python -m pytest -q
```
Salin `backend/.env.example` menjadi `backend/.env`, isi `DB_PASSWORD` dan `BOOKING_TOKEN_SECRET`. Langkah migrasi, seed, dan menjalankan server ada di [backend/README_SETUP.md](backend/README_SETUP.md).
