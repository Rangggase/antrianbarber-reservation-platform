# Antrian Barber v2.1d — UAT Manual

**Tanggal laporan:** 7 November 2026  
**Lingkungan:** Browser lokal di mesin pengembang, React + Vite; bukan deployment publik.  
**Pelaksana:** Pemilik proyek (self-testing).  
**Scope:** Penerimaan fitur frontend demo; bukan audit keamanan maupun benchmark performa.

| Kode | Skenario | Hasil |
|---|---|---|
| TC01 | Navigasi multi-page | LULUS |
| TC02 | Profil barber | LULUS |
| TC03 | Galeri interaktif | LULUS |
| TC04 | Booking wizard | LULUS |
| TC05 | Validasi formulir | LULUS |
| TC06 | Pembuatan tiket | LULUS |
| TC07 | Penyimpanan reservasi | LULUS |
| TC08 | Pembatalan antrean | LULUS |
| TC09 | Booking dari katalog | LULUS |
| TC10 | Responsive design | LULUS |

**Ringkasan:** 10 lulus, 0 gagal dilaporkan. Hasil ini berdasarkan pengujian mandiri yang dilaporkan pemilik proyek. Belum diverifikasi ulang melalui automated E2E.

**Build:** `npm run build` berhasil; Vite v8.3.6, 2.158 modul, durasi 776 ms; JavaScript hasil build 308,95 kB (gzip 97,09 kB), CSS 38,12 kB (gzip 9,55 kB). Ukuran file ini bukan skor performa.

**Batasan:** Data reservasi pada localStorage browser; barber, jadwal, harga, dan tiket bersifat demo. Tidak ada sinkronisasi antar pengguna, autentikasi, API, atau database.
