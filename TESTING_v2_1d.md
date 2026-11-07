# Manual Acceptance Test — Antrian Barber v2.1d

**Alat:** PyCharm terminal, Chrome atau Edge, viewport desktop & mobile. Gunakan **data fiktif**, bukan nomor pelanggan sungguhan.

## Pengecekan teknis

- [ ] `npm run build` selesai tanpa TypeScript error.
- [ ] `npm run dev` menampilkan `http://localhost:5173/`.
- [ ] Navigasi Beranda, Layanan, Barber, Inspirasi, Tentang, FAQ, Reservasi memiliki path sendiri.
- [ ] Menu mobile terbuka, menutup saat link dipilih, tidak ada horizontal scroll.

## Booking wizard

- [ ] **TC01:** `/layanan` → pilih Fade → `/reservasi?layanan=fade` dengan layanan Fade sudah dipilih.
- [ ] **TC02:** `/barber` → pilih Raka → `/reservasi?barber=raka`, pada Step 2 barber Raka terpilih.
- [ ] **TC03:** Tidak memilih layanan dan klik Lanjutkan → muncul validasi.
- [ ] **TC04:** Pilih layanan → pilih barber → tanggal → jam → isi data demo → konfirmasi.
- [ ] **TC05:** Tidak memilih jam pada Step 2 → validasi muncul.
- [ ] **TC06:** Nama/nomor tidak valid pada Step 3 → validasi, tidak bisa lanjut.
- [ ] **TC07:** Checkbox persetujuan tidak dicentang → tidak bisa lanjut.
- [ ] **TC08:** Step 4 tampilkan layanan, harga, barber, tanggal, jam, nama, nomor, catatan.
- [ ] **TC09:** Klik Buat Tiket Demo → nomor tiket AB-xxx dan modal muncul.
- [ ] **TC10:** Salin tiket; klik Lihat Antreanku; riwayat mencakup barber.
- [ ] **TC11:** Reload browser; tiket demo masih terbaca.
- [ ] **TC12:** Nomor yang sama pada tanggal yang sama ditolak saat mencoba tiket kedua.
- [ ] **TC13:** Memilih jam sama untuk barber sama di browser yang sama ditolak/dinonaktifkan.
- [ ] **TC14:** Batalkan tiket lalu pastikan jumlah aktif berkurang; hapus data demo.
- [ ] **TC15:** Tombol Kembali mempertahankan jawaban yang sudah diisi.
- [ ] **TC16:** Tiket dari versi v2.1c tetap terbaca di Antreanku tanpa error meski tidak punya field `barber`.

## Inspirasi & UI

- [ ] **TC17:** Filter Semua / Classic / Fade / Textured mengubah kartu yang ditampilkan.
- [ ] **TC18:** Tombol Coba gaya ini menuju `/reservasi?layanan=...`.
- [ ] **TC19:** Foto gagal muat → ilustrasi cadangan muncul.
- [ ] **TC20:** Aksesibilitas dasar: tab keyboard pada menu/filter/wizard/dialog; Esc menutup dialog; tautan fokus terlihat.

## Catatan QA

Fitur ini masih frontend demo. Slot tidak sinkron antarperangkat, nomor antrean adalah nomor lokal, tidak ada login atau pembayaran. Pengujian Playwright/Lighthouse lebih menyeluruh direncanakan untuk v2.1e.
