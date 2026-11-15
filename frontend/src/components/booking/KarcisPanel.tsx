import type { ReactNode } from 'react';
import { Ticket } from '../../ui';

type Props = {
  dateLabel: string;
  service: string;
  barber: string;
  time: string;
  price: string;
  /** Demo disclosure, kept beside the ticket so the form itself stays uncluttered. */
  note: ReactNode;
};

/** The live ticket: it shows every choice as the customer makes it. Queue number is not issued yet. */
export function KarcisPanel({ dateLabel, service, barber, time, price, note }: Props) {
  return (
    <aside className="bk-karcis" aria-label="Karcis kamu">
      <Ticket dateLabel={dateLabel} service={service} barber={barber} time={time} price={price} />
      <p className="bk-karcis__note">{note}</p>
    </aside>
  );
}
