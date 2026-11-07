# Antrian Barber v2.1e — QA Hotfix 01

## Tujuan
Dua kegagalan booking belum memiliki pesan validasi yang cukup di log; jangan mengubah aturan booking sebelum kita mengetahui penyebabnya. Patch ini **menambah diagnostik** pada tes booking tanpa melonggarkan assertions. Dua kegagalan mobile ditangani dengan CSS yang memperbaiki ruang header, prioritas klik tombol menu, dan pembatasan konten flex/grid pada viewport sempit. Bila overflow belum hilang, tes akan menyebutkan elemen yang melebar.

## Pemasangan di Windows / PyCharm

1. Hentikan `npm run dev` dengan Ctrl+C dan buat backup terbaru:

```powershell
cd "D:\new another projectA"
Copy-Item ".\frontend\src" ".\src_backup_before_qa_hotfix01" -Recurse
Copy-Item ".\frontend\e2e" ".\e2e_backup_before_qa_hotfix01" -Recurse
```

2. Ekstrak ZIP. Salin **folder `e2e`** dari patch ke `D:\new another projectA\frontend\e2e` (timpa `booking.spec.ts` dan `responsive.spec.ts` saja; jangan hapus `routes.spec.ts`). Salin `src/styles/qa-mobile-fix.css` ke `D:\new another projectA\frontend\src\styles\`.

3. Buka file `D:\new another projectA\frontend\src\App.tsx`. Tepat setelah baris `import './styles/premium-v21d.css';`, tambahkan:

```ts
import './styles/qa-mobile-fix.css';
```

**Penting:** Jangan mengganti seluruh `App.tsx`. Cukup tambahkan satu baris impor CSS. Jangan menghapus atau memodifikasi `src/components/Booking.tsx`.

4. Jalankan:

```powershell
cd "D:\new another projectA\frontend"
npm run build
npx playwright test --project=chromium --workers=1
```

5. Jika masih ada pengujian gagal, kirim bagian pesan `Diagnostik booking` atau `Elemen tersangka` dari output terminal. Kamu juga dapat membuka `npx playwright show-report` dan klik `View Trace` pada pengujian yang gagal.

## Kriteria penerimaan
- Tes booking: idealnya 5/5 lulus. Jika tidak, pesan diagnostik menjelaskan field error aktual; perlu perbaikan logika aplikasi setelah penyebab diketahui.
- Mobile navigation: menu bisa diklik tanpa `force: true` dan menavigasi ke `/barber`.
- Mobile width: `document.scrollWidth <= document.clientWidth + 1` untuk halaman yang diuji.
- Semua 19 tes harus lulus sebelum v2.1e dinyatakan selesai.

Paket ini belum menjalani pengujian browser end-to-end independen di lingkungan pembuatnya. Backup disarankan.
