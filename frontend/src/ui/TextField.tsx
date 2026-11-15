import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id?: string;
  label: string;
  /** Persistent helper text under the field (not a placeholder). */
  hint?: ReactNode;
  /** Say what is wrong and how to fix it. Shown with an icon so it never relies on colour alone. */
  error?: string;
};

export function TextField({ id, label, hint, error, required, className, ...input }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={['ds-field', className].filter(Boolean).join(' ')}>
      <label className="ds-label" htmlFor={fieldId}>
        {label}
        {required && <span className="ds-req" aria-hidden="true"> *</span>}
      </label>
      <input id={fieldId} className="ds-input" required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && <p id={hintId} className="ds-hint">{hint}</p>}
      {error && (
        <p id={errorId} className="ds-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
