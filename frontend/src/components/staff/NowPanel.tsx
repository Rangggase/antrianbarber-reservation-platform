import type { BookingStatus, StaffBooking } from '../../api/staff';

type Props = {
  barberName: string;
  /** The booking being served now, if any. */
  current?: StaffBooking;
  /** The next confirmed booking in queue order. */
  next?: StaffBooking;
  busy: boolean;
  onAct: (booking: StaffBooking, status: BookingStatus) => void;
};

const numberText = (booking: StaffBooking) => (booking.queue_number ? `No. ${booking.queue_number}` : 'Belum ada nomor');

/**
 * "Sekarang": who is in the chair and who is next, for one barber. Derived from the queue already loaded,
 * so no extra request. Its buttons use a "Sekarang:" prefix in their name so they never collide with the
 * same action on the queue row below.
 */
export function NowPanel({ barberName, current, next, busy, onAct }: Props) {
  const headingId = `now-${barberName.toLowerCase().replace(/\s+/g, '-')}`;
  const canFinish = current?.allowed_next.includes('completed');
  const canStart = !current && next?.allowed_next.includes('in_service');
  return (
    <section className="staff-now" aria-labelledby={headingId}>
      <h2 id={headingId} className="staff-now__barber">Sekarang · {barberName}</h2>
      {current ? (
        <>
          <p className="staff-now__state">Sedang dilayani</p>
          <p className="staff-now__number ds-num">{numberText(current)}</p>
          <p className="staff-now__who">{current.customer_name} · {current.service_name}</p>
          {canFinish && (
            <button type="button" className="staff-action staff-now__action" disabled={busy}
              aria-label={`Sekarang: Selesai — ${current.customer_name}`} onClick={() => onAct(current, 'completed')}>Selesai</button>
          )}
        </>
      ) : (
        <p className="staff-now__state">Tidak ada yang dilayani</p>
      )}
      {next && (
        <div className="staff-now__next">
          <p>Berikutnya: {numberText(next)} · {next.customer_name}</p>
          {canStart && (
            <button type="button" className="staff-action staff-now__action" disabled={busy}
              aria-label={`Sekarang: Mulai layanan — ${next.customer_name}`} onClick={() => onAct(next, 'in_service')}>Mulai layanan</button>
          )}
        </div>
      )}
    </section>
  );
}
