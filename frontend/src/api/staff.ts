/**
 * Staff (back office) API client: login, daily queue, booking status changes.
 *
 * The JWT lives in sessionStorage: it disappears when the tab closes and is never sent to any
 * origin except the API. Trade-off: script injected into the page (XSS) could read it, which is
 * why the app renders no unsanitised HTML. Tokens are short-lived and checked server-side on
 * every request.
 */
import { apiOrigin } from './config';

export type StaffRole = 'admin' | 'barber';
export type BookingStatus = 'pending' | 'confirmed' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
export type StaffUser = { id: number; username: string; full_name: string; role: StaffRole; barber_id: number | null };
export type StaffSession = { token: string; expiresAt: number; user: StaffUser };
export type StaffBooking = {
  reference_code: string;
  customer_name: string;
  customer_phone: string;
  barber_id: number;
  barber_name: string;
  service_id: number;
  service_name: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  queue_number: number | null;
  price_idr: number;
  allowed_next: BookingStatus[];
};
export type Queue = { date: string; barber_id: number | null; bookings: StaffBooking[]; counts: Record<string, number> };
export type BarberOption = { id: number; full_name: string };

export const SESSION_KEY = 'antrian-barber-staff-session-v27';

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Menunggu',
  confirmed: 'Terkonfirmasi',
  in_service: 'Dilayani',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  no_show: 'Tidak hadir',
};

export const ACTION_LABEL: Record<string, string> = {
  confirmed: 'Konfirmasi',
  in_service: 'Mulai layanan',
  completed: 'Selesai',
  cancelled: 'Batalkan',
  no_show: 'Tidak hadir',
};

export class StaffApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = 'error') {
    super(message);
    this.name = 'StaffApiError';
    this.status = status;
    this.code = code;
  }
}

const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);

function isUser(x: unknown): x is StaffUser {
  return isRecord(x) && Number.isInteger(x.id) && typeof x.username === 'string' && typeof x.full_name === 'string' &&
    (x.role === 'admin' || x.role === 'barber') && (x.barber_id === null || Number.isInteger(x.barber_id));
}

const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'in_service', 'completed', 'cancelled', 'no_show'];
const isStatus = (x: unknown): x is BookingStatus => typeof x === 'string' && (STATUSES as string[]).includes(x);

function isBooking(x: unknown): x is StaffBooking {
  return isRecord(x) && typeof x.reference_code === 'string' && typeof x.customer_name === 'string' &&
    typeof x.customer_phone === 'string' && Number.isInteger(x.barber_id) && typeof x.barber_name === 'string' &&
    typeof x.service_name === 'string' && typeof x.starts_at === 'string' && !Number.isNaN(Date.parse(x.starts_at)) &&
    isStatus(x.status) && (x.queue_number === null || Number.isInteger(x.queue_number)) &&
    Array.isArray(x.allowed_next) && x.allowed_next.every(isStatus);
}

function isQueue(x: unknown): x is Queue {
  return isRecord(x) && typeof x.date === 'string' && Array.isArray(x.bookings) && x.bookings.every(isBooking) && isRecord(x.counts);
}

// --- session -----------------------------------------------------------------------

export function readSession(): StaffSession | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!isRecord(raw) || typeof raw.token !== 'string' || typeof raw.expiresAt !== 'number' || !isUser(raw.user)) return null;
    if (raw.expiresAt <= Date.now()) { clearSession(); return null; }
    return { token: raw.token, expiresAt: raw.expiresAt, user: raw.user };
  } catch {
    return null;
  }
}

export function saveSession(session: StaffSession): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* private mode: session lasts until reload */ }
}

export function clearSession(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

// --- requests ----------------------------------------------------------------------

async function request(path: string, method: 'GET' | 'POST', token?: string, body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);
  try {
    let origin: string;
    try { origin = apiOrigin(); } catch (err) { throw new StaffApiError(err instanceof Error ? err.message : 'Backend belum dikonfigurasi.', 0, 'config'); }
    const response = await fetch(`${origin}${path}`, {
      method,
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      let detail = `Backend mengembalikan HTTP ${response.status}.`;
      let code = 'error';
      try {
        const json: unknown = await response.json();
        if (isRecord(json)) {
          if (typeof json.detail === 'string') detail = json.detail.slice(0, 200);
          if (typeof json.code === 'string') code = json.code;
        }
      } catch { /* keep the generic message */ }
      throw new StaffApiError(detail, response.status, code);
    }
    return (await response.json()) as unknown;
  } catch (err) {
    if (err instanceof StaffApiError) throw err;
    throw new StaffApiError(controller.signal.aborted ? 'Permintaan melebihi 10 detik.' : 'Gagal menghubungi server.', 0, 'network');
  } finally {
    window.clearTimeout(timer);
  }
}

export async function login(username: string, password: string): Promise<StaffSession> {
  const raw = await request('/api/v1/staff/login', 'POST', undefined, { username, password });
  if (!isRecord(raw) || typeof raw.access_token !== 'string' || typeof raw.expires_in !== 'number' || !isUser(raw.user)) {
    throw new StaffApiError('Respons login tidak sesuai kontrak backend.', 0, 'contract');
  }
  return { token: raw.access_token, expiresAt: Date.now() + raw.expires_in * 1000, user: raw.user };
}

export async function fetchQueue(token: string, date: string, barberId: number | null): Promise<Queue> {
  const params = new URLSearchParams({ date });
  if (barberId !== null) params.set('barber_id', String(barberId));
  const raw = await request(`/api/v1/staff/queue?${params}`, 'GET', token);
  if (!isQueue(raw)) throw new StaffApiError('Format antrean dari backend tidak sesuai.', 0, 'contract');
  return raw;
}

export async function changeStatus(token: string, reference: string, status: BookingStatus): Promise<StaffBooking> {
  if (!/^AB-[A-Z0-9-]{4,}$/.test(reference)) throw new StaffApiError('Kode reservasi tidak valid.', 0, 'client');
  const raw = await request(`/api/v1/staff/bookings/${encodeURIComponent(reference)}/status`, 'POST', token, { status });
  if (!isBooking(raw)) throw new StaffApiError('Respons perubahan status tidak sesuai kontrak.', 0, 'contract');
  return raw;
}

export async function fetchBarbers(): Promise<BarberOption[]> {
  const raw = await request('/api/v1/barbers', 'GET');
  if (!Array.isArray(raw)) throw new StaffApiError('Format daftar barber tidak sesuai.', 0, 'contract');
  return raw.filter((b): b is BarberOption => isRecord(b) && Number.isInteger(b.id) && typeof b.full_name === 'string')
    .map((b) => ({ id: b.id, full_name: b.full_name }));
}
