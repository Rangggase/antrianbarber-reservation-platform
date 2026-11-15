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
