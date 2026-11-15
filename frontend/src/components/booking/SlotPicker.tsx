type Props = {
  times: string[];
  value: string;
  /** Occupied slots stay visible but disabled, and say "Penuh" in text (not colour alone). */
  isOccupied: (time: string) => boolean;
  onSelect: (time: string) => void;
  emptyText: string;
};

const PERIODS = ['Pagi', 'Siang', 'Sore'] as const;

function periodOf(time: string) {
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? 'Pagi' : hour < 15 ? 'Siang' : 'Sore';
}

/** Time slots grouped Pagi / Siang / Sore, each a button of at least 44px. */
export function SlotPicker({ times, value, isOccupied, onSelect, emptyText }: Props) {
  return (
    <div className="bk-slots" role="group" aria-label="Jam preferensi" id="bk-slots" tabIndex={-1}>
      {times.length === 0 && <p className="bk-empty">{emptyText}</p>}
      {PERIODS.map(period => {
        const items = times.filter(time => periodOf(time) === period);
        if (!items.length) return null;
        return (
          <div key={period} className="bk-slot-group">
            <p className="bk-period">{period}</p>
            <div className="bk-slot-grid">
              {items.map(time => {
                const occupied = isOccupied(time);
                return (
                  <button
                    key={time}
                    type="button"
                    className="bk-slot"
                    aria-pressed={value === time}
                    disabled={occupied}
                    title={occupied ? 'Sudah dipakai pada karcis demo di browser ini' : 'Jam preferensi'}
                    onClick={() => onSelect(time)}
                  >
                    <span>{time}</span>
                    {occupied && <small>Penuh</small>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
