import { cloneElement, isValidElement, useState, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  /** Tek kontrol (input/select/textarea). `id`, `aria-invalid`, `aria-describedby` eklenir. */
  children: ReactElement<Record<string, unknown>>;
}

/** BILESENLER §2 "Alan": hata `aria-invalid="true"` + `aria-describedby` hata metnine. */
export function Field({ id, label, hint, error, optional, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, hintId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? 'true' : children.props['aria-invalid'],
        'aria-describedby': describedBy,
      })
    : children;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
        {optional && <span className="opt"> (isteğe bağlı)</span>}
      </label>
      {control}
      {error && (
        <span className="error-text" id={errId}>
          <Icon name="alert" />
          {error}
        </span>
      )}
      {hint && <span className="hint" id={hintId}>{hint}</span>}
    </div>
  );
}

/** Şifre alanı + göster/gizle (`aria-pressed`). `Field` içinde kullanılır. */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group">
      <input {...props} className="input" type={show ? 'text' : 'password'} />
      <button
        type="button"
        className="input-action"
        aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
      >
        <Icon name="eye" />
      </button>
    </div>
  );
}
