import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { buttonClass, type ButtonOptions } from './buttonClass';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & ButtonOptions & {
  /** While true the button keeps focus (aria-disabled, not disabled) but ignores clicks. */
  loading?: boolean;
  loadingLabel?: ReactNode;
};

/** One primary button per surface. On an ink surface (.ds-on-ink) the primary variant inverts automatically. */
export function Button({ variant, compact, full, loading = false, loadingLabel, className, children, type = 'button', onClick, ...rest }: Props) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) { event.preventDefault(); return; }
    onClick?.(event);
  };
  return (
    <button
      type={type}
      className={buttonClass({ variant, compact, full }, className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest.disabled || undefined}
      onClick={handleClick}
      {...rest}
    >
      {loading && <LoaderCircle className="ds-btn__spinner" size={18} aria-hidden="true" />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
