# Antrian Barber v2.1b — Multi-page Patch

## Tujuan
Mengubah website v2.1 dari one-page (semua section di satu halaman) menjadi multi-route frontend. Topbar, warna, font, layanan, foto dan kode booking v2.1 tetap digunakan. Setiap menu berpindah ke path URL yang berbeda dengan React Router. **Belum ada backend / autentikasi admin.**

## Persyaratan
Sudah memiliki proyek `D:\new another projectA\frontend` berfungsi dari AntrianBarber v2.1 dan dependensi React, Tailwind, lucide-react.

## Instalasi di Windows / PyCharm
1. Terminal pada `D:\new another projectA\frontend`: hentikan `npm run dev` dengan `Ctrl+C`.
2. Backup folder `frontend/src` (gunakan nama contoh `src_backup_v2_1`, di luar `src`).
3. Ekstrak ZIP ini. Salin isi folder `AntrianBarber_v2_1b_MultiPage_Patch` ke `frontend`. Pilih **Merge/Replace** hanya jika diminta untuk file yang sama.
4. Di terminal `frontend`: `npm install react-router`.
5. `npm run build` (jika error, kirim screenshot + output lengkap).
6. `npm run dev`, buka `http://localhost:5173/`.

Folder `AntrianBarber_Professional` (v2.0) jangan diubah.

## Halaman dan URL
- `/` — Beranda (hero + link cepat)
- `/layanan` — katalog dan tombol pilih layanan
- `/inspirasi` — galeri
- `/tentang` — filosofi barbershop
- `/faq` — pertanyaan umum
- `/reservasi` — formulir, tiket, riwayat, pembatalan
- `/reservasi?layanan=fade` — contoh preselect layanan
- `/*` — halaman 404

## Catatan perilaku
- Tidak perlu `react-router-dom` terpisah: proyek ini menggunakan paket `react-router` versi modern (mode deklaratif).
- Kode `Booking.tsx`, `lib/bookings.ts`, `data/services.ts`, dan `index.css` asli **tidak ditimpa** oleh patch.
- Link `/#reservasi`, `/#layanan`, dll. diarahkan otomatis ke route baru.
- Reservasi tetap demo localStorage **bukan reservasi barbershop riil** dan tidak terhubung antarpengunjung.
- Dashboard admin dengan sidebar akan dikembangkan kemudian bersama autentikasi dan backend FastAPI/PostgreSQL; jangan anggap route frontend sebagai proteksi admin.
- Saat deployment ke hosting statis dengan BrowserRouter, set fallback semua route ke `/index.html` agar refresh `/reservasi` tidak menghasilkan 404.

## Checklist
- `npm run build` sukses.
- Klik keenam menu topbar: URL berubah dan halaman hanya menunjukkan konten menu terkait.
- `/layanan` klik layanan: masuk `/reservasi?layanan=<id>`, dropdown booking terpilih.
- Isi form dengan data **contoh** dan dapatkan tiket. Refresh `/reservasi`: tiket tetap ada.
- Batalkan dan hapus antrean lokal, cek hasilnya.
- Periksa mobile navbar dan navigasi Back/Forward browser.
- Buka URL invalid `/sesuatu`: terlihat halaman 404.
- Cek `/#reservasi` menuju `/reservasi`.

## Sesudah migrasi
Tahap berikutnya: rancang database PostgreSQL (users, barbers, services, bookings, work schedules, slots) dan API FastAPI (auth, availability, create/cancel bookings). Implementasi admin sidebar dilakukan setelah ada keamanan backend agar status dan data admin tidak sekadar simulasi frontend.
