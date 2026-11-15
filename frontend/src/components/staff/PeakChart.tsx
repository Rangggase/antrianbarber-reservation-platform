export type PeakPoint = { hour: number; count: number };

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/**
 * Busiest hours as columns with the value printed on each column (no colour-only reading).
 * The same numbers are available as a table inside <details>.
 */
export function PeakChart({ points }: { points: PeakPoint[] }) {
  const max = Math.max(1, ...points.map(p => p.count));
  return (
    <>
      <ul className="staff-columns">
        {points.map(p => (
          <li key={p.hour} className="staff-col">
            <span className="staff-col__value ds-num">{p.count}</span>
            <span className="staff-col__track" aria-hidden="true">
              <span className="staff-col__bar" style={{ height: `${(p.count / max) * 100}%` }} />
            </span>
            <span className="staff-col__label ds-num">{hourLabel(p.hour)}</span>
          </li>
        ))}
      </ul>
      <details className="staff-details">
        <summary>Lihat sebagai tabel</summary>
        <table className="staff-table">
          <thead><tr><th scope="col">Jam</th><th scope="col">Reservasi</th></tr></thead>
          <tbody>{points.map(p => <tr key={p.hour}><th scope="row">{hourLabel(p.hour)}</th><td data-label="Reservasi">{p.count}</td></tr>)}</tbody>
        </table>
      </details>
    </>
  );
}
