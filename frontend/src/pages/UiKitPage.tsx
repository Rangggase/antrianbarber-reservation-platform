import { useState } from 'react';
import { Button, Notice, StatusBadge, TextField, Ticket } from '../ui';
import type { BookingStatus } from '../api/staff';

/**
 * Development-only kitchen sink for the new design system (route /ui-kit, not in production builds).
 * It exists to look at, and to test, every Sprint 5a primitive. No raw colour values here: tokens only.
 */
const SWATCHES = ['surface-page', 'surface', 'ink', 'ink-2', 'ink-muted', 'line', 'control', 'action', 'action-hover', 'ticket', 'danger', 'success', 'progress', 'warn', 'neutral'] as const;
const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'in_service', 'completed', 'cancelled', 'no_show'];

const section = { margin: '48px 0 0' } as const;
const row = { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' } as const;

export default function UiKitPage() {
  const [loading, setLoading] = useState(false);
  const [printKey, setPrintKey] = useState(0);
  const [phone, setPhone] = useState('08');

  return (
    <div className="ds-root" style={{ minHeight: '100vh' }}>
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 16px 96px' }}>
        <h1 style={{ fontSize: 'var(--text-ds-h1)', lineHeight: 1.1, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Design system kit</h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: 'var(--text-ds-label)' }}>Sprint 5a. Halaman ini hanya ada saat pengembangan.</p>

        <section style={section} aria-labelledby="kit-color">
          <h2 id="kit-color" style={{ fontSize: 'var(--text-ds-h2)' }}>Warna</h2>
          <ul style={{ ...row, listStyle: 'none', padding: 0 }}>
            {SWATCHES.map((name) => (
              <li key={name} data-token={name} style={{ width: 120 }}>
                <span style={{ display: 'block', height: 48, background: `var(--color-${name})`, border: '1px solid var(--color-line)', borderRadius: 'var(--radius-surface)' }} />
                <span style={{ fontSize: 'var(--text-ds-caption)' }}>{name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section style={section} aria-labelledby="kit-type">
          <h2 id="kit-type" style={{ fontSize: 'var(--text-ds-h2)' }}>Tipografi dan angka</h2>
          <p style={{ fontSize: 'var(--text-ds-h3)', fontWeight: 600 }}>Pilih layanan (h3, 18px)</p>
          <p>Isi teks 16px dengan tinggi baris 1,55, untuk keterangan dan paragraf pendek.</p>
          <p style={{ fontSize: 'var(--text-ds-caption)', color: 'var(--color-ink-muted)' }}>Caption 13px: ukuran terkecil yang dipakai.</p>
          <p style={row}>
            {/* weight 400 on purpose: that is where proportional figures differ and tabular-nums visibly matters */}
            <span id="num-ones" className="ds-num" style={{ whiteSpace: 'nowrap', fontSize: 32, fontWeight: 400 }}>1111</span>
            <span id="num-zeros" className="ds-num" style={{ whiteSpace: 'nowrap', fontSize: 32, fontWeight: 400 }}>0000</span>
            <span className="ds-num" style={{ fontSize: 32, fontWeight: 700 }}>09:00 · AB-001 · Rp 3.540.000</span>
          </p>
          <p style={{ fontSize: 32, fontWeight: 800, fontStretch: '75%' }} id="num-condensed">Condensed 14.30</p>
          <p style={{ fontSize: 32, fontWeight: 800, fontStretch: '100%' }} id="num-normal">Normal 14.30</p>
        </section>

        <section style={section} aria-labelledby="kit-buttons">
          <h2 id="kit-buttons" style={{ fontSize: 'var(--text-ds-h2)' }}>Tombol</h2>
          <div style={row} data-surface="light">
            <Button>Ambil karcis</Button>
            <Button variant="secondary">Kembali</Button>
            <Button variant="quiet">Tanggal lain</Button>
            <Button variant="danger">Batalkan reservasi</Button>
            <Button disabled>Nonaktif</Button>
            <Button loading={loading} loadingLabel="Mengirim…" onClick={() => { setLoading(true); window.setTimeout(() => setLoading(false), 1200); }}>Kirim</Button>
          </div>
          <div className="ds-on-ink" data-surface="ink" style={{ ...row, marginTop: 16, padding: 16, background: 'var(--color-ink)', color: 'var(--color-on-ink)', borderRadius: 'var(--radius-surface)' }}>
            <Button>Mulai layanan</Button>
            <Button variant="secondary">Lihat detail</Button>
            <Button variant="quiet">Lewati</Button>
          </div>
        </section>

        <section style={section} aria-labelledby="kit-fields">
          <h2 id="kit-fields" style={{ fontSize: 'var(--text-ds-h2)' }}>Isian</h2>
          <div style={{ display: 'grid', gap: 16, maxWidth: 420 }}>
            <TextField label="Nama lengkap" required hint="Sesuai nama yang akan dipanggil barber." autoComplete="name" />
            <TextField label="Nomor HP" required value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel"
              error={phone.length < 10 ? 'Nomor HP belum lengkap. Contoh: 0812 3456 7890' : undefined} />
          </div>
        </section>

        <section style={section} aria-labelledby="kit-notices">
          <h2 id="kit-notices" style={{ fontSize: 'var(--text-ds-h2)' }}>Pemberitahuan</h2>
          <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
            <Notice variant="info">Demo portofolio, gunakan data fiktif.</Notice>
            <Notice variant="success" title="Karcis Anda sudah terbit">Tunjukkan kode karcis ini kepada barber.</Notice>
            <Notice variant="warning" title="Slot hampir penuh">Hanya tersisa 2 slot hari ini.</Notice>
            <Notice variant="danger" title="Daftar layanan belum bisa dimuat" action={<Button variant="secondary" compact>Coba lagi</Button>}>Periksa koneksi Anda, lalu coba lagi.</Notice>
          </div>
        </section>

        <section style={section} aria-labelledby="kit-status">
          <h2 id="kit-status" style={{ fontSize: 'var(--text-ds-h2)' }}>Status</h2>
          <div style={row}>{STATUSES.map((status) => <StatusBadge key={status} status={status} />)}</div>
        </section>

        <section style={section} aria-labelledby="kit-ticket">
          <h2 id="kit-ticket" style={{ fontSize: 'var(--text-ds-h2)' }}>Karcis</h2>
          <div style={{ ...row, alignItems: 'flex-start', gap: 32 }}>
            <Ticket dateLabel="Sen 16 Nov" service="Fade & Taper" barber="Raka Pratama" time="14.30" price="Rp 75.000" code="AB-20261116-3F9A2C" />
            <Ticket key={printKey} animate dateLabel="Sen 16 Nov" service="Fade & Taper" barber="Raka Pratama" time="14.30" price="Rp 75.000"
              queueNumber={7} waitNote="2 antrean di depan, ±90 menit" code="AB-20261116-3F9A2C" />
          </div>
          <p><Button variant="secondary" onClick={() => setPrintKey((key) => key + 1)}>Putar ulang animasi karcis</Button></p>
        </section>
      </main>
    </div>
  );
}
