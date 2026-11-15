type ServiceProps = {
  category: string;
  name: string;
  description: string;
  price: string;
  duration: number;
  selected: boolean;
  onSelect: () => void;
};

export function ServiceCard({ category, name, description, price, duration, selected, onSelect }: ServiceProps) {
  return (
    <button type="button" className="bk-choice" aria-pressed={selected} onClick={onSelect}>
      <span className="bk-choice__tag">{category}</span>
      <span className="bk-choice__name">{name}</span>
      <span className="bk-choice__desc">{description}</span>
      <span className="bk-choice__meta">
        <b className="bk-choice__price">{price}</b>
        <small>±{duration} menit</small>
      </span>
    </button>
  );
}

type BarberProps = {
  initial: string;
  name: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
};

export function BarberCard({ initial, name, detail, selected, onSelect }: BarberProps) {
  return (
    <button type="button" className="bk-choice bk-choice--row" aria-pressed={selected} onClick={onSelect}>
      <span className="bk-choice__initial" aria-hidden="true">{initial}</span>
      <span className="bk-choice__text">
        <span className="bk-choice__name">{name}</span>
        <span className="bk-choice__desc">{detail}</span>
      </span>
    </button>
  );
}
