import type { ReactNode } from 'react';
import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';

export type NoticeVariant = 'info' | 'success' | 'warning' | 'danger';

const ICON: Record<NoticeVariant, LucideIcon> = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: OctagonAlert };

type Props = {
  variant?: NoticeVariant;
  /** A short headline. Errors: say what happened. */
  title?: string;
  /** Errors: say how to recover. */
  children?: ReactNode;
  /** A recovery action, e.g. a "Coba lagi" button. */
  action?: ReactNode;
};

export function Notice({ variant = 'info', title, children, action }: Props) {
  const Icon = ICON[variant];
  return (
    <div className={`ds-notice ds-notice--${variant}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon className="ds-notice__icon" size={20} aria-hidden="true" />
      <div className="ds-notice__body">
        {title && <strong className="ds-notice__title">{title}</strong>}
        {children}
      </div>
      {action && <div className="ds-notice__action">{action}</div>}
    </div>
  );
}
