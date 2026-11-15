# Antrian Barber — Reservation Platform

Aplikasi reservasi antrian barbershop, dibangun sebagai project portofolio.

**Status:** demo fullstack dalam pengembangan. Frontend dapat berjalan mandiri (mode demo, `localStorage`) atau terhubung ke backend FastAPI + PostgreSQL (mode API, lewat `VITE_DATA_SOURCE=api`, termasuk build produksi). Belum ada dashboard admin dan belum ada deployment publik. Lihat [roadmap](frontend/docs/ROADMAP.md).

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
