# CLAUDE.md

Antrian Barber — proyek portofolio reservasi barbershop (mahasiswa Sistem Informasi). Monorepo: `frontend/` (React) dan `backend/` (FastAPI). Bahasa UI dan pesan error API: Indonesia.

## Perintah

**Backend** (dari `backend/`, Python venv di `.venv`)
```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q                      # 104 tes SQLite; +14 tes PostgreSQL bila TEST_DB_NAME diset
python -m scripts.create_staff --username admin --full-name "Admin" --role admin   # akun staf (password via prompt)
TEST_DB_NAME=antrian_barber_test python -m scripts.create_test_db   # sekali; nama WAJIB berakhiran _test
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
npm run e2e:staff                        # 13 tes area staf (API di-mock)
```

## Struktur
- `backend/app/api/reservations.py` — router tipis; aturan bisnis di `backend/app/services/booking_service.py`, model request/response di `schemas.py`
- Staf: `backend/app/api/staff.py` (router), `services/staff_service.py` (alur status + nomor antrean), `security/passwords.py` (scrypt), `security/staff_auth.py` (JWT HS256, secret `STAFF_JWT_SECRET` BEDA dari `BOOKING_TOKEN_SECRET`). User dimuat ulang tiap request, jadi menonaktifkan akun langsung berlaku. Frontend: `src/api/staff.ts`, `pages/StaffLoginPage.tsx`, `pages/StaffDashboardPage.tsx`, route `/staff` dan `/staff/login` (token di sessionStorage).
- Fitur admin: laporan (`services/report_service.py`, halaman `/staff/reports`) dan jadwal/cuti (`services/schedule_service.py`, `/staff/schedule`; cuti memblokir booking baru di `booking_service.available_starts`). Dokumentasi sistem: `docs/ARCHITECTURE.md` dan `docs/DATABASE.md` (diagram Mermaid; perbarui bila skema atau alur berubah).
- Nomor antrean diberikan saat pertama `confirmed`, per barber per hari WIB; pemberiannya diserialkan dengan kunci baris barber (`FOR NO KEY UPDATE`) dan dijaga indeks unik `uq_bookings_barber_local_day_queue`. Jangan hapus kuncinya: tanpa itu konfirmasi serentak saling kalah dan gagal 409.
- Tes Playwright memakai mock API yang menulis header CORS sendiri; kecocokan CORS nyata hanya dibuktikan tes backend (`test_cors_preflight_*`).
- `backend/app/errors.py` — format error seragam `{detail, code, request_id}` (`detail` tetap string, dipakai frontend); `observability.py` — logging + `X-Request-ID`. Log tidak boleh memuat nama, nomor HP, token, atau query string.
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
- Aturan di database (PostgreSQL saja): exclusion constraint `ex_bookings_barber_time_overlap` dan indeks unik parsial `uq_bookings_customer_local_day_active` (satu tiket aktif per pelanggan per hari WIB). Diuji di `tests/test_postgres_integration.py`; tes SQLite tidak menjangkaunya.
- Tes PostgreSQL men-DROP skema database tes: jangan arahkan `TEST_DB_NAME`/`TEST_DATABASE_URL` ke database asli.
- Gunakan data fiktif; jangan memasukkan data pelanggan nyata.
- Folder backup dan patch lama ada di luar repo (`D:\archive_antrianbarber`); jangan dikembalikan ke repo.
- Jangan push ke `main` atau force-push tanpa persetujuan pemilik.

## Aturan kerja
Diadaptasi dari [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills). Aturan keamanan di atas tetap didahulukan; tugas sepele tidak perlu proses penuh.
1. **Pikir dulu.** Nyatakan asumsi. Bila cakupan atau keputusan tidak jelas (privasi, hosting, akun), tanyakan sebelum menulis kode; jangan diam-diam memilih satu tafsiran.
2. **Sederhana.** Bangun hanya yang diminta: tanpa abstraksi, opsi konfigurasi, atau penanganan error untuk kasus yang mustahil.
3. **Ubah seperlunya.** Jangan merapikan atau me-refactor kode di luar permintaan; ikuti gaya yang ada. Hapus hanya impor/variabel yang jadi tak terpakai karena perubahan sendiri; kode mati lain cukup dilaporkan. Tiap baris yang berubah harus bisa ditelusuri ke permintaan.
4. **Berbasis target.** Ubah tugas menjadi cek yang bisa diverifikasi (bug: tes yang gagal dulu; refactor: tes lulus sebelum dan sesudah). Laporkan juga apa yang tidak diverifikasi.
