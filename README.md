# Antrian Barber — Platform Reservasi Barbershop

Proyek portofolio Sistem Informasi: reservasi dan antrean barbershop dengan konsep **"Karcis"** — setiap booking menjadi tiket bernomor yang bisa diperiksa pelanggan dan dijalankan staf di hari kedatangan.

**Status:** demo fullstack, belum ada deployment publik. Frontend bisa berjalan mandiri (mode demo, data di `localStorage`) atau terhubung ke backend FastAPI + PostgreSQL (mode API). Lihat [roadmap](frontend/docs/ROADMAP.md).

## Masalah dan solusi

**Masalah.** Barbershop kecil sering mengatur antrean lewat chat atau catatan manual: slot dobel, pelanggan tidak tahu kapan giliran, dan pemilik tidak punya gambaran pendapatan atau tingkat tidak hadir.

**Solusi.**

- **Pelanggan** memilih layanan, barber, dan slot yang benar-benar kosong, lalu menerima karcis dengan nomor antrean dan perkiraan waktu tunggu. Tanpa akun; akses tiket memakai token bertanda tangan.
- **Staf (barber dan admin)** masuk ke area staf untuk mengonfirmasi booking, menjalankan antrean harian (`pending → confirmed → in_service → completed`, plus `cancelled` dan `no_show`), dan mengatur jam kerja serta cuti.
- **Pemilik (admin)** melihat laporan: pendapatan, tingkat tidak hadir, dan jam tersibuk.
- **Integritas data dijaga database:** tidak ada dua booking aktif yang bertabrakan pada satu barber, dan satu pelanggan hanya punya satu tiket aktif per hari. Nomor antrean berurutan per barber per hari dan aman terhadap konfirmasi serentak.

## Arsitektur dan tech stack

```
Browser ── React + TypeScript (Vite) ──► FastAPI ──► PostgreSQL
            mode demo: localStorage        │          constraint penjaga jadwal
            mode API : HTTP /api/v1        └─ JWT staf, token tiket HMAC, rate limit
```

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS 4, sistem desain berbasis token (`frontend/src/ui/`) |
| Backend | FastAPI, SQLAlchemy, Alembic, scrypt (password), JWT HS256 (staf) |
| Database | PostgreSQL (exclusion constraint dan indeks unik parsial); SQLite hanya untuk tes cepat |
| Pengujian | pytest, Playwright, axe-core, skrip kontras token, Lighthouse |

Zona waktu: disimpan UTC, jadwal barber memakai `Asia/Jakarta`.

## Sorotan kualitas

Diukur di mesin pengembang pada 15 November 2026 (belum ada CI di GitHub).

| Aspek | Hasil |
| --- | --- |
| Tes backend | **118 lulus** — 104 pada SQLite, 14 pada PostgreSQL asli (constraint, migrasi bolak-balik, balapan konkurensi) |
| Tes Playwright | **63 lulus** — alur pelanggan, area staf, build produksi mode API, sistem desain |
| Aksesibilitas | axe-core (WCAG 2A/2AA) pada 7 rute pelanggan: tanpa pelanggaran serius dan kritis; Lighthouse Accessibility 100. Pelanggaran sedang/ringan dan uji manual screen reader belum dilakukan |
| Kontras warna | 32 pasangan token lulus batas WCAG |
| Lighthouse (build produksi lokal) | Performance **95–100**, Accessibility **100**, Best Practices **100**, SEO **91–92** pada Beranda dan Reservasi, Mobile dan Desktop (median 3 jalan) |

Skor Lighthouse adalah estimasi laboratorium, bukan data pengguna nyata. Rincian dan batasannya ada di [laporan QA](frontend/docs/qa/TEST_REPORT.md).

## Dokumentasi

- [Arsitektur sistem](docs/ARCHITECTURE.md): diagram komponen, alur booking dan konfirmasi, keputusan desain, batasan yang diketahui
- [Database](docs/DATABASE.md): ERD, constraint yang dijaga PostgreSQL, alur status, penanganan zona waktu
- [Studi kasus portofolio](frontend/docs/PORTFOLIO_CASE_STUDY.md): konteks, keputusan teknis, hasil terukur, pelajaran
- [Laporan QA frontend](frontend/docs/qa/TEST_REPORT.md)
- [Rencana sistem desain "Karcis"](design-system/MASTER.md)
- [Panduan backend](backend/README_SETUP.md)

## Struktur

```
.
├── frontend/       # React + TypeScript + Vite (UI, booking, area staf, Playwright)
├── backend/        # FastAPI + SQLAlchemy + Alembic (API, keamanan, tes)
├── design-system/  # Rencana dan bukti sistem desain
└── docs/           # Arsitektur dan database
```

## Menjalankan secara lokal

Butuh Node.js dan Python 3. Mode API juga butuh PostgreSQL.

**Frontend (mode demo, tanpa backend)**
```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

**Backend**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Untuk menjalankan API: salin `backend/.env.example` menjadi `backend/.env`, isi `DB_PASSWORD`, `BOOKING_TOKEN_SECRET`, dan `STAFF_JWT_SECRET`, lalu ikuti [backend/README_SETUP.md](backend/README_SETUP.md) untuk migrasi dan membuat akun staf pertama. Mode API di frontend dipilih lewat `VITE_DATA_SOURCE=api` dan `VITE_API_BASE_URL`.

## Privasi dan data

Ini demo portofolio: **gunakan nama dan nomor HP fiktif.** Pada mode API, nama dan nomor HP disimpan apa adanya di database agar staf dapat menghubungi pelanggan, dan belum ada penghapusan otomatis. API publik tidak pernah mengembalikan data itu; hanya staf yang sudah login yang dapat melihatnya. Pada mode demo (default) data hanya ada di browser Anda.
