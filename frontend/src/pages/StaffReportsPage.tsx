import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { anyApiMode } from '../api/config';
import { bookingDateWib } from '../api/bookings';
import { formatRupiah } from '../data/services';
import { StaffApiError, clearSession, fetchReport, readSession, type Report, type ReportRow } from '../api/staff';

const DAY_MS = 86_400_000;
const todayWib = () => bookingDateWib(new Date().toISOString());
const daysAgoWib = (n: number) => bookingDateWib(new Date(Date.now() - n * DAY_MS).toISOString());

type Result = { key: string; report?: Report; error?: string };

function RowsTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  return <section className="staff-report-block" aria-label={title}>
    <h2>{title}</h2>
    {rows.length === 0 ? <p className="staff-muted">Belum ada data pada rentang ini.</p> : <table className="staff-table">
      <thead><tr><th scope="col">Nama</th><th scope="col">Booking</th><th scope="col">Selesai</th><th scope="col">Tidak hadir</th><th scope="col">Pendapatan</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><th scope="row">{r.name}</th><td>{r.total}</td><td>{r.completed}</td><td>{r.no_show}</td><td>{formatRupiah(r.revenue_idr)}</td></tr>)}</tbody>
    </table>}
  </section>;
}

export default function StaffReportsPage() {
  const [session, setSession] = useState(readSession);
  const [exitMessage, setExitMessage] = useState<string | undefined>();
  const [start, setStart] = useState(() => daysAgoWib(29));
  const [end, setEnd] = useState(todayWib);
  const [result, setResult] = useState<Result>({ key: '' });
  const key = `${start}|${end}`;
  const isAdmin = session?.user.role === 'admin';

  useEffect(() => {
    if (!session || !isAdmin) return;
    let active = true;
    fetchReport(session.token, start, end)
      .then((report) => { if (active) setResult({ key, report }); })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof StaffApiError && err.status === 401) { clearSession(); setExitMessage('Sesi tidak valid. Silakan login ulang.'); setSession(null); return; }
        setResult({ key, error: err instanceof Error ? err.message : 'Gagal memuat laporan.' });
      });
    return () => { active = false; };
  }, [session, isAdmin, start, end, key]);

  if (!anyApiMode) return <section className="staff-card"><h1>Laporan</h1><p role="status">Laporan hanya tersedia pada mode API.</p></section>;
  if (!session) return <Navigate to="/staff/login" replace state={exitMessage ? { message: exitMessage } : undefined} />;
  if (!isAdmin) return <section className="staff-card"><h1>Laporan</h1><p role="alert">Laporan hanya untuk admin.</p><Link className="button button-outline-dark" to="/staff">Kembali ke antrean</Link></section>;

  const current = result.key === key ? result : { key };
  const report = current.report;
  const peakMax = report ? Math.max(1, ...report.peak_hours) : 1;
  const busyHours = report ? report.peak_hours.map((count, hour) => ({ hour, count })).filter((h) => h.count > 0) : [];

  return <section className="staff-dashboard" aria-labelledby="staff-report-title">
    <div className="staff-dash-head">
      <div><p className="staff-eyebrow">ADMIN</p><h1 id="staff-report-title">Laporan</h1>
        <p className="staff-muted">Berdasarkan tanggal reservasi (WIB). Pendapatan dihitung dari booking berstatus selesai.</p></div>
      <Link className="button button-outline-dark" to="/staff"><ArrowLeft size={16} aria-hidden="true" /> Antrean</Link>
    </div>
    <div className="staff-toolbar">
      <div className="staff-field"><label htmlFor="report-start">Dari</label><input id="report-start" type="date" value={start} max={end} onChange={(e) => e.target.value && setStart(e.target.value)} /></div>
      <div className="staff-field"><label htmlFor="report-end">Sampai</label><input id="report-end" type="date" value={end} min={start} onChange={(e) => e.target.value && setEnd(e.target.value)} /></div>
    </div>
    {current.error && <p className="staff-error" role="alert">Laporan gagal dimuat: {current.error}</p>}
    {!report && !current.error && <p className="staff-muted" role="status">Memuat laporan…</p>}
    {report && <>
      <ul className="staff-kpis" aria-label="Ringkasan">
        <li><span>Pendapatan</span><strong>{formatRupiah(report.revenue_idr)}</strong></li>
        <li><span>Booking selesai</span><strong>{report.completed}</strong></li>
        <li><span>Tingkat tidak hadir</span><strong>{report.no_show_rate === null ? '—' : `${(report.no_show_rate * 100).toFixed(1)}%`}</strong></li>
        <li><span>Total booking</span><strong>{Object.values(report.counts).reduce((a, b) => a + b, 0)}</strong></li>
      </ul>
      <RowsTable title="Per barber" rows={report.by_barber} />
      <RowsTable title="Per layanan" rows={report.by_service} />
      <section className="staff-report-block" aria-label="Jam tersibuk">
        <h2>Jam tersibuk</h2>
        {busyHours.length === 0 ? <p className="staff-muted">Belum ada data pada rentang ini.</p> : <ul className="staff-peaks">
          {busyHours.map(({ hour, count }) => <li key={hour}><span>{String(hour).padStart(2, '0')}:00</span>
            <span className="staff-bar" aria-hidden="true"><i style={{ width: `${(count / peakMax) * 100}%` }} /></span><b>{count}</b></li>)}
        </ul>}
      </section>
    </>}
  </section>;
}
