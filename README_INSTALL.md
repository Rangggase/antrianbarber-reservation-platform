# Antrian Barber v2.1e — Frontend QA Starter

Paket ini **HANYA menambahkan file pengujian**. Tidak mengganti `src`, `public`, `App.tsx`, atau data booking. Dibuat berdasarkan struktur patch v2.1d yang telah dibagikan sebelumnya; bila kode lokal berubah, locator mungkin perlu disesuaikan.

## 1. Backup

Buka terminal PowerShell di PyCharm:

```powershell
cd "D:\new another projectA"
Copy-Item ".\frontend\src" ".\src_backup_before_v2_1e" -Recurse
```

> Backup ini menjaga source code. Jika sudah punya `playwright.config.ts`, buat salinannya secara terpisah sebelum menimpa file tersebut. Paket QA ini tidak menimpa `src`.

## 2. Salin file QA

Ekstrak ZIP dan salin **isi** folder `AntrianBarber_v2_1e_QA_Starter` ke `D:\new another projectA\frontend`. Akan ditambahkan:

- `playwright.config.ts`
- `e2e/routes.spec.ts`
- `e2e/booking.spec.ts`
- `e2e/responsive.spec.ts`
- `QA_PLAN_v2_1e.md`
- `UAT_REPORT_v2_1d.md`

Jangan menimpa konfigurasi Playwright yang sudah kamu kustomisasi; jika sudah ada `playwright.config.ts`, gabungkan secara manual.

## 3. Instal Playwright

```powershell
cd "D:\new another projectA\frontend"
npm install -D @playwright/test
npx playwright install chromium
```

Playwright akan menyalakan server Vite di port **4173** secara otomatis. `npm run dev` pada port 5173 boleh tetap aktif.

## 4. Jalankan QA

```powershell
npm run build
npx playwright test --project=chromium --workers=1
npx playwright show-report
```

Untuk memeriksa satu test yang gagal:

```powershell
npx playwright test e2e/booking.spec.ts --project=chromium --headed --workers=1
```

Jika port 4173 sedang dipakai proses lain, hentikan proses tersebut sebelum menjalankan tes.

## 5. Lanjut audit Lighthouse (manual)

Jalankan `npm run build` lalu `npm run preview -- --host 127.0.0.1 --port 4173`, kunjungi `http://127.0.0.1:4173/`. Di Chrome tekan F12 → Lighthouse → Navigation → Analyze page load. Simpan hasil laporan Performance, Accessibility, Best Practices, dan SEO untuk mobile dan desktop. Lakukan juga pada `/reservasi`.

**Penting:** audit Lighthouse tidak membuktikan semua masalah aksesibilitas sudah terdeteksi; lakukan juga keyboard navigation, form labels, fokus dialog, dan kontras secara manual.

## 6. Kirim hasil

Kirim output `npm run build`, ringkasan `npx playwright test --project=chromium --workers=1`, screenshot error jika ada, dan skor Lighthouse. Jangan mengirim tiket yang berisi data pribadi nyata.

## Tidak mengubah booking nyata

Data yang dibuat Playwright berada pada browser context pengujian terpisah. Kode sumber tetap demo lokal tanpa API atau database.
