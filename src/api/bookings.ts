/** v2.3c. Browser-local development only; never put a DB secret in Vite env. */
import { useLiveAvailability } from './availability';

export const useRealBooking =
  import.meta.env.DEV &&
  useLiveAvailability &&
  import.meta.env.VITE_BOOKING_TRANSACTIONS_SOURCE === 'api';

// === TYPES & INTERFACES ===
export type BookingView = {
  reference_code: string;
  barber_id: number;
  service_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  price_idr: number;
};

export type StoredApiTicket = BookingView & { access_token: string };

export type BookingPayload = {
  full_name: string;
  phone: string;
  barber_id: number;
  service_id: number;
  starts_at: string;
};

export const API_TICKETS_STORAGE_KEY = 'antrian-barber-api-tickets-session-v23c';

// === DATE UTILS ===
/** Format calendar date explicitly, independent of locale punctuation. */
export function bookingDateWib(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));

  const part = (name: string) => parts.find((p) => p.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// === CUSTOM ERROR ===
export class BookingApiError extends Error {
  public status: number;
  public uncertain: boolean;

  constructor(message: string, status: number, uncertain = false) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
    this.uncertain = uncertain;
  }
}

// === VALIDATION GUARD HELPERS ===
const isRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);

const isBooking = (x: unknown): x is BookingView =>
  isRecord(x) &&
  typeof x.reference_code === 'string' &&
  /^AB-[A-Z0-9-]{8,}$/.test(x.reference_code) &&
  Number.isInteger(x.barber_id) &&
  Number(x.barber_id) > 0 &&
  Number.isInteger(x.service_id) &&
  Number(x.service_id) > 0 &&
  typeof x.starts_at === 'string' &&
  !Number.isNaN(Date.parse(x.starts_at)) &&
  typeof x.ends_at === 'string' &&
  !Number.isNaN(Date.parse(x.ends_at)) &&
  typeof x.status === 'string' &&
  Number.isInteger(x.price_idr) &&
  Number(x.price_idr) >= 0;

const isStored = (x: unknown): x is StoredApiTicket =>
  isBooking(x) &&
  'access_token' in x &&
  typeof x.access_token === 'string' &&
  x.access_token.length >= 16;

// === STORAGE OPERATIONS ===
export function readApiTickets(): StoredApiTicket[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(API_TICKETS_STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(isStored).slice(0, 10) : [];
  } catch {
    return [];
  }
}

/** Token is local to this browser tab/session. The database remains authoritative. */
export function saveApiTickets(items: StoredApiTicket[]): boolean {
  try {
    sessionStorage.setItem(API_TICKETS_STORAGE_KEY, JSON.stringify(items.slice(0, 10)));
    return true;
  } catch {
    return false;
  }
}

// === CORE API FUNCTIONS ===
function baseUrl(): string {
  const raw: unknown = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw !== 'string') throw new BookingApiError('URL backend belum dikonfigurasi.', 0);

  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
      throw Error('bad origin');
    }
    return url.origin;
  } catch {
    throw new BookingApiError(
      'VITE_API_BASE_URL harus origin HTTP(S), contohnya http://127.0.0.1:8000.',
      0
    );
  }
}

async function request(
  path: string,
  method: 'GET' | 'POST',
  token?: string,
  body?: BookingPayload
): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method,
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'X-Booking-Token': token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      let detail: string | undefined;
      try {
        const json: unknown = await response.json();
        if (isRecord(json) && typeof json.detail === 'string') {
          detail = json.detail.slice(0, 180);
        }
      } catch {
        /* keep the generic message */
      }
      throw new BookingApiError(
        detail || `Backend mengembalikan HTTP ${response.status}.`,
        response.status
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch {
      throw new BookingApiError(
        'Backend berhasil merespons tetapi data tiket tidak dapat dibaca. Periksa PostgreSQL sebelum mengulang.',
        response.status,
        method === 'POST' && !token
      );
    }
  } catch (err: unknown) {
    if (err instanceof BookingApiError) throw err;

    // For POST /bookings: network timeout may occur after the backend already committed.
    const uncertain = method === 'POST' && !token;
    const reason = controller.signal.aborted
      ? 'Permintaan melebihi 10 detik.'
      : 'Gagal menghubungi FastAPI.';

    throw new BookingApiError(
      `${reason}${
        uncertain
          ? ' Status transaksi belum pasti; periksa database sebelum membuat ulang.'
          : ''
      }`,
      0,
      uncertain
    );
  } finally {
    window.clearTimeout(timer);
  }
}

function requireBooking(value: unknown, context: string): BookingView {
  if (!isBooking(value)) {
    throw new BookingApiError(
      `Format respons ${context} tidak sesuai kontrak backend.`,
      0,
      context === 'pembuatan tiket'
    );
  }
  return value;
}

export async function createApiBooking(body: BookingPayload): Promise<StoredApiTicket> {
  const raw = await request('/api/v1/bookings', 'POST', undefined, body);
  const view = requireBooking(raw, 'pembuatan tiket');

  if (!isRecord(raw) || typeof raw.access_token !== 'string' || raw.access_token.length < 16) {
    throw new BookingApiError(
      'Tiket mungkin tersimpan tetapi access_token tidak ditemukan. Jangan langsung mengulang; periksa database.',
      0,
      true
    );
  }

  if (
    view.barber_id !== body.barber_id ||
    view.service_id !== body.service_id ||
    Date.parse(view.starts_at) !== Date.parse(body.starts_at)
  ) {
    throw new BookingApiError(
      'Respons tiket berbeda dari pilihan awal. Periksa database sebelum mengulang.',
      0,
      true
    );
  }

  return { ...view, access_token: raw.access_token };
}

function safeCode(code: string): string {
  if (!/^AB-[A-Z0-9-]{8,}$/.test(code)) throw new BookingApiError('Kode reservasi tidak valid.', 0);
  return encodeURIComponent(code);
}

export async function getApiBooking(ticket: StoredApiTicket): Promise<BookingView> {
  const raw = await request(
    `/api/v1/bookings/${safeCode(ticket.reference_code)}`,
    'GET',
    ticket.access_token
  );
  const view = requireBooking(raw, 'detail tiket');

  if (view.reference_code !== ticket.reference_code) {
    throw new BookingApiError('Kode tiket backend tidak cocok.', 0);
  }
  return view;
}

export async function cancelApiBooking(ticket: StoredApiTicket): Promise<BookingView> {
  const raw = await request(
    `/api/v1/bookings/${safeCode(ticket.reference_code)}/cancel`,
    'POST',
    ticket.access_token
  );
  const view = requireBooking(raw, 'pembatalan');

  if (view.reference_code !== ticket.reference_code || view.status !== 'cancelled') {
    throw new BookingApiError('Pembatalan belum terkonfirmasi oleh API.', 0);
  }
  return view;
}

export function describeApiError(err: unknown): string {
  if (err instanceof BookingApiError) {
    if (err.status === 409) {
      return `Konflik reservasi (HTTP 409): ${err.message}. Perbarui pilihan waktu atau periksa status tiket.`;
    }
    if (err.status === 403) {
      return 'Token akses tiket ditolak (HTTP 403). Token mungkin tidak lagi berlaku setelah secret backend diubah.';
    }
    if (err.status === 404) return 'Tiket tidak ditemukan di PostgreSQL (HTTP 404).';
    if (err.status === 422) return `Data ditolak backend (HTTP 422): ${err.message}`;
    return err.message;
  }
  return 'Terjadi kesalahan pada proses reservasi.';
}
