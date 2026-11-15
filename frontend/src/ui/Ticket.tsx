type Props = {
  brand?: string;
  /** Pre-formatted, e.g. "Sen 16 Nov". */
  dateLabel: string;
  service: string;
  barber: string;
  /** Pre-formatted time, e.g. "14.30". Shown large until a queue number exists. */
  time: string;
  /** Pre-formatted price, e.g. "Rp 75.000". */
  price: string;
  /** Assigned when the barber confirms the booking. Null/undefined until then. */
  queueNumber?: number | null;
  code?: string;
  /** e.g. "2 antrean di depan, ±90 menit". Only meaningful once confirmed. */
  waitNote?: string;
  /** Play the "printing" entrance once (the single orchestrated motion; disabled by prefers-reduced-motion). */
  animate?: boolean;
  className?: string;
};

/**
 * The queue ticket. Before confirmation the big number is the TIME and "Nomor antre" is empty, because the
 * queue number is only issued when the barber confirms. Afterwards the big number becomes the queue number.
 */
export function Ticket({ brand = 'Antrian Barber', dateLabel, service, barber, time, price, queueNumber, code, waitNote, animate = false, className }: Props) {
  const confirmed = typeof queueNumber === 'number';
  const classes = ['ds-ticket', animate && 'ds-ticket--print', className].filter(Boolean).join(' ');
  return (
    <section className={classes} aria-label={`Karcis antrean: ${service}, ${time}`}>
      <div className="ds-ticket__head">
        <div className="ds-ticket__brand"><span>{brand}</span><span className="ds-num">{dateLabel}</span></div>
        <p className="ds-ticket__service">{service}</p>
        <p className="ds-ticket__who">{confirmed ? `${barber} · ${time}` : barber}</p>
      </div>
      <div className="ds-ticket__perf" aria-hidden="true"><i className="ds-ticket__notch" /></div>
      <div className="ds-ticket__stub">
        <span className="ds-ticket__big ds-num">{confirmed ? String(queueNumber).padStart(2, '0') : time}</span>
        <span className="ds-ticket__price ds-num">{price}</span>
        <div className="ds-ticket__row">
          <span>{confirmed ? 'Nomor antre' : 'Nomor antre belum terbit'}</span>
          <b className="ds-num">{confirmed ? (waitNote ?? '') : 'Diberikan saat barber mengonfirmasi'}</b>
        </div>
        {code && <span className="ds-ticket__code ds-num">{code}</span>}
      </div>
    </section>
  );
}
