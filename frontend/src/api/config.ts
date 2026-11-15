/**
 * Data-source switches, resolved at build time (Vite env).
 *
 * - VITE_DATA_SOURCE=api|demo         one switch for everything (default: demo)
 * - VITE_CATALOG_SOURCE               overrides the switch for services/barbers
 * - VITE_BOOKING_AVAILABILITY_SOURCE  overrides the switch for slot availability
 * - VITE_BOOKING_TRANSACTIONS_SOURCE  overrides the switch for create/cancel booking
 *
 * A specific variable wins over VITE_DATA_SOURCE. Works in both `vite dev` and
 * production builds. Never put secrets in VITE_* variables: they ship to the browser.
 */
function fromApi(specific: unknown): boolean {
  const general: unknown = import.meta.env.VITE_DATA_SOURCE;
  const value = typeof specific === 'string' && specific !== '' ? specific : general;
  return value === 'api';
}

export const catalogFromApi = fromApi(import.meta.env.VITE_CATALOG_SOURCE);
export const availabilityFromApi = fromApi(import.meta.env.VITE_BOOKING_AVAILABILITY_SOURCE);
export const bookingsFromApi = fromApi(import.meta.env.VITE_BOOKING_TRANSACTIONS_SOURCE);

/** The staff area talks to the backend, so it only works when some data source is the API. */
export const anyApiMode = catalogFromApi || availabilityFromApi || bookingsFromApi;

/** Backend origin from VITE_API_BASE_URL (validated: http(s), no path). */
export function apiOrigin(): string {
  const raw: unknown = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('VITE_API_BASE_URL belum diatur.');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('VITE_API_BASE_URL bukan URL yang valid.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_API_BASE_URL harus berupa origin HTTP(S), contoh http://127.0.0.1:8000.');
  }
  return url.origin;
}
