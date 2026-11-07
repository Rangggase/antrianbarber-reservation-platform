# Antrian Barber v2.1e — QA Hotfix 02 (Booking Wizard)

## Temuan

Pada QA Hotfix 01, 17/19 tes lulus, termasuk kedua tes mobile. Dua tes booking mencatat `currentStep: 01Layanan` dan `activeTicketCount: 1` saat pengujian mengharapkan layar konfirmasi.

Di kode frontend v2.1d, setelah sukses menerbitkan tiket, wizard sengaja kembali ke langkah 1. Ini **mengindikasikan** tiket sudah dibuat sebelum pemeriksaan konfirmasi, tetapi sumber pemicu submit belum sepenuhnya terbukti tanpa trace browser.

## Perubahan dalam patch

- `src/components/Booking.tsx`: tombol final **Buat Tiket Demo** sekarang `type="button"` dan memanggil `submit()` hanya melalui klik tombol itu. Form menangkal submit bawaan yang tidak disengaja; aturan validasi dan format tiket tetap sama.
- `e2e/booking.spec.ts`: membersihkan `localStorage` **sekali** sebelum setiap tes booking, lalu reload, dan memeriksa belum ada tiket sebelum menampilkan layar konfirmasi. Reset ini TIDAK dilakukan pada reload berikutnya, sehingga tes persistensi tetap valid.
- `e2e/booking.spec.ts`: diagnostik menambahkan informasi apakah dialog tiket terlihat dan URL. Tidak ada assertion yang dilonggarkan.

**Perubahan ini bersifat pencegahan, bukan bukti bahwa akar kegagalan sebelumnya sudah pasti ditemukan.** Hasil uji ulang perlu dievaluasi.

## Pemasangan (PowerShell / PyCharm)

1. Stop server Vite `Ctrl+C`.
2. Backup **dua file** yang akan diganti:

```powershell
cd "D:\new another projectA\frontend"
Copy-Item ".\src\components\Booking.tsx" ".\src\components\Booking.backup-before-hotfix02.tsx.txt"
Copy-Item ".\e2e\booking.spec.ts" ".\e2e\booking.backup-before-hotfix02.spec.ts.txt"
```

3. Ekstrak ZIP. Salin dari folder hasil ekstraksi:

- `src/components/Booking.tsx` ke `D:\new another projectA\frontend\src\components\Booking.tsx`
- `e2e/booking.spec.ts` ke `D:\new another projectA\frontend\e2e\booking.spec.ts`

4. Jangan mengganti file lain, termasuk CSS mobile Hotfix 01. Tetap gunakan `qa-mobile-fix.css`.
5. Jalankan:

```powershell
cd "D:\new another projectA\frontend"
npm run build
npx playwright test e2e/booking.spec.ts --project=chromium --workers=1
npx playwright test --project=chromium --workers=1
```

## Kriteria hasil

- Target booking: 5/5 lulus; keseluruhan: 19/19 lulus.
- Jika masih gagal, **jangan** mengubah laporan menjadi lulus. Kirim error teks dan trace ZIP dari `test-results` yang gagal, agar dapat dibedakan apakah ada bug kode frontend atau mismatch langkah otomatisasi.

## Privasi

Tes memakai data sintetis. Jangan memasukkan nomor pelanggan asli. Backup dan file `.env` tidak boleh di-commit jika berisi data pribadi/rahasia.
