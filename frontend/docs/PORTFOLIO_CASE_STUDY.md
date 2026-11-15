# Case Study — Antrian Barber

## Konteks dan masalah

Antrian Barber bermula dari proyek pemrograman web dasar di awal perkuliahan. Versi awal menampilkan informasi barbershop, tetapi belum memiliki navigasi antarhalaman yang terstruktur atau alur reservasi yang dapat dicoba. Saya menjadikannya proyek portofolio untuk mempraktikkan pengembangan antarmuka aplikasi yang lebih mudah dipahami dan diuji.

## Tujuan pengembangan

- Memperbarui desain menjadi konsisten dan responsif.
- Memisahkan halaman pelanggan melalui routing yang jelas.
- Membuat alur reservasi demo yang dapat digunakan tanpa backend.
- Mencatat hasil pengujian agar perubahan dapat diverifikasi.
- Menambahkan backend sungguhan: slot yang tidak bisa dobel, antrean yang dikelola staf, dan laporan sederhana untuk pemilik.

## Solusi yang dikembangkan

Website dibangun kembali dengan React, TypeScript, Vite, React Router, Tailwind CSS, dan komponen UI. Form reservasi diubah menjadi wizard empat langkah. Pengguna dapat memilih layanan dan barber ilustratif, menentukan jadwal preferensi, lalu memperoleh tiket demo yang tersimpan di browser sendiri.

Tahap berikutnya menambahkan backend FastAPI + PostgreSQL. Pelanggan dapat memesan slot yang benar-benar kosong dan memeriksa nomor antrean serta perkiraan waktu tunggu. Admin dan barber masuk ke area staf untuk mengonfirmasi booking, menjalankan antrean harian, melihat laporan (pendapatan, tingkat tidak hadir, jam tersibuk), dan mengatur jam kerja serta cuti barber. Frontend tetap bisa berjalan mandiri dalam mode demo; mode API dipilih saat build. Gambaran sistem ada di [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) dan skema database di [docs/DATABASE.md](../../docs/DATABASE.md).

## Keputusan teknis

- **Routing terpisah:** memudahkan navigasi dan pemeliharaan halaman.
- **Komponen reusable:** topbar, footer, katalog, dan formulir dipisah sesuai tanggung jawab.
- **Data simulasi:** mendukung prototipe sebelum API tersedia, dengan batasan data lokal dinyatakan jelas.
- **Pengujian Playwright:** memeriksa alur kritis termasuk kasus negatif.
- **Lighthouse:** mengevaluasi performa dan aspek kualitas lainnya pada hasil build production lokal.
- **Aturan penting dijaga database:** tidak ada dua booking aktif yang bertabrakan pada satu barber (exclusion constraint) dan satu pelanggan hanya punya satu tiket aktif per hari WIB (indeks unik parsial). Kode aplikasi tetap mengecek lebih dulu agar pesan error ramah, tetapi database menjadi penjaga terakhir.
- **Tiket tanpa akun pelanggan:** akses ke tiket memakai token HMAC, sehingga kode tiket saja tidak membuka data apa pun, dan respons publik tidak pernah memuat nama atau nomor HP.
- **Area staf terpisah dari pelanggan:** peran `admin` dan `barber`, JWT berumur pendek dengan secret terpisah, password di-hash dengan scrypt, dan akun dimuat ulang di setiap request sehingga menonaktifkan akun langsung berlaku.
- **Alur status yang eksplisit:** `pending → confirmed → in_service → completed`, plus `cancelled` dan `no_show`; nomor antrean diberikan saat konfirmasi, berurutan per barber per hari WIB.

## Hasil terukur

- 10/10 pengujian manual yang dilakukan pengembang lulus.
- 19/19 Playwright E2E pada Chromium lokal lulus.
- Lighthouse Beranda: 100 Performance, 95 Accessibility, 100 Best Practices, 92 SEO.
- Lighthouse Reservasi: 99 Performance, 96 Accessibility, 100 Best Practices, 91 SEO.

Angka di atas berasal dari rilis frontend v2.1e. Untuk backend dan area staf (diukur pada mesin pengembang, bukan di CI):

- 118 tes backend lulus: 104 pada SQLite dan 14 pada PostgreSQL asli (constraint, migrasi bolak-balik, balapan konkurensi).
- 63 tes Playwright lulus: 29 baseline demo (termasuk shell pelanggan), 14 area staf, 3 build produksi memakai API, 5 dengan API di-mock, dan 12 untuk sistem desain.

Hasil tersebut tidak menyatakan sudah ada pelanggan nyata atau reservasi produksi. Mode perangkat untuk tiap laporan Lighthouse perlu diperjelas saat bukti tambahan tersedia.

## Pelajaran yang diperoleh

Proyek ini menunjukkan bahwa perbaikan tampilan perlu diikuti validasi alur. Pengujian otomatis sebelumnya sempat menemukan masalah pada navigasi mobile dan alur booking yang belum tampak pada pengujian manual. Perbaikan tersebut menjadi alasan pentingnya regresi dan pencatatan bukti sebelum release.

Tahap backend menambah tiga pelajaran lain:

- **Tes konkurensi menemukan bug yang tidak terlihat pada satu permintaan.** Saat enam konfirmasi dikirim bersamaan, nomor antrean tidak pernah ganda (indeks unik bekerja), tetapi sekitar separuh percobaan membuat satu permintaan sah gagal karena kalah berulang. Perbaikannya adalah mengunci baris barber selama pemberian nomor.
- **Menguji dengan menghancurkan.** Untuk memastikan sebuah tes bermakna, kode yang dilindunginya saya matikan sementara dan tes harus gagal. Cara ini juga mengoreksi penilaian saya sendiri: aturan satu tiket per pelanggan per hari ternyata sudah aman dari balapan berkat kunci baris pelanggan, dan indeks unik berfungsi sebagai pertahanan berlapis, bukan perbaikan atas bug.
- **Mock tidak membuktikan integrasi.** Tes browser dengan API palsu menulis header CORS sendiri, sehingga tidak akan menangkap header yang lupa diizinkan. Kecocokan CORS yang sebenarnya dibuktikan terpisah lewat tes preflight di backend dan server yang dijalankan sungguhan.

## Tahap lanjutan

Belum dikerjakan: deployment publik, notifikasi ke pelanggan, penguncian akun setelah banyak percobaan login, rate limiter bersama untuk banyak proses, dan kebijakan retensi data pribadi. Daftar batasan yang diketahui ada di [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
