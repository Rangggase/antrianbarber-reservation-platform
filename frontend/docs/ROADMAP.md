# Roadmap — Antrian Barber

| Versi | Lingkup | Status |
| --- | --- | --- |
| v2.0 | Redesign HTML/CSS/JavaScript | Arsip awal |
| v2.1 | Migrasi React + TypeScript, halaman terpisah | Selesai |
| v2.1d | UX reservasi empat langkah, profil barber, galeri | Selesai |
| v2.1e | UAT, Playwright Chromium, Lighthouse baseline | Lulus menurut laporan lokal; audit mode tambahan menyusul |
| v2.2 | FastAPI, PostgreSQL, migrasi skema | Selesai |
| v2.3 | API reservasi dan sinkronisasi frontend/backend (mode API di dev) | Selesai |
| v2.4 | Keamanan dasar: token akses, rate limit, CORS | Selesai |
| v2.5 | Sprint 0: fondasi (env, CI, dokumentasi sinkron) | Selesai |
| v2.5.1 | Sprint 1: API di build produksi, CORS dari env | Selesai |
| v2.6 | Sprint 2: tes PostgreSQL asli, indeks unik per hari, refactor backend, error seragam dan logging | Selesai (CI PostgreSQL belum dijalankan di GitHub) |
| v2.7 | Login admin/barber, status antrean, dashboard | Direncanakan |
| v2.8 | Laporan, manajemen jadwal, deployment dan studi kasus final | Direncanakan |

## Prinsip pengerjaan

1. Backend dikembangkan pada branch/versi tersendiri setelah frontend baseline disimpan.
2. UI yang sudah ada tidak mengklaim ketersediaan barber nyata sampai backend memiliki validasi jadwal dan kapasitas.
3. Backend menyimpan nama dan nomor HP pelanggan (data fiktif pada demo). Kebijakan privasi final ditetapkan sebelum deployment publik.
4. Setiap fitur baru disertai tes dan dokumentasi keputusan teknis.
5. Repo berstruktur monorepo: `frontend/` dan `backend/`.
