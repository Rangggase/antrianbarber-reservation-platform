# Sistem Desain — Antrian Barber (Sprint 5)

**Status: DISETUJUI (arah A "Karcis" dan semua rekomendasi §10). Implementasi berjalan per langkah §8: 5a selesai, 5b-5e belum dimulai.**
Dokumen ini adalah sumber kebenaran tunggal untuk perombakan UI/UX. Setiap langkah implementasi mengacu ke sini. Bukti audit ada di [`audit/before/`](audit/before/) (10 tangkapan layar + `metrics.json`), dan papan pratinjau visual ada di [`preview.html`](preview.html).

Cakupan: halaman **Booking pelanggan** dan **area staf** (login, antrean, laporan, jadwal), ditambah *shell* bersama (header/footer). Backend tidak berubah.

---

## 1. Audit kondisi sekarang

Metode: graf codebase (codebase-memory), pembacaan kode, pengukuran CSS, perhitungan kontras dari nilai warna nyata, dan tangkapan layar Chromium pada 1440×900 dan 390×844 (pelanggan dalam mode demo, staf dalam mode API dengan data mock). 14 layar diukur.

### 1.1 Temuan terukur

| # | Temuan | Bukti | Dampak |
|---|---|---|---|
| A1 | **Tidak ada sistem token.** Nol custom property, tidak ada `@theme`, ±262 nilai hex unik tersebar di 9 berkas CSS (dua di antaranya "patch" `premium-v21d.css` dan `qa-mobile-fix.css`). `tailwindcss` diimpor tetapi nyaris tak dipakai (4 utilitas arbitrer). | `grep` pada `src/**/*.css` | Area pelanggan dan staf punya gaya terpisah yang mudah menyimpang |
| A2 | **Angka tampil salah baca.** Georgia memakai angka *old-style*: "0 tiket" tampil seperti huruf **O**, kode "AB-001" tampil **AB-oo1**, jam "09:00" tampil **o9:oo**. | Tangkapan `desktop-booking-ticket`, `desktop-staff-dashboard` | Nomor antrean dan jam adalah data terpenting produk ini |
| A3 | **9 dari 16 pasangan warna nyata gagal WCAG AA** (label 10px `#a47546` di krem 3,73:1; disclaimer 11px 2,98:1; caption staf 3,64:1; batas input 1,64:1 dan slot 1,29:1 dari minimum 3:1). | Perhitungan rasio dari nilai CSS | Teks kecil sulit dibaca; kontrol hampir tak terlihat batasnya |
| A4 | **Teks terlalu kecil.** 45 deklarasi `font-size` di bawah 12px. Pada layar booking 25–27 elemen teks <12px; dasbor staf 20; laporan 16. | `metrics.json` | Keterbacaan, terutama di ponsel |
| A5 | **Target sentuh kecil.** Dasbor staf: 16 dari 23 kontrol <44px; halaman jadwal: **31 dari 39**; booking di ponsel: 9 dari 18. | `metrics.json` (390px) | Salah tekan di ponsel, padahal barber memakainya sambil bekerja |
| A6 | **Halaman Booking tidak punya `<h1>`** (hanya `<h2>`). | `metrics.json`: `h1: 0` | Struktur judul rusak untuk pembaca layar |
| A7 | **Bahasa bercampur.** Judul dan label berbahasa Inggris di tengah isi berbahasa Indonesia: "Your seat. Your moment.", "STEP 02 / YOUR PREFERRED TIME", "You're on the list.", "DEMO BOOKING CREATED". | Tangkapan layar; 12 string unik di `Booking.tsx` | Terasa seperti templat, bukan produk untuk pelanggan Indonesia |
| A8 | **Istilah teknis dan galat mentah bocor ke pelanggan.** "FastAPI lokal", "PostgreSQL", dan "Layanan gagal dimuat: **Failed to fetch**". | Tangkapan layar `booking-step1` (mode API tanpa server) | Pelanggan tidak paham; terkesan rusak |
| A9 | **Sidebar tidak melayani tugas pengguna.** Kartu hitam berisi "0 tiket demo" dan dua kartu catatan memakan 1/4 lebar layar, bersaing dengan formulir. Banner "Demo portofolio…" penuh lebar berada tepat di atas formulir. | `desktop-booking-step1/2/3` | Fokus pengguna terpecah |
| A10 | **Pemilih jam datar.** 20+ tombol berukuran sama dalam grid 5 kolom tanpa pengelompokan (pagi/siang/sore), tanpa kondisi "penuh". Pemilih tanggal memakai `<input type="date">` bawaan. | `desktop-booking-step2` | Sulit dipindai; langkah paling penting dalam booking |
| A11 | **Galat formulir 10–11px, tanpa ringkasan galat.** | `desktop-booking-step3-errors` | Pengguna bisa melewatkan galat |
| A12 | **Komponen `Booking` satu fungsi 250 baris** (`Booking.tsx` baris 60–310) yang menggabungkan mode demo dan mode API. | Graf codebase | Perubahan visual berisiko; sulit diuji |
| A13 | **Navigasi staf memakan layar ponsel.** Tiga tombol besar + tanggal + barber + muat ulang menghabiskan ±450px sebelum reservasi pertama tampak. | `mobile-staff-dashboard` | Barber harus menggulir dulu sebelum melihat siapa berikutnya |
| A14 | **Kerja barber tidak dioptimalkan.** Daftar kronologis datar; tak ada tempat yang menjawab "siapa yang sedang dilayani dan siapa berikutnya". | `desktop-staff-dashboard` | Tugas utama di kursi barber butuh banyak pemindaian |

Tidak ada *horizontal overflow* pada ke-14 layar (kondisi baik), dan cincin fokus 3px sudah ada di kontrol wizard (baik; dipertahankan).

### 1.2 Pola "templat generik" yang ditemukan di kondisi sekarang

Diperiksa terhadap daftar tanda-tanda desain buatan AI (skill `frontend-design`):

| Pola | Ada di sini |
|---|---|
| Krem hangat + serif tinggi-kontras + aksen hangat | **Ya**: `#f8f6f1`, Georgia, perunggu `#a47546` |
| Hijau tua + emas "barbershop mewah" | **Ya**: `#10251e`/`#17372c` + `#e8ba79` |
| Satu kata dalam judul diberi italik/warna aksen | **Ya**: "*Your moment.*", "*Better days.*", "*here.*" |
| Label kapital ber-*tracking* di atas setiap judul | **Ya**: 14 `eyebrow`, 31 deklarasi `uppercase`/`letter-spacing` |
| Penanda bernomor "01 / 02 / 03" tanpa urutan nyata | Sebagian: pada langkah wizard urutannya nyata (dipertahankan); "01 / THE CRAFT" di beranda tidak |
| Pita *marquee* berisi slogan umum, lencana "EST. AB STUDIO" fiktif | **Ya** (beranda) |
| Meta bertitik tengah "A · B · C" dan panah "→/↗" di setiap tombol | **Ya** |

---

## 2. Konsep: **Karcis** (nomor antrean)

**Subjek.** Inti produk ini adalah *antrean*: orang mengambil nomor, menunggu giliran, lalu dipanggil. Dunia fisiknya: karcis nomor antrean dari mesin, papan antrean, tiang barber, ubin putih, kaca. Itu sumber bahasa visualnya, bukan emas dan marmer.

**Elemen yang diingat (satu saja): karcis.** Selembar karcis kertas berperforasi dengan angka tabular besar. Ia muncul sebagai:
1. ringkasan langsung saat memesan (terisi seiring pilihan pelanggan, menggantikan sidebar dan langkah "Konfirmasi"),
2. bukti pemesanan dan kartu "Antreanku",
3. cermin di sisi staf: nomor yang sama menjadi kolom pertama di papan antrean.

Semua yang lain sengaja tenang: permukaan datar, batas tipis, satu keluarga huruf, satu warna aksi.

**Kepribadian:** tenang, presisi, hangat tanpa berlebihan. "Elegan" dicapai lewat disiplin (ruang, ritme, tipografi), bukan ornamen.

**Mengapa bukan hijau-emas lagi:** itu paket "barbershop mewah" yang paling lazim, dan kondisi sekarang sudah memakainya (lihat §1.2). Lihat §9 untuk alternatif yang mempertahankannya.

---

## 3. Token

Semua token didefinisikan **sekali** di `src/styles/tokens.css` memakai `@theme` Tailwind v4 (proyek sudah mengimpor Tailwind) lalu dipakai lewat variabel CSS. Tidak ada nilai hex mentah di komponen.

> Panduan dataset `ui-ux-pro-max` yang **terverifikasi cocok** dan dipakai: token semantik di `@theme`; status tidak boleh hanya lewat warna (ikon + teks); tabel jadi kartu di ponsel; grafik batang disertai tabel pengganti.
> Yang **tidak** dipakai karena tidak cocok: paket warna/tipografi hasil `--design-system` (biru langit `#0284C7` + hijau `#059669` + DM Sans = paket SaaS generik; pasangan "luxury" Playfair/Cormorant/Cinzel = klise yang sudah ada di sini); pencarian warna untuk "barbershop" tidak menemukan kecocokan. **Palet, tipografi, dan konsep di bawah adalah keputusan desain, bukan keluaran dataset.**

### 3.1 Warna

Semua rasio dihitung dari nilai di bawah (WCAG 2.x; 23 pasangan diuji, 0 gagal).

| Token | Nama | Hex | Peran |
|---|---|---|---|
| `--color-surface-page` | Kapur | `#F1F3F2` | Latar halaman (putih-ubin yang dingin, bukan krem) |
| `--color-surface` | Putih | `#FFFFFF` | Kartu, panel, input |
| `--color-ink` | Tinta | `#0F1B2D` | Teks utama; permukaan gelap (rail staf, footer) |
| `--color-ink-2` | Tinta 2 | `#3A475B` | Teks sekunder |
| `--color-ink-muted` | Redam | `#566174` | Caption, bantuan (≥13px) |
| `--color-line` | Garis | `#D5DAD8` | Pemisah dekoratif |
| `--color-control` | Kontrol | `#7C8797` | Batas input/slot/kotak centang (non-teks, ≥3:1) |
| `--color-action` | Biru Pole | `#1D4FC4` | **Satu-satunya** warna aksi utama, tautan, cincin fokus |
| `--color-action-hover` | Biru Pole 2 | `#163C9C` | Hover/tekan |
| `--color-ticket` | Karcis | `#F4E3A1` | Kertas karcis; di atas permukaan Tinta: angka antrean dan **aksi utama terbalik** (lihat aturan di bawah) |
| `--color-danger` / `-bg` | Merah Tiang | `#B3261E` / `#FBE9E7` | Galat dan aksi merusak (**tidak** dipakai sebagai dekorasi) |
| `--color-success` / `-bg` | Hijau | `#1B6E45` / `#E1F1E8` | Terkonfirmasi |
| `--color-progress` / `-bg` | Tosca | `#0B6F7A` / `#DAF0F2` | Sedang dilayani |
| `--color-warn` / `-bg` | Amber | `#6B4E00` / `#FBEFC5` | Menunggu konfirmasi |
| `--color-neutral` / `-bg` | Abu | `#3F4B5C` / `#E4E8E7` | Selesai |

| Pasangan (teks / latar) | Rasio | Syarat | |
|---|---|---|---|
| Tinta / Kapur | 15,51 | 4,5 | ok |
| Tinta 2 / Kapur | 8,44 | 4,5 | ok |
| Redam / Kapur (caption 13px) | 5,61 | 4,5 | ok |
| Putih / Biru Pole (tombol) | 7,08 | 4,5 | ok |
| Biru Pole / Kapur (tautan) | 6,35 | 4,5 | ok |
| Tinta / Karcis | 13,46 | 4,5 | ok |
| Teks terang `#E8EDF3` / Tinta (rail, footer) | 14,68 | 4,5 | ok |
| Merah / Putih | 6,54 | 4,5 | ok |
| Badge terendah: Tosca / Tosca-bg | 4,97 | 4,5 | ok |
| Batas kontrol / Putih · / Kapur (non-teks) | 3,64 · 3,27 | 3,0 | ok |

Aturan pemakaian:
- **Satu aksi utama per permukaan.** Di permukaan terang: isian Biru Pole. Di permukaan Tinta (panel "Sekarang", rail): isian **Karcis** dengan teks Tinta (13,46:1). Alasannya terukur: isian Biru Pole di atas Tinta hanya **2,44:1** untuk batas non-teks (butuh 3:1).
- Merah hanya untuk bahaya.
- Status selalu **ikon + teks + warna** (tidak pernah warna saja).

### 3.2 Tipografi

Satu keluarga: **Archivo** (variabel; sumbu bobot dan lebar). Alasan: abjad grotesk bersejarah (akar signage Amerika) yang tegas tetapi tenang; sumbu lebar memberi angka karcis yang *condensed* tanpa memuat font kedua; bukan keluarga default yang sering muncul di keluaran AI. Dimuat *self-host* lewat paket `@fontsource-variable/archivo` (tanpa permintaan ke Google saat pengguna membuka situs; lihat Keputusan 3). Fallback: `"Segoe UI Variable Text", system-ui, sans-serif`.

> **Terverifikasi di 5a** (paket `@fontsource-variable/archivo` 5.3.0, lisensi OFL, entri `wdth.css`; diukur di Chromium, bukan dari deklarasi CSS):
> - **`tnum` ada.** Dengan `tabular-nums`, `1111` dan `0000` sama lebar persis (109,06 vs 109,06 pada 48px/400; 95,69 vs 95,69 pada 40px/700).
> - **Efeknya bergantung bobot.** Angka bawaan Archivo proporsional pada bobot 400 (`1111` 83,38 vs `0000` 91,69 pada 40px), tetapi pada bobot 700 hampir sama (95,38 vs 95,20) karena angka `1` melebar mengikuti bobot. Jadi `tabular-nums` paling berpengaruh pada bobot reguler/medium (jam di daftar, harga); tetap dipasang di semua angka.
> - **Angka lining.** Tinggi `0` (140) ≈ huruf `H` (138), bukan tinggi-x (106). Font tidak punya angka *old-style* (`onum` tidak mengubah apa pun), jadi masalah "0 tampak seperti O" hilang.
> - **Sumbu lebar `wdth` bekerja:** lebar teks 210 → 309 → 392 untuk 62% → 100% → 125%. Karcis memakai `font-stretch: 75%`.
> - **Glyph `№` (U+2116) tidak ada** (jatuh ke font cadangan). Seluruh dokumen dan pratinjau kini memakai teks "No.".
> - Berkas yang diunduh pengguna hanya subset yang dipakai (`unicode-range`); latin = 88 KB. Pada build produksi 5a **tidak ada** berkas font maupun CSS komponen yang terbundel (hanya variabel token), karena belum ada halaman yang mengimpor `src/ui`.

| Peran | Ukuran / baris | Bobot · lebar | Pemakaian |
|---|---|---|---|
| Karcis-besar | `clamp(56px, 9vw, 96px)` / 0,95 | 800 · condensed | Nomor antrean dan jam pada karcis |
| Judul halaman (h1) | 36 / 1,1 (mobile 28) | 700 · normal, tracking −0,02em | Satu `<h1>` per halaman |
| Judul bagian (h2) | 24 / 1,2 | 650 | |
| Judul kartu (h3) | 18 / 1,3 | 600 | |
| Isi | 16 / 1,55 | 400 | Panjang baris ≤ 66 karakter |
| Label | 14 / 1,4 | 600 | Label kolom/isian; **kalimat biasa, bukan kapital** |
| Caption | 13 / 1,45 | 450 | Minimum mutlak; tidak ada teks <13px |

Aturan: semua angka (jam, harga, nomor, hitungan) memakai `font-variant-numeric: tabular-nums lining-nums`. Tidak ada label kapital ber-*tracking*. Tidak ada aksen satu-kata dalam judul. Harga: `Rp 75.000` dengan `Intl.NumberFormat('id-ID')`.

### 3.3 Spasi, bentuk, elevasi

| Token | Nilai |
|---|---|
| Skala spasi (kelipatan 4) | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 |
| Lebar konten | maks 1120px; kolom formulir ≤ 640px |
| Breakpoint (satu set, menggantikan 6 nilai berbeda: 490/640/680/760/1050/1060) | 640 · 960 (rail staf muncul) · 1200 (booking dua kolom). **Penyimpangan 5a:** penimpaan `--breakpoint-*` Tailwind **ditunda ke 5b**, sebab komponen lama memakai `lg:hidden`/`lg:flex`/`lg:inline-flex` pada 1024px (diperiksa dengan `grep`); mengubahnya sekarang menggeser titik patah navigasi lama. Sementara itu `ui.css` memakai literal yang sama. |
| Radius | permukaan 4px · kontrol 8px · karcis 6px dengan takik setengah lingkaran 10px · lencana status 4px. **Bukan satu radius untuk semuanya.** |
| Elevasi | Datar: pemisahan lewat batas 1px dan beda latar. Satu pengecualian: karcis diberi bayangan kertas tipis. Modal memakai *scrim*. Tanpa bayangan lembut seragam di setiap kartu. |
| Z-index | 0 dasar · 10 header sticky · 20 bilah bawah ponsel · 40 menu · 50 modal · 60 toast |

### 3.4 Gerak

Hanya tiga momen, semuanya menjawab tindakan pengguna:

| Momen | Gerak | Durasi |
|---|---|---|
| Karcis **tercetak** saat pemesanan berhasil (satu-satunya momen "pertunjukan") | Meluncur turun dari celah, `transform`/`opacity` | 480ms, `cubic-bezier(.2,.8,.2,1)` |
| Pergantian langkah wizard | *Crossfade* isi | 160ms |
| Tekan tombol/slot | Perubahan latar, tanpa menggeser tata letak | 80ms |

Tanpa animasi muncul-saat-gulir, tanpa *hover lift* di setiap kartu. Semua dimatikan/disederhanakan di `prefers-reduced-motion`. Keluar lebih cepat daripada masuk (≈ 70%). Tidak ada animasi `width/height/top/left`.

### 3.5 Ikon

Tetap **lucide-react** (sudah dipakai; satu keluarga), goresan 1,75, ukuran 16/20/24. Dekoratif di samping teks: `aria-hidden`. Tombol hanya-ikon wajib punya nama aksesibel. Status: Menunggu `Clock`, Terkonfirmasi `BadgeCheck`, Dilayani `Scissors`, Selesai `Check`, Dibatalkan `X`, Tidak hadir `UserX`. Tidak ada emoji.

---

## 4. Komponen

Disusun di `src/ui/` (baru), menggantikan kelas CSS ad-hoc. Setiap komponen punya keadaan: normal, hover, fokus, tekan, nonaktif, galat, memuat.

| Komponen | Spesifikasi kunci |
|---|---|
| **Button** | Varian `primary` (biru, satu per layar), `secondary` (garis tinta), `quiet` (teks), `danger` (garis merah). Tinggi ≥44px (ponsel) / 40px (desktop dengan pointer halus). Tanpa panah "→/↗" otomatis. Memuat: tombol nonaktif + teks berubah ("Mengirim…"). |
| **Field** | Label terlihat di atas; bantuan di bawah (13px); galat di bawah isian, `aria-describedby`, ikon + teks. Batas `--color-control`. Tinggi 48px. `inputmode`/`autocomplete` sesuai (`tel`, `name`). |
| **FormErrorSummary** | Setelah kirim gagal dengan >1 galat: ringkasan terfokus di atas dengan tautan ke tiap isian; galat inline tetap ada. |
| **Notice** | Satu komponen untuk info/sukses/peringatan/galat: ikon + judul pendek + tindakan pemulihan. Galat selalu menyebut penyebab dan langkah berikutnya. |
| **StatusBadge** | Ikon + teks + warna (tabel §3.1). Radius 4px. Tidak pernah warna saja. |
| **Ticket** | Lihat §4.1. |
| **DayStrip** | Baris hari (7 hari, bisa digeser): "Hari ini / Besok / Rab 18". Target ≥48×56. Tautan "Tanggal lain" membuka `<input type=date>` bawaan sebagai jalur cadangan. |
| **SlotPicker** | Dikelompokkan *Pagi / Siang / Sore*; tombol ≥44px; slot penuh tampil nonaktif dengan teks "Penuh" (bukan hanya pudar); pintasan "Terdekat: 14.30". `role=radiogroup`, panah kiri/kanan. |
| **BarberChoice** | Daftar `radio` bergaya baris: nama, spesialisasi, "Slot terdekat 14.30". Tanpa lingkaran inisial. Opsi "Siapa saja" hanya pada mode demo. |
| **ServiceChoice** | Baris/kartu `radio`: nama, durasi, harga (tabular). |
| **StaffRail** (≥960px) / **StaffTabBar** (<960px) | Rail kiri 232px (Antrean, Laporan, Jadwal; profil dan Keluar di dasar). Ponsel: bilah tab bawah berlabel + ikon (≤5 item). Menggantikan tiga tombol di kepala halaman. |
| **NowPanel** | "Sekarang" per barber: yang sedang dilayani (nomor besar, nama, satu aksi "Selesai") atau yang berikutnya (aksi "Mulai layanan"). Diturunkan dari data antrean yang sudah ada. |
| **QueueRow** | Jam (tabular) · nomor · nama + telepon tautan `tel:` · layanan · StatusBadge · aksi. Di ponsel menjadi kartu bertumpuk. Aksi merusak memakai konfirmasi; target ≥44px. |
| **Kpi + BarChart** | Angka besar (tabular) dengan label 13px. Grafik jam tersibuk: kolom 08–21, **label nilai langsung**, tabel data pengganti dalam `<details>`, satu warna (tanpa gradien). Tidak mengandalkan warna saja. |
| **WeekGrid** | Jadwal: baris per hari, rentang jam sebagai isian waktu 44px; tambah/hapus rentang; "Libur" eksplisit. |

### 4.1 Anatomi karcis

```
        ┌─────────────────────────────┐
        │  Antrian Barber       Sen 16 │   ← header: merek + tanggal (tabular)
        │                              │
        │  Fade & Taper                │   ← layanan (h3)
        │  Raka Pratama                │
        │                              │
   ◖┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈◗   ← perforasi (takik kiri-kanan)
        │                              │
        │   14.30            Rp 75.000 │   ← jam: karcis-besar; harga tabular
        │   Nomor antre  —             │   ← terisi saat barber mengonfirmasi
        │   AB-20261116-3F9A2C         │   ← kode (tidak ambigu: angka lining)
        └─────────────────────────────┘
```

Fakta produk yang membentuk desain: **nomor antrean baru diberikan saat barber mengonfirmasi**, bukan saat memesan. Karena itu sebelum dikonfirmasi angka besar adalah **jam**, dan "Nomor antre" tampil "—" dengan keterangan "Diberikan saat barber mengonfirmasi"; setelah dikonfirmasi angka besar berganti nomor antrean. Status ditampilkan sebagai StatusBadge, bukan warna kertas.

---

## 5. Tata letak (wireframe)

### 5.1 Booking pelanggan, desktop (≥1200px)

```
┌───────────────────────────────────────────────────────────────────────┐
│ Antrian Barber                    Layanan  Barber  Tentang   [Pesan]  │ 64px
├───────────────────────────────────────────────────────────────────────┤
│ Demo portofolio · gunakan data fiktif                                 │ 36px, 13px, tipis
├──────────────────────────────────────────┬────────────────────────────┤
│ Pesan karcis antrean                (h1) │  ╭ karcis (sticky) ───────╮ │
│                                          │  │ Fade & Taper            │ │
│ ① Layanan  ─  ② Waktu  ─  ③ Data diri    │  │ Raka · Sen 16 Nov       │ │
│                                          │  │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │ │
│ Pilih layanan                            │  │ 14.30        Rp 75.000  │ │
│ ( ) Classic Haircut  45 mnt   Rp 55.000  │  │ Nomor antre: —          │ │
│ (•) Fade & Taper     60 mnt   Rp 75.000  │  ╰─────────────────────────╯ │
│ ( ) Beard Trim       30 mnt   Rp 35.000  │                              │
│                                          │  Perubahan pilihan langsung  │
│ Pilih barber                             │  tampil di karcis.           │
│ (•) Raka Pratama   Fade · terdekat 14.30 │                              │
│ ( ) Dimas Putra    Classic · terdekat 10.00                              │
│                                          │                              │
│                          [Kembali] [Lanjut]                             │
└──────────────────────────────────────────┴────────────────────────────┘
```

Rata kiri. Formulir ≤640px, karcis 360px. Satu CTA utama ("Lanjut" → "Ambil karcis" pada langkah terakhir).

### 5.2 Booking pelanggan, ponsel (390px)

```
┌─────────────────────────┐
│ Antrian Barber       ☰  │
│ Demo · data fiktif      │
│ Pesan karcis antrean    │
│ Waktu · langkah 2 dari 3│
│                         │
│ ‹  Hari ini  Besok  Rab ›│  ← DayStrip
│ Pagi                    │
│ [09.00][09.30][10.00]   │
│ Siang                   │
│ [12.00][12.30][Penuh]   │
│ Sore                    │
│ [15.00][15.30][16.00]   │
│                         │
├─────────────────────────┤  ← bilah bawah (sticky, z 20)
│ Fade · Raka · 14.30     │
│ Rp 75.000   [  Lanjut ] │
└─────────────────────────┘
```

Karcis penuh tampil sebagai lembar yang bisa dibuka dari bilah bawah dan pada langkah terakhir.

### 5.3 Dasbor staf, desktop (≥960px)

```
┌─────────┬──────────────────────────────────────────────────────────┐
│ Antrian │ Antrean hari ini                [Sen 16 Nov ▾] [Barber ▾]│
│ Barber  │                                                          │
│         │ Sekarang                                                 │
│ ▣ Antrean│ ┌──────────────────────────┬─────────────────────────┐  │
│ ▤ Laporan│ │ Raka    No. 07  Sari W.    │ Dimas   —               │  │
│ ▦ Jadwal │ │ Fade · mulai 09.30       │ Tidak ada yang dilayani │  │
│         │ │            [ Selesai ]   │ Berikutnya No. 08 [Mulai] │  │
│         │ └──────────────────────────┴─────────────────────────┘  │
│ ─────── │                                                          │
│ Admin   │ [Perlu dikonfirmasi 2] [Antrean 3] [Dilayani 1] [Selesai]│ ← tab dengan hitungan
│ Keluar  │ 10.30  No. 02  Andi P.   Fade · Raka   ⏱ Terkonfirmasi [⋯]│
│         │ 11.00   —    Rina M.   Fade · Dimas  ⏲ Menunggu [Konfirmasi]│
└─────────┴──────────────────────────────────────────────────────────┘
```

Tab "Perlu dikonfirmasi" adalah pekerjaan utama admin; panel "Sekarang" adalah pekerjaan utama barber. Barber hanya melihat barber miliknya (aturan backend yang ada).

### 5.4 Dasbor staf, ponsel

```
┌─────────────────────────┐
│ Antrian Barber   Admin ▾│
│ Sen 16 Nov  [Semua ▾]   │
│ ╭ Sekarang ───────────╮ │
│ │ Raka  No. 07 Sari W.  │ │
│ │ Fade · 09.30        │ │
│ │ [      Selesai     ]│ │
│ ╰─────────────────────╯ │
│ [Perlu konfirmasi 2][..]│  ← tab bisa digeser
│ 10.30 No. 02 Andi P.      │
│ Fade · Raka             │
│ ⏱ Terkonfirmasi         │
│ [Mulai layanan] [ ⋯ ]   │
├─────────────────────────┤
│ ▣ Antrean ▤ Laporan ▦ Jadwal │  ← bilah tab bawah (z 20)
└─────────────────────────┘
```

Kontrol yang sekarang memakan ±450px (tiga tombol + tanggal + barber + muat ulang) pindah ke bilah tab dan satu baris filter.

### 5.5 Laporan dan jadwal

- **Laporan:** baris KPI (Pendapatan, Selesai, Tidak hadir %, Total) angka tabular besar; tabel per barber/per layanan dengan kepala kolom yang bisa diurutkan (`aria-sort`); grafik jam tersibuk 08–21 dengan label nilai langsung + tabel pengganti. Di ponsel tabel menjadi kartu.
- **Jadwal:** `WeekGrid` satu kolom di ponsel; isian waktu 44px; cuti sebagai daftar dengan tombol hapus berlabel jelas.

---

## 6. Tulisan (microcopy)

Semua teks pelanggan berbahasa Indonesia. Kalimat biasa (bukan kapital). Kata kerja sama sepanjang alur. Tidak ada istilah teknis.

| Sekarang | Menjadi |
|---|---|
| "Your seat. Your moment." / "Good hair. Better days." | "Pesan karcis, datang tepat waktu." (judul halaman); beranda ditulis ulang menyebut layanan nyata |
| "STEP 02 / YOUR PREFERRED TIME" | Judul langkah: "Pilih waktu" |
| "DEMO BOOKING CREATED" / "You're on the list." | "Karcis Anda sudah terbit" |
| "Layanan FastAPI lokal · Tiket akan disimpan di PostgreSQL." | (dihapus dari tampilan pelanggan; keterangan teknis hanya untuk pengembang) |
| "Layanan gagal dimuat: Failed to fetch" | "Daftar layanan belum bisa dimuat. Periksa koneksi, lalu coba lagi." + tombol "Coba lagi" |
| "Buat Tiket PostgreSQL" / "Buat Tiket Demo" | "Ambil karcis" (satu nama untuk satu aksi, juga di toast) |
| "Batalkan di API" / "Lupakan lokal" | "Batalkan reservasi" / "Hapus dari perangkat ini" (dengan penjelasan satu kalimat) |
| Galat: "Nomor HP tidak valid" | "Nomor HP belum lengkap. Contoh: 0812 3456 7890" |
| Kosong: "Belum ada tiket demo aktif." | "Belum ada reservasi. Pilih layanan untuk mulai." + tindakan |

Catatan jujur tentang mode demo: pengungkapan "demo portofolio, data fiktif" **tetap ada** (permintaan etis proyek), tetapi sebagai strip tipis 36px dan baris di dasar karcis, bukan banner penuh di atas formulir.

---

## 7. Aksesibilitas dan kualitas (kriteria terukur)

Tiap butir diperiksa otomatis atau dengan skrip pengukuran yang sama dengan audit ini, lalu dibandingkan dengan `audit/before/metrics.json`.

| Kriteria | Target | Sekarang |
|---|---|---|
| Kontras teks | ≥4,5:1 semua pasangan; non-teks ≥3:1 | 9 dari 16 gagal |
| Ukuran teks minimum | ≥13px; 0 elemen teks <13px | 16–27 elemen <12px per layar |
| Target sentuh (ponsel 390px) | 0 kontrol <44px di area Booking dan staf (kecuali tautan sebaris dalam kalimat) | 9–31 per layar |
| `<h1>` | tepat satu per halaman, urutan h1→h6 tanpa lompat | Booking: 0 |
| Fokus | Cincin 3px biru + selisih 2px putih, tidak tertutup elemen sticky (bilah bawah memberi `scroll-padding`) | Cincin ada di wizard |
| Keyboard | Seluruh alur booking dan staf bisa diselesaikan tanpa mouse; urutan tab = urutan visual | belum diukur |
| Gerak | `prefers-reduced-motion` mematikan karcis-tercetak dan crossfade | sebagian |
| Overflow | 0 *horizontal scroll* pada 320 / 390 / 768 / 1440 | 0 (dipertahankan) |
| Galat formulir | Inline + ringkasan terfokus; `role=alert` | inline saja, 10–11px |
| Bahasa | 0 string Inggris di antarmuka pelanggan; 0 istilah teknis | 12+ string Inggris |
| Token | 0 hex di komponen; 0 `!important` baru; 1 set breakpoint | 262 hex; 2 `!important` |
| Performa | Font self-host `font-display: swap`; Lighthouse Booking tidak turun dari baseline v2.1e (99/96/100/91) | baseline ada |

---

## 8. Rencana eksekusi (setelah disetujui)

Prinsip: setiap langkah kecil, diverifikasi, dan **tes e2e diperbarui di langkah yang sama** bila nama aksesibelnya berubah. Tidak ada perubahan backend.

| Langkah | Isi | Selesai bila |
|---|---|---|
| **5a Fondasi** ✅ | `tokens.css` (`@theme`), font self-host + verifikasi `tnum`/`lnum`/`wdth`, gaya dasar (reset, fokus, tipografi, angka tabular), komponen `src/ui/` (Button, TextField, Notice, StatusBadge, Ticket) tanpa mengubah tata letak halaman | `tsc`, build, lint lolos; 19 e2e baseline + 13 staf **tetap lulus tanpa diubah**; kontras lolos; 0 hex baru. **Hasil:** semua terpenuhi. `tsc` 0 galat; lint 7 peringatan (= baseline); 40 e2e lama lulus tanpa diubah (19 + 2 + 3 + 3 + 13); `npm run check:contrast` 32/32; 0 hex/rgb/`!important` di `src/ui`; 12 tes baru `npm run e2e:ui`; 10 dari 10 tangkapan layar halaman lama identik byte-per-byte dengan dan tanpa token. |
| **5b Shell pelanggan** | Header/Footer, strip demo tipis, bahasa Indonesia, galat manusiawi, `<h1>` | Metrik A6, A7, A8 terpenuhi; e2e navigasi lulus |
| **5c Wizard booking** | Pecah `Booking.tsx` (A12) menjadi bagian kecil; DayStrip, SlotPicker, BarberChoice, ServiceChoice, karcis langsung + bilah bawah ponsel, ringkasan galat, karcis tercetak | Metrik A4–A6, A9–A11 terpenuhi di 390px dan 1440px; e2e booking diperbarui **dan** lulus; alur demo dan API sama-sama diuji |
| **5d Area staf** | StaffRail/TabBar, NowPanel, QueueRow, laporan (grafik + tabel pengganti), WeekGrid | Metrik A5, A13, A14 terpenuhi; 13+ e2e staf lulus; bukti "Sekarang" bekerja untuk admin dan barber |
| **5e Penyelarasan dan QA** | Halaman lain (Beranda, Layanan, Barber, Inspirasi, Tentang, FAQ) ikut token (warna/tipografi, tanpa mengubah tata letak); hapus CSS lama yang sudah tidak dipakai; pengukuran ulang seluruh §7; tangkapan **sesudah** vs **sebelum**; perbarui README dan studi kasus | Semua baris §7 hijau atau ditandai jujur "belum"; 0 CSS yatim |

**Kontrak tes.** Playwright memakai nama aksesibel (grup "Pilih layanan", "Pilih barber", "Jam preferensi"; tombol "Lanjutkan", "Buat Tiket …"; `#wizard-name`, `#wizard-phone`; di staf: label "Username"/"Password", tombol/tautan "Masuk", "Laporan", "Jadwal", `Konfirmasi — {nama}`). Mengganti nama ini adalah perubahan yang disengaja: dicatat per langkah dan dites ulang, bukan dibiarkan merusak 5a.

**Risiko.** (1) Mengubah wizard dari 4 ke 3 langkah menyentuh banyak tes (Keputusan 2). (2) Foto hero saat ini berasal dari sumber eksternal; kualitas dan lisensi perlu dicek sebelum dipakai di portofolio. (3) Font baru menambah satu dependensi dan bobot unduhan. (4) Tidak ada dark mode di Sprint 5; token disusun agar bisa ditambah nanti.

---

## 9. Review terhadap klise (catatan proses)

Sesuai skill `frontend-design`, rencana ini ditinjau terhadap hasil default sebelum final.

| Draf | Isi | Keputusan |
|---|---|---|
| 1 | Navy tua + emas kuningan + serif display "mewah" | **Ditolak.** Itu paket "barbershop mewah" yang paling lazim; hanya menukar hijau dengan navy |
| 2 | Krem hangat + terakota + serif | **Ditolak.** Persis ciri nomor 1 pada daftar klise |
| 3 (final) | Putih-ubin dingin + tinta navy + **satu** biru aksi + kuning karcis hanya pada karcis; satu keluarga grotesk; konsep karcis/papan antrean dari dunia antrean | Dipakai |

Yang dikorbankan dengan sadar: ornamen "premium" (emas, serif, tekstur). Keunggulannya diharapkan datang dari ketepatan: angka yang terbaca benar, alur pendek, dan satu elemen yang mudah diingat. **Risiko yang saya akui:** tanpa foto yang baik dan karcis yang digarap rapi, arah ini bisa terasa "dingin" untuk barbershop. Karena itu pratinjau visual disertakan sebelum persetujuan.

### Kritik setelah pratinjau dirender

Pratinjau ([`preview.html`](preview.html)) dirender di Chromium (1280px dan 390px) lalu dikritik. Temuan dan perubahannya:

| Temuan | Perubahan |
|---|---|
| Sampel "Sekarang · Georgia" **tidak jujur**: gaya dasar saya memaksa angka *lining* sehingga Georgia tampak normal, padahal di aplikasi angkanya *old-style* | Sampel diperbaiki agar memakai default Georgia, supaya bukti temuan A2 benar |
| Aksi di panel gelap memakai kuning karcis, bertentangan dengan "satu warna aksi (biru)" dan "kuning hanya untuk karcis" | Biru di atas Tinta terukur 2,44:1 (<3:1). Aturan diperjelas: satu aksi utama **per permukaan** (§3.1) |
| Rail staf tetap tampil di ponsel dan memicu *horizontal scroll* (399px): aturan `display:none` dalam media query berada **sebelum** aturan dasar `.rail`, sehingga yang belakangan menang | Urutan diperbaiki. **Pelajaran untuk implementasi:** aturan responsif harus mengikuti aturan dasar komponen yang sama; komponen `src/ui/` memakai satu berkas per komponen, dan 5a mengukur *overflow* di 320/390/768/1440 |
| Nomor besar dan nama pada panel "Sekarang" berdesakan di ponsel, nama membungkus di tengah | Di bawah 480px nomor di atas nama (tumpuk vertikal) |
| Ikon navigasi staf di pratinjau berupa glyph sementara | Hanya di pratinjau; implementasi memakai lucide-react (§3.5) |
| Kesan keseluruhan: bersih, jelas, dan jauh dari templat hijau-emas, tetapi **dingin** untuk barbershop | Tidak diubah di Sprint ini; mitigasi lewat foto dan nada copy (Keputusan 6). Saya tidak mengklaim sudah "hangat" |

Alternatif B: *Evolusi* (mempertahankan hijau)

Jika identitas hijau-emas ingin dipertahankan: pakai semua keputusan struktur di atas (token, tipografi bukan Georgia, karcis, wizard, rail staf, aturan kontras) tetapi dengan palet hijau-tinta `#10251e` + satu aksen `#E8BA79` yang dikoreksi kontrasnya, tanpa italik-aksen, tanpa label kapital, tanpa pita marquee dan lencana fiktif. Lebih aman dan dikenal, tetapi lebih mirip keluaran generik.

---

## 10. Keputusan yang saya butuhkan

| # | Keputusan | Rekomendasi |
|---|---|---|
| 1 | Arah visual: **A "Karcis"** (rebrand, dokumen ini) atau **B "Evolusi hijau"** | A |
| 2 | Wizard: tetap **4 langkah** (tes lama relatif utuh) atau **3 langkah** (Layanan+Barber → Waktu → Data+karcis sebagai konfirmasi) | 3 langkah |
| 3 | Font: **self-host** `@fontsource-variable/archivo` (+1 dependensi) atau tetap font sistem | Self-host |
| 4 | Dasbor staf: **Sekarang + tab + rail** (usulan) atau **daftar yang sama, hanya di-restyle** | Sekarang + tab + rail |
| 5 | Halaman lain (Beranda, dll.): **token saja** (usulan), **redesain penuh**, atau **dibiarkan** (akan tidak konsisten) | Token saja |
| 6 | Gambar hero: pertahankan foto sekarang dengan perlakuan warna seragam; hapus lencana "EST. AB STUDIO" dan pita slogan | Pertahankan + hapus lencana/pita |
| 7 | Uji aksesibilitas otomatis: tambah `@axe-core/playwright` (devDependency) | Tambah |

**Asumsi yang saya pakai:** pelanggan terutama memakai ponsel; barber memakai dasbor sambil bekerja di kursi (sentuhan, cahaya ruangan); mode demo harus tetap jujur tetapi tidak mendominasi layar; seluruh data untuk panel "Sekarang" dapat diturunkan dari respons antrean yang sudah ada (tanpa perubahan backend).

**Tidak dicakup:** perubahan backend, fitur baru, dark mode, deployment, fotografi baru, internasionalisasi.

**Belum diverifikasi:** fitur font (`tnum`/`lnum`/`wdth`) pada berkas yang akan dibundel; Lighthouse setelah perombakan; pengujian dengan pengguna nyata (belum ada).
