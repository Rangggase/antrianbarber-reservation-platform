import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { anyApiMode } from '../api/config';
import { bookingDateWib } from '../api/bookings';
import {
  StaffApiError, addTimeOff, clearSession, fetchBarbers, fetchSchedule, readSession, removeTimeOff, saveSchedule,
  type BarberOption, type Interval, type ScheduleView,
} from '../api/staff';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const todayWib = () => bookingDateWib(new Date().toISOString());

type Loaded = { barberId: number; view?: ScheduleView; error?: string };

export default function StaffSchedulePage() {
  const [session, setSession] = useState(readSession);
  const [exitMessage, setExitMessage] = useState<string | undefined>();
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [barberId, setBarberId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<Interval[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [offStart, setOffStart] = useState(todayWib);
  const [offEnd, setOffEnd] = useState(todayWib);
  const [offReason, setOffReason] = useState('');
  const isAdmin = session?.user.role === 'admin';

  const expire = () => { clearSession(); setExitMessage('Sesi tidak valid. Silakan login ulang.'); setSession(null); };
  const fail = (err: unknown) => {
    if (err instanceof StaffApiError && err.status === 401) { expire(); return; }
    setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
  };

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchBarbers().then((list) => { if (!active) return; setBarbers(list); setBarberId((current) => current ?? list[0]?.id ?? null); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Gagal memuat daftar barber.'); });
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!session || !isAdmin || barberId === null) return;
    let active = true;
    fetchSchedule(session.token, barberId)
      .then((view) => { if (active) { setLoaded({ barberId, view }); setDraft(view.intervals); } })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof StaffApiError && err.status === 401) { clearSession(); setExitMessage('Sesi tidak valid. Silakan login ulang.'); setSession(null); return; }
        setLoaded({ barberId, error: err instanceof Error ? err.message : 'Gagal memuat jadwal.' });
      });
    return () => { active = false; };
  }, [session, isAdmin, barberId, reload]);

  if (!anyApiMode) return <section className="staff-card"><h1>Jadwal</h1><p role="status">Pengaturan jadwal hanya tersedia pada mode API.</p></section>;
  if (!session) return <Navigate to="/staff/login" replace state={exitMessage ? { message: exitMessage } : undefined} />;
  if (!isAdmin) return <section className="staff-card"><h1>Jadwal</h1><p role="alert">Pengaturan jadwal hanya untuk admin.</p><Link className="button button-outline-dark" to="/staff">Kembali ke antrean</Link></section>;

  const current = loaded && loaded.barberId === barberId ? loaded : null;
  const view = current?.view;

  async function run(action: () => Promise<void>, success: string) {
    if (!session || busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(success); setReload((n) => n + 1); } catch (err) { fail(err); } finally { setBusy(false); }
  }

  const changeBarber = (value: string) => { setBarberId(value ? Number(value) : null); setNotice(''); setError(''); };
  const update = (index: number, field: 'start_time' | 'end_time', value: string) => setDraft((d) => d.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

  return <section className="staff-dashboard" aria-labelledby="staff-schedule-title">
    <div className="staff-dash-head">
      <div><p className="staff-eyebrow">ADMIN</p><h1 id="staff-schedule-title">Jadwal dan cuti</h1>
        <p className="staff-muted">Jam kerja mingguan (WIB) menentukan slot yang bisa dipesan. Perubahan tidak mengubah reservasi yang sudah ada.</p></div>
      <Link className="button button-outline-dark" to="/staff"><ArrowLeft size={16} aria-hidden="true" /> Antrean</Link>
    </div>
    <div className="staff-toolbar">
      <div className="staff-field"><label htmlFor="schedule-barber">Barber</label>
        <select id="schedule-barber" value={barberId ?? ''} onChange={(e) => changeBarber(e.target.value)}>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
        </select></div>
    </div>
    {notice && <p className="staff-notice" role="status">{notice}</p>}
    {error && <p className="staff-error" role="alert">{error}</p>}
    {current?.error && <p className="staff-error" role="alert">Jadwal gagal dimuat: {current.error}</p>}
    {!view && !current?.error && barberId !== null && <p className="staff-muted" role="status">Memuat jadwal…</p>}

    {view && <>
      <section className="staff-report-block" aria-label="Jam kerja mingguan">
        <h2>Jam kerja mingguan</h2>
        <ul className="staff-week">
          {DAYS.map((name, weekday) => <li key={name}>
            <strong>{name}</strong>
            <div className="staff-intervals">
              {draft.map((item, index) => item.weekday !== weekday ? null : <div className="staff-interval" key={index}>
                <input type="time" step={1800} aria-label={`${name} mulai`} value={item.start_time} onChange={(e) => update(index, 'start_time', e.target.value)} />
                <span aria-hidden="true">–</span>
                <input type="time" step={1800} aria-label={`${name} selesai`} value={item.end_time} onChange={(e) => update(index, 'end_time', e.target.value)} />
                <button type="button" className="staff-icon-btn" aria-label={`Hapus jam ${name} ${item.start_time}-${item.end_time}`} onClick={() => setDraft((d) => d.filter((_, i) => i !== index))}><Trash2 size={15} aria-hidden="true" /></button>
              </div>)}
              {!draft.some((i) => i.weekday === weekday) && <span className="staff-muted">Libur</span>}
              <button type="button" className="staff-link" onClick={() => setDraft((d) => [...d, { weekday, start_time: '09:00', end_time: '17:00' }])}><Plus size={13} aria-hidden="true" /> Tambah jam {name}</button>
            </div>
          </li>)}
        </ul>
        <button type="button" className="button button-gold" disabled={busy} onClick={() => run(async () => { await saveSchedule(session.token, view.barber_id, draft); }, `Jadwal ${view.barber_name} disimpan.`)}>Simpan jadwal</button>
      </section>

      <section className="staff-report-block" aria-label="Cuti">
        <h2>Cuti</h2>
        {view.time_off.length === 0 ? <p className="staff-muted">Tidak ada cuti terjadwal.</p> : <ul className="staff-timeoff">
          {view.time_off.map((t) => <li key={t.id}>
            <span><b>{t.starts_on === t.ends_on ? t.starts_on : `${t.starts_on} → ${t.ends_on}`}</b>{t.reason ? ` · ${t.reason}` : ''}</span>
            <button type="button" className="staff-action action-cancelled" disabled={busy} aria-label={`Hapus cuti ${t.starts_on}`}
              onClick={() => { if (window.confirm(`Hapus cuti ${t.starts_on}${t.starts_on === t.ends_on ? '' : ` s/d ${t.ends_on}`}?`)) void run(async () => { await removeTimeOff(session.token, t.id); }, 'Cuti dihapus.'); }}>Hapus</button>
          </li>)}
        </ul>}
        <div className="staff-toolbar">
          <div className="staff-field"><label htmlFor="off-start">Mulai</label><input id="off-start" type="date" value={offStart} min={todayWib()} onChange={(e) => e.target.value && setOffStart(e.target.value)} /></div>
          <div className="staff-field"><label htmlFor="off-end">Sampai</label><input id="off-end" type="date" value={offEnd} min={offStart} onChange={(e) => e.target.value && setOffEnd(e.target.value)} /></div>
          <div className="staff-field"><label htmlFor="off-reason">Alasan (opsional)</label><input id="off-reason" maxLength={180} value={offReason} onChange={(e) => setOffReason(e.target.value)} /></div>
          <button type="button" className="button button-outline-dark staff-refresh" disabled={busy}
            onClick={() => run(async () => { await addTimeOff(session.token, view.barber_id, offStart, offEnd, offReason); setOffReason(''); }, 'Cuti ditambahkan.')}>Tambah cuti</button>
        </div>
      </section>
    </>}
  </section>;
}
