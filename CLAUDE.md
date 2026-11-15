# CLAUDE.md

Antrian Barber — proyek portofolio reservasi barbershop (mahasiswa Sistem Informasi). Monorepo: `frontend/` (React) dan `backend/` (FastAPI). Bahasa UI dan pesan error API: Indonesia.

## Perintah

**Backend** (dari `backend/`, Python venv di `.venv`)
```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q                      # 36 tes, SQLite in-memory
python -m alembic upgrade head           # butuh PostgreSQL + .env
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend** (dari `frontend/`)
```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # oxlint (hanya warning yang diketahui)
npx playwright test --project=chromium --workers=1   # 19 tes baseline, mode demo
```

## Struktur
- `backend/app/api/reservations.py` — katalog, slot, booking, token (satu file besar; direncanakan dipecah)
- `backend/app/models.py` — 5 tabel; naming convention constraint di `NAMING_CONVENTION`
- `backend/alembic/versions/` — migrasi; exclusion constraint `ex_bookings_barber_time_overlap` hanya PostgreSQL
- `backend/app/security/rate_limit.py` — rate limiter in-memory (satu proses)
- `frontend/src/api/` — klien API; `frontend/src/lib/bookings.ts` — penyimpanan demo `localStorage`
- `frontend/e2e/` — Playwright; `availability.spec.ts` dan `bookings.spec.ts` memakai config terpisah (mock API)

## Konvensi dan aturan penting
- Waktu disimpan UTC (`TIMESTAMPTZ`); jadwal barber memakai zona `Asia/Jakarta`.
- `.env` dan `frontend/.env.development.local` tidak boleh di-commit. Contoh ada di `.env.example`.
- `BOOKING_TOKEN_SECRET` (min. 32 karakter) wajib untuk membuat booking; tanpa itu API menjawab 503.
- Sumber data frontend dipilih saat build lewat `VITE_DATA_SOURCE=api|demo` (default `demo`), bisa ditimpa per fitur; lihat `frontend/src/api/config.ts`. Build produksi mode API gagal bila `VITE_API_BASE_URL` kosong/tidak valid (guard di `vite.config.ts`).
- Origin CORS backend dibaca dari `CORS_ORIGINS` (koma); wildcard dan path ditolak.
- Bukti build produksi memakai API: `npm run e2e:prod-api` (API di-mock; butuh `npx playwright install chromium`).
- Tes backend tidak menjangkau fitur khusus PostgreSQL.
- Gunakan data fiktif; jangan memasukkan data pelanggan nyata.
- Folder backup dan patch lama ada di luar repo (`D:\archive_antrianbarber`); jangan dikembalikan ke repo.
- Jangan push ke `main` atau force-push tanpa persetujuan pemilik.
