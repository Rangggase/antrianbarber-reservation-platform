import { useEffect, useState } from 'react';

/**
 * v2.3b: availability is READ-ONLY. Production Vercel remains demo.
 * Only v2.3c will POST reservations to FastAPI/PostgreSQL.
 */
export const useLiveAvailability =
  import.meta.env.DEV && import.meta.env.VITE_BOOKING_AVAILABILITY_SOURCE === 'api';

export type AvailabilitySlot = { label: string; iso: string };
type AvailabilityState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  key: string;
  slots: AvailabilitySlot[];
  error: string | null;
};

type AvailabilityQuery = {
  enabled: boolean;
  barberId: number | null;
  serviceId: number | null;
  date: string;
};

const empty: AvailabilitySlot[] = [];

function apiOrigin(): string {
  const base: unknown = import.meta.env.VITE_API_BASE_URL;
  if (typeof base !== 'string' || !base.trim()) {
    throw new Error('VITE_API_BASE_URL belum diatur pada .env.development.local.');
  }
  let url: URL;
  try { url = new URL(base); }
  catch { throw new Error('Alamat API tidak valid.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Alamat API harus berupa origin HTTP(S), misalnya http://127.0.0.1:8000.');
  }
  return url.origin;
}

export function slotLabel(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error('Tanggal slot API tidak valid.');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;
  if (hour === undefined || minute === undefined) throw new Error('Gagal membaca jam WIB.');
  return `${hour}:${minute}`;
}

async function fetchSlots(query: Required<Pick<AvailabilityQuery, 'barberId' | 'serviceId' | 'date'>>, signal: AbortSignal): Promise<AvailabilitySlot[]> {
  const url = new URL('/api/v1/availability', apiOrigin());
  url.searchParams.set('barber_id', String(query.barberId));
  url.searchParams.set('service_id', String(query.serviceId));
  url.searchParams.set('date', query.date);
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }, credentials: 'omit', signal,
  });
  if (!response.ok) throw new Error(`Server mengembalikan HTTP ${response.status}.`);
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Format respons API tidak sesuai.');
  const data = raw as Record<string, unknown>;
  if (data.date !== query.date || data.barber_id !== query.barberId || data.service_id !== query.serviceId || data.timezone !== 'Asia/Jakarta' || !Array.isArray(data.slots)) {
    throw new Error('API mengembalikan jadwal untuk pilihan yang berbeda atau struktur yang salah.');
  }
  const slots: AvailabilitySlot[] = [];
  for (const value of data.slots) {
    if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
      throw new Error('Slot API harus memakai waktu ISO 8601 dengan zona waktu.');
    }
    const label = slotLabel(value);
    if (!slots.some(item => item.label === label)) slots.push({ label, iso: value });
  }
  return slots;
}

/** A response from an older request is never displayed for newer choices. */
export function useAvailability(query: AvailabilityQuery) {
  const [retryId, setRetryId] = useState(0);
  const [state, setState] = useState<AvailabilityState>({ status: 'idle', key: '', slots: [], error: null });
  const key = `${query.barberId ?? ''}|${query.serviceId ?? ''}|${query.date}|${retryId}`;
  const canRequest = query.enabled && Number.isInteger(query.barberId) && Number.isInteger(query.serviceId) &&
    (query.barberId ?? 0) > 0 && (query.serviceId ?? 0) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(query.date);

  useEffect(() => {
    if (!canRequest || query.barberId === null || query.serviceId === null) return;
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading', key, slots: [], error: null });
    const timer = window.setTimeout(() => controller.abort(), 8000);
    fetchSlots({ barberId: query.barberId, serviceId: query.serviceId, date: query.date }, controller.signal)
      .then(slots => { if (active) setState({ status: 'ready', key, slots, error: null }); })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: 'error', key, slots: [],
          error: controller.signal.aborted ? 'Waktu permintaan API melebihi 8 detik.' : error instanceof Error ? error.message : 'Gagal memuat slot API.',
        });
      })
      .finally(() => window.clearTimeout(timer));
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [canRequest, query.barberId, query.serviceId, query.date, key]);

  const current: AvailabilityState = !canRequest
    ? { status: 'idle', key, slots: [], error: null }
    : state.key === key ? state : { status: 'loading', key, slots: [], error: null };
  return { ...current, slots: current.status === 'ready' ? current.slots : empty, retry: () => setRetryId(n => n + 1) };
}
