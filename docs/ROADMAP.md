# Roadmap — Antrian Barber

| Versi | Lingkup | Status |
| --- | --- | --- |
| v2.0 | Redesign HTML/CSS/JavaScript | Arsip awal |
| v2.1 | Migrasi React + TypeScript, halaman terpisah | Selesai |
| v2.1d | UX reservasi empat langkah, profil barber, galeri | Selesai |
| v2.1e | UAT, Playwright Chromium, Lighthouse baseline | Lulus menurut laporan lokal; audit mode tambahan menyusul |
| v2.2 | FastAPI, PostgreSQL, migrasi skema | Direncanakan |
| v2.3 | API reservasi dan sinkronisasi frontend/backend | Direncanakan |
| v2.4 | Dashboard admin, sidebar, login dan manajemen antrean | Direncanakan |
| v2.5 | Analytics, CI/CD, deployment dan laporan portofolio final | Direncanakan |

## Prinsip pengerjaan

1. Backend dikembangkan pada branch/versi tersendiri setelah frontend baseline disimpan.
2. UI yang sudah ada tidak mengklaim ketersediaan barber nyata sampai backend memiliki validasi jadwal dan kapasitas.
3. Nomor HP dan informasi pelanggan tidak disimpan di demo publik sebelum rancangan privasi dan keamanan tersedia.
4. Setiap fitur baru disertai tes dan dokumentasi keputusan teknis.
5. Repo saat ini adalah frontend-only. Struktur monorepo (frontend/ dan backend/) dipertimbangkan ketika integrasi benar-benar dimulai.
