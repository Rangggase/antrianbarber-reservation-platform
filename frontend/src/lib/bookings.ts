import { findService, type ServiceId } from '../data/services';
import type { BarberChoice } from '../data/barbers';

export const STORAGE_KEY = 'antrian-barber-demo-bookings-v2-1';
export type Booking = {
  id: string;
  seq: number;
  ticket: string;
  name?: string;
  phone?: string;
  service?: ServiceId;
  barber?: BarberChoice;
  date: string;
  time?: string;
  notes?: string;
  status: 'active' | 'cancelled';
  createdAt?: string;
};
export type BookingInput = {
  name: string;
  phone: string;
  service: ServiceId;
  barber?: BarberChoice;
  date: string;
  time: string;
  notes: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}
export function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[\s().-]/g, '');
  if (cleaned.startsWith('+62')) return `0${cleaned.slice(3)}`;
  if (cleaned.startsWith('62')) return `0${cleaned.slice(2)}`;
  return cleaned;
}
export function availableTimes(date: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const today = localDate(now);
  if (date < today || date > localDate(addDays(now, 30))) return [];
  const slots: string[] = [];
  for (let h = 9; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 19 && m === 30) continue;
      const slot = `${pad(h)}:${pad(m)}`;
      if (date === today && new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime() < now.getTime() + 30 * 60_000) continue;
      slots.push(slot);
    }
  }
  return slots;
}
export function validDate(date: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  if (localDate(new Date(y, m - 1, d)) !== date) return false;
  return date >= localDate(now) && date <= localDate(addDays(now, 30));
}
export function readBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((b): b is Booking => !!b && typeof b === 'object' &&
      typeof b.id === 'string' && typeof b.date === 'string' &&
      (b.status === 'active' || b.status === 'cancelled') &&
      typeof b.seq === 'number' && Number.isFinite(b.seq) && typeof b.ticket === 'string');
  } catch { return []; }
}
export function saveBookings(bookings: Booking[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)); return true; }
  catch { return false; }
}
export function activeBookings(bookings: Booking[], today = localDate()) {
  return bookings.filter(b => b.status === 'active' && b.date >= today && !!findService(b.service ?? '')).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}
export function createBooking(bookings: Booking[], input: BookingInput): Booking {
  const seq = bookings.filter(b => b.date === input.date).reduce((max, b) => Math.max(max, b.seq || 0), 0) + 1;
  return {
    ...input,
    id: crypto.randomUUID(),
    seq,
    ticket: `AB-${String(seq).padStart(3, '0')}`,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}
