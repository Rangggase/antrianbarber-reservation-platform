# Antrian Barber v2.1c — Full Multi-page Fix (React Router)

**Untuk:** proyek yang sudah bekerja pada `D:\new another projectA\frontend`.
**Jangan** hapus folder `AntrianBarber_Professional` v2.0.

## Mengapa patch ini berbeda?
Patch sebelumnya terdiri dari 2 ZIP dan bisa saja tersalin sebagian. Paket **v2.1c** menggabungkan kedua versi secara lengkap: seluruh `src`, `public`, serta `index.html`. Tidak perlu memasang patch v2.1 atau v2.1b lagi. Tampilan tetap sama, tetapi semua menu beralih ke alamat pathname, **tanpa `#`**.

## Instalasi dengan File Explorer (mudah)
1. Di PyCharm hentikan `npm run dev` dengan `Ctrl+C`.
2. Buat cadangan di luar folder `src`, contoh: salin `D:\new another projectA\frontend\src` ke `D:\new another projectA\src_backup_sebelum_v2_1c`.
3. Ekstrak ZIP `AntrianBarber_v2_1c_MultiPage_FullFix.zip`.
4. Masuk ke folder ekstraksi `AntrianBarber_v2_1c_MultiPage_FullFix`.
5. Di dalamnya ada `src`, `public`, `index.html` dan README ini. **Pilih dan salin isi tersebut** ke `D:\new another projectA\frontend` (jangan menaruh folder luar `AntrianBarber_v2_1c_MultiPage_FullFix` ke dalam frontend).
6. Windows: pilih gabungkan folder dan **replace/replace files in destination** untuk file nama sama.
7. Terminal PyCharm:

```powershell
cd "D:\new another projectA\frontend"
npm install react-router lucide-react
npm run build
npm run dev
```

8. Buka `http://localhost:5173/` dan tekan `Ctrl+Shift+R`.
9. Cek URL menu: **/layanan** (bukan **/#layanan**), **/inspirasi**, **/reservasi**, dll.

## Struktur yang wajib diperiksa di PyCharm
- `frontend/src/App.tsx` (mengandung `Routes` / `Outlet`)
- `frontend/src/main.tsx` (mengandung `BrowserRouter`)
- `frontend/src/pages/HomePage.tsx`, `ServicesPage.tsx`, `InspirationPage.tsx`, `AboutPage.tsx`, `FAQPage.tsx`, `BookingPage.tsx`
- `frontend/src/components/Header.tsx` (mengandung `NavLink` dan `to="/layanan"`, bukan `href="#layanan"`)
- `frontend/src/index.css` dan `frontend/src/styles/routes.css`

## Validasi
- Home: hero dan 2 pilihan cepat, bukan katalog dan form panjang sekaligus.
- /layanan: kartu katalog saja; pilih Fade & Taper => /reservasi?layanan=fade.
- /inspirasi: hanya galeri.
- /tentang: hanya penjelasan konsep.
- /faq: hanya FAQ.
- /reservasi: formulir, tiket dan riwayat demo.
- Refresh /reservasi: data demo yang sudah tersimpan di localStorage browser tetap ada.
- Back/Forward browser mengubah konten sesuai path.
- URL tak dikenal (misal /halaman-salah) menampilkan 404.

Catatan: halaman-halaman berbeda dalam satu React SPA; **belum** menjadi beberapa proyek HTML terpisah. Backend FastAPI, PostgreSQL, dan otentikasi admin belum aktif. BrowserRouter pada hosting produksi perlu fallback ke index.html.

## Jika masih menampilkan #layanan
1. Cari `src/App.tsx`. Bila masih `import Hero`, `import Services`, `import Booking` dan semua diletakkan di `<main>` tanpa `Routes`, berarti file lama belum terganti.
2. Pastikan `src/main.tsx` mengandung `<BrowserRouter>`.
3. Periksa `src/components/Header.tsx`: tautannya harus `to="/layanan"`.
4. Pastikan tidak salah menyalin ke `AntrianBarber_Professional` atau `frontend/AntrianBarber_v2_1c_MultiPage_FullFix/src`.
5. Hentikan proses Vite lama, jalankan lagi `npm run dev`, kemudian refresh paksa browser.
