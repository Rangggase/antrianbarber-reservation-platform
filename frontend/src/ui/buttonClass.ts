export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonOptions = { variant?: ButtonVariant; compact?: boolean; full?: boolean };

/** Class names for links that must look like buttons (e.g. react-router <Link>). */
export function buttonClass({ variant = 'primary', compact = false, full = false }: ButtonOptions = {}, extra?: string): string {
  return ['ds-btn', `ds-btn--${variant}`, compact && 'ds-btn--compact', full && 'ds-btn--full', extra].filter(Boolean).join(' ');
}
