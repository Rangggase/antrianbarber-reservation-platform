# Case Study — Antrian Barber

## Konteks dan masalah

Antrian Barber bermula dari proyek pemrograman web dasar di awal perkuliahan. Versi awal menampilkan informasi barbershop, tetapi belum memiliki navigasi antarhalaman yang terstruktur atau alur reservasi yang dapat dicoba. Saya menjadikannya proyek portofolio untuk mempraktikkan pengembangan antarmuka aplikasi yang lebih mudah dipahami dan diuji.

## Tujuan pengembangan

- Memperbarui desain menjadi konsisten dan responsif.
- Memisahkan halaman pelanggan melalui routing yang jelas.
- Membuat alur reservasi demo yang dapat digunakan tanpa backend.
- Mencatat hasil pengujian agar perubahan dapat diverifikasi.

## Solusi yang dikembangkan

Website dibangun kembali dengan React, TypeScript, Vite, React Router, Tailwind CSS, dan komponen UI. Form reservasi diubah menjadi wizard empat langkah. Pengguna dapat memilih layanan dan barber ilustratif, menentukan jadwal preferensi, lalu memperoleh tiket demo yang tersimpan di browser sendiri.

## Keputusan teknis

- **Routing terpisah:** memudahkan navigasi dan pemeliharaan halaman.
- **Komponen reusable:** topbar, footer, katalog, dan formulir dipisah sesuai tanggung jawab.
- **Data simulasi:** mendukung prototipe sebelum API tersedia, dengan batasan data lokal dinyatakan jelas.
- **Pengujian Playwright:** memeriksa alur kritis termasuk kasus negatif.
- **Lighthouse:** mengevaluasi performa dan aspek kualitas lainnya pada hasil build production lokal.

## Hasil terukur

- 10/10 pengujian manual yang dilakukan pengembang lulus.
- 19/19 Playwright E2E pada Chromium lokal lulus.
- Lighthouse Beranda: 100 Performance, 95 Accessibility, 100 Best Practices, 92 SEO.
- Lighthouse Reservasi: 99 Performance, 96 Accessibility, 100 Best Practices, 91 SEO.

Hasil tersebut tidak menyatakan sudah ada pelanggan nyata atau reservasi produksi. Mode perangkat untuk tiap laporan Lighthouse perlu diperjelas saat bukti tambahan tersedia.

## Pelajaran yang diperoleh

Proyek ini menunjukkan bahwa perbaikan tampilan perlu diikuti validasi alur. Pengujian otomatis sebelumnya sempat menemukan masalah pada navigasi mobile dan alur booking yang belum tampak pada pengujian manual. Perbaikan tersebut menjadi alasan pentingnya regresi dan pencatatan bukti sebelum release.

## Tahap lanjutan

FastAPI + PostgreSQL untuk data terpusat, otorisasi admin, slot booking valid, audit perubahan, dan dashboard analitik. Tahapan tersebut masih dalam roadmap, bukan bagian dari frontend v2.1e.
