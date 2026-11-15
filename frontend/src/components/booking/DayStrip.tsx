import { dayOfMonth, weekdayShort } from './dates';

type Props = {
  /** Consecutive local dates, first one is today. */
  days: string[];
  value: string;
  onChange: (iso: string) => void;
};

/** Horizontal strip of the next days; the native date input stays as the fallback for dates further away. */
export function DayStrip({ days, value, onChange }: Props) {
  return (
    <div className="bk-days" role="group" aria-label="Pilih hari">
      {days.map((iso, index) => (
        <button
          key={iso}
          type="button"
          className="bk-day"
          aria-pressed={value === iso}
          onClick={() => onChange(iso)}
        >
          <span className="bk-day__label">{index === 0 ? 'Hari ini' : index === 1 ? 'Besok' : weekdayShort(iso)}</span>
          <span className="bk-day__num">{dayOfMonth(iso)}</span>
        </button>
      ))}
    </div>
  );
}
