import { BadgeCheck, Check, Clock, Scissors, UserX, X, type LucideIcon } from 'lucide-react';
import { STATUS_LABEL, type BookingStatus } from '../api/staff';

const ICON: Record<BookingStatus, LucideIcon> = {
  pending: Clock,
  confirmed: BadgeCheck,
  in_service: Scissors,
  completed: Check,
  cancelled: X,
  no_show: UserX,
};

const TONE: Record<BookingStatus, 'warn' | 'success' | 'progress' | 'neutral' | 'danger'> = {
  pending: 'warn',
  confirmed: 'success',
  in_service: 'progress',
  completed: 'neutral',
  cancelled: 'danger',
  no_show: 'danger',
};

/** Always icon + text + colour: the status is never conveyed by colour alone. */
export function StatusBadge({ status }: { status: BookingStatus }) {
  const Icon = ICON[status];
  return (
    <span className={`ds-badge ds-badge--${TONE[status]}`}>
      <Icon size={16} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}
