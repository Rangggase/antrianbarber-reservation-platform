import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { LogOut, RefreshCw } from 'lucide-react';
import { anyApiMode } from '../api/config';
import { bookingDateWib } from '../api/bookings';
import {
  ACTION_LABEL, STATUS_LABEL, StaffApiError, changeStatus, clearSession, fetchBarbers, fetchQueue, readSession,
  type BarberOption, type BookingStatus, type Queue, type StaffBooking, type StaffSession,
} from '../api/staff';
import { Button } from '../ui';
import { NowPanel } from '../components/staff/NowPanel';
import { QueueRow } from '../components/staff/QueueRow';

const AUTO_REFRESH_MS = 30_000;
const CONFIRM_ACTIONS = new Set<BookingStatus>(['cancelled', 'no_show']);
const todayWib = () => bookingDateWib(new Date().toISOString());

function countStatuses(bookings: StaffBooking[]): Record<string, number> {
  const counts: Record<string, number> = { pending: 0, confirmed: 0, in_service: 0, completed: 0, cancelled: 0, no_show: 0 };
  for (const b of bookings) counts[b.status] = (counts[b.status] ?? 0) + 1;
  return counts;
}

/** One "Sekarang" card per barber in the loaded queue: who is in service and who is next. */
function nowPanels(bookings: StaffBooking[]) {
  const barbers = new Map<number, string>();
  for (const b of bookings) barbers.set(b.barber_id, b.barber_name);
  return Array.from(barbers, ([id, name]) => {
    const own = bookings.filter(b => b.barber_id === id);
    return { id, name, current: own.find(b => b.status === 'in_service'), next: own.find(b => b.status === 'confirmed') };
  });
}

type Result = { viewKey: string; queue?: Queue; error?: string };

export default function StaffDashboardPage() {
  const [session, setSession] = useState<StaffSession | null>(readSession);
  const [exitMessage, setExitMessage] = useState<string | undefined>();
  const [date, setDate] = useState(todayWib);
  const [barberId, setBarberId] = useState<number | null>(null);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result>({ viewKey: '' });
  const [notice, setNotice] = useState('');
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const lock = useRef(false);

  const viewKey = `${date}|${barberId ?? ''}`;
  const isAdmin = session?.user.role === 'admin';

  // One navigation path only: clearing the session renders <Navigate> below, which carries the message.
  const logout = useCallback((message?: string) => {
    clearSession();
    setExitMessage(message);
    setSession(null);
  }, []);

  // Sign out automatically when the token expires.
  useEffect(() => {
    if (!session) return;
    const wait = Math.max(0, session.expiresAt - Date.now());
    const timer = window.setTimeout(() => logout('Sesi berakhir. Silakan login ulang.'), Math.min(wait, 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  // Barber filter for admins (public catalog endpoint).
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchBarbers().then((list) => { if (active) setBarbers(list); }).catch(() => { /* filter is optional */ });
    return () => { active = false; };
  }, [isAdmin]);

  // Load the queue; also refreshes in the background so a barber sees new bookings.
  useEffect(() => {
    if (!session) return;
    let active = true;
    fetchQueue(session.token, date, barberId)
      .then((queue) => { if (active) setResult({ viewKey, queue }); })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof StaffApiError && err.status === 401) { logout('Sesi tidak valid. Silakan login ulang.'); return; }
        setResult((prev) => ({ viewKey, queue: prev.viewKey === viewKey ? prev.queue : undefined, error: err instanceof Error ? err.message : 'Gagal memuat antrean.' }));
      });
    return () => { active = false; };
  }, [session, date, barberId, viewKey, reload, logout]);

  useEffect(() => {
    const id = window.setInterval(() => setReload((n) => n + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!anyApiMode) {
    return <section className="staff-card"><h1>Dasbor staf</h1><p role="status">Dasbor hanya tersedia pada mode API.</p><Link className="button button-outline-dark" to="/">Kembali ke beranda</Link></section>;
  }
  if (!session) return <Navigate to="/staff/login" replace state={exitMessage ? { message: exitMessage } : undefined} />;

  const current = result.viewKey === viewKey ? result : { viewKey };
  const queue = current.queue;
  const loading = !queue && !current.error;
  const isToday = date === todayWib();

  async function act(booking: StaffBooking, status: BookingStatus) {
    if (!session || lock.current) return;
    if (CONFIRM_ACTIONS.has(status) && !window.confirm(`${ACTION_LABEL[status]} reservasi ${booking.reference_code} (${booking.customer_name})?`)) return;
    lock.current = true; setBusyRef(booking.reference_code); setNotice('');
    try {
      const updated = await changeStatus(session.token, booking.reference_code, status);
      setResult((prev) => {
        if (!prev.queue) return prev;
        const bookings = prev.queue.bookings.map((b) => (b.reference_code === updated.reference_code ? updated : b));
        return { ...prev, queue: { ...prev.queue, bookings, counts: countStatuses(bookings) } };
      });
      setNotice(`${booking.customer_name}: ${STATUS_LABEL[updated.status]}${updated.queue_number ? ` · nomor antrean ${updated.queue_number}` : ''}.`);
    } catch (err) {
      if (err instanceof StaffApiError && err.status === 401) { logout('Sesi tidak valid. Silakan login ulang.'); return; }
      setNotice(err instanceof Error ? err.message : 'Gagal mengubah status.');
      setReload((n) => n + 1); // the server state may differ from what is shown
    } finally {
      lock.current = false; setBusyRef(null);
    }
  }

  const panels = queue && isToday ? nowPanels(queue.bookings) : [];

  return <section className="staff-dashboard" aria-labelledby="staff-dash-title">
    <div className="staff-dash-head">
      <div>
        <p className="staff-eyebrow">{isAdmin ? 'ADMIN' : 'BARBER'}</p>
        <h1 id="staff-dash-title">Antrean harian</h1>
        <p className="staff-muted">{session.user.full_name}{queue && !isAdmin && queue.bookings[0] ? ` · ${queue.bookings[0].barber_name}` : ''}</p>
      </div>
      <div className="staff-head-actions">
        <Button variant="secondary" onClick={() => logout()}><LogOut size={16} aria-hidden="true" /> Keluar</Button>
      </div>
    </div>

    <div className="staff-toolbar">
      <div className="staff-field"><label htmlFor="staff-date">Tanggal (WIB)</label>
        <input id="staff-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
      {isAdmin && <div className="staff-field"><label htmlFor="staff-barber">Barber</label>
        <select id="staff-barber" value={barberId ?? ''} onChange={(e) => setBarberId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Semua barber</option>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
        </select></div>}
      <Button variant="secondary" className="staff-refresh" onClick={() => setReload((n) => n + 1)}><RefreshCw size={16} aria-hidden="true" /> Muat ulang</Button>
    </div>

    {panels.length > 0 && <div className="staff-now-grid">
      {panels.map((p) => <NowPanel key={p.id} barberName={p.name} current={p.current} next={p.next} busy={busyRef !== null} onAct={act} />)}
    </div>}

    {queue && <ul className="staff-counts" aria-label="Ringkasan status">
      {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => <li key={s} className={`staff-chip status-${s}`}><b>{queue.counts[s] ?? 0}</b> {STATUS_LABEL[s]}</li>)}
    </ul>}

    {notice && <p className="staff-notice" role="status">{notice}</p>}
    {current.error && <p className="staff-error" role="alert">Antrean gagal dimuat: {current.error} <button type="button" className="staff-link" onClick={() => setReload((n) => n + 1)}>Coba lagi</button></p>}
    {loading && <p className="staff-muted" role="status">Memuat antrean…</p>}
    {queue && queue.bookings.length === 0 && <p className="staff-empty" role="status">Belum ada reservasi pada tanggal ini.</p>}

    {queue && queue.bookings.length > 0 && <ol className="staff-list" aria-label="Daftar reservasi">
      {queue.bookings.map((b) => <QueueRow key={b.reference_code} booking={b} isAdmin={isAdmin} busyRef={busyRef} onAct={act} />)}
    </ol>}
  </section>;
}
