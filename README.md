# Antrian Barber — Reservation Platform

Aplikasi reservasi antrian barbershop, dibangun sebagai project portofolio.

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
pip install -r requirements.txt
```
Salin `backend/.env.example` menjadi `backend/.env` lalu isi nilainya sebelum menjalankan server.
