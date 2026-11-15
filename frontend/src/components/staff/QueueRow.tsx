import { Phone } from 'lucide-react';
import { slotLabel } from '../../api/availability';
import { formatRupiah } from '../../data/services';
import { ACTION_LABEL, type BookingStatus, type StaffBooking } from '../../api/staff';
import { StatusBadge } from '../../ui';

type Props = {
  booking: StaffBooking;
  isAdmin: boolean;
  /** Reference of the booking whose action is running, or null. Every action waits while one runs. */
  busyRef: string | null;
  onAct: (booking: StaffBooking, status: BookingStatus) => void;
};

/** One reservation: time and queue number, customer with a tel link, service, status, and the allowed actions. */
export function QueueRow({ booking, isAdmin, busyRef, onAct }: Props) {
  return (
    <li className={`staff-row status-${booking.status}`}>
      <div className="staff-row__time">
        <strong className="ds-num">{slotLabel(booking.starts_at)}</strong>
        <span>{booking.queue_number ? `Antrean #${booking.queue_number}` : 'Belum diberi nomor'}</span>
      </div>
      <div className="staff-row__info">
        <strong>{booking.customer_name}</strong>
        <a href={`tel:${booking.customer_phone}`} className="staff-phone"><Phone size={16} aria-hidden="true" /> {booking.customer_phone}</a>
        <span>{booking.service_name} · {formatRupiah(booking.price_idr)}{isAdmin ? ` · ${booking.barber_name}` : ''}</span>
        <small className="staff-ref">{booking.reference_code}</small>
      </div>
      <div className="staff-row__status"><StatusBadge status={booking.status} /></div>
      <div className="staff-actions">
        {booking.allowed_next.map(next => (
          <button key={next} type="button" className={`staff-action action-${next}`} disabled={busyRef !== null}
            aria-label={`${ACTION_LABEL[next]} — ${booking.customer_name}`} onClick={() => onAct(booking, next)}>
            {busyRef === booking.reference_code ? '…' : ACTION_LABEL[next]}
          </button>
        ))}
      </div>
    </li>
  );
}
