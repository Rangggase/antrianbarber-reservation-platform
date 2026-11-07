# QA Plan — Antrian Barber v2.1e

## Tujuan

Memverifikasi fungsionalitas inti sebelum pengembangan backend FastAPI/PostgreSQL, mencatat regresi serta menjadikan hasil pengujian bagian dari portofolio.

## Pemeriksaan otomatis

- **Navigasi:** enam menu dan CTA reservasi, browser Back, 404.
- **Deep linking:** booking dari katalog dan halaman profil barber.
- **Galeri:** filter kategori.
- **Wizard:** validasi layanan, slot waktu, identitas dan persetujuan.
- **Reservasi demo:** nomor tiket, persistensi setelah refresh, pembatalan, penolakan reservasi duplikat.
- **Mobile:** menu mobile dan horizontal overflow.

Tests dijalankan pada Chromium desktop, dengan subset skenario memakai viewport mobile 390×844. Ini bukan bukti cross-browser penuh; perlu Firefox dan WebKit serta pengujian perangkat nyata di fase lanjutan.

## Audit manual setelah automation

1. Chrome Lighthouse mobile dan desktop: Performance, Accessibility, Best Practices, SEO.
2. Akses keyboard: Tab, Shift+Tab, Enter, Escape, fokus terlihat dan dialog tiket.
3. Responsivitas: 320, 375, 390, 768, 1024, 1440 px.
4. Periksa koneksi gagal / foto fallback di tiap halaman.
5. Konfirmasi teks demo tidak menjanjikan slot nyata.

## Status saat pembuatan starter

- UAT manual v2.1d: **10/10 lulus** — dilaporkan oleh pemilik proyek.
- Vite build: **berhasil** — output pemilik proyek (2.158 modul, 776 ms).
- Playwright E2E: **belum dieksekusi di mesin pemilik proyek**.
- Lighthouse: **belum diukur**.

## Kriteria kelulusan v2.1e

- Semua test otomatis lulus atau pengecualian terdokumentasi dengan alasan yang kuat.
- Error kritis reservasi: nol.
- Tidak ada overflow horizontal pada ukuran layar yang ditargetkan.
- Perbaikan utama dari laporan Lighthouse dilakukan dan pengukuran ulang disimpan.
- Dokumentasi hasil pengujian dapat diulang pihak lain.
