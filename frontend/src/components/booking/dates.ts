/** Local-noon Date from a YYYY-MM-DD string, so weekday and day never shift across time zones. */
const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const weekdayShort = (iso: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(parseIso(iso));
export const dayOfMonth = (iso: string) => String(parseIso(iso).getDate());
/** e.g. "Sen 16 Nov", the date line printed on the karcis. */
export const shortDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseIso(iso));
