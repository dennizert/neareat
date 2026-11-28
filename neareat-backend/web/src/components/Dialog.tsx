import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Verilirse gövde+alt bilgi bir `<form>` içine alınır (Enter ile gönderim). */
  onSubmit?: () => void;
  hideClose?: boolean;
}

/**
 * Yerel `<dialog>` + `showModal()`: odak kapanı, Esc ve arka perde tarayıcıdan gelir
 * (BILESENLER §2 "Katman"). 480px altında CSS alttan açılan sayfa yapar.
 */
export function Dialog({ open, title, onClose, children, footer, onSubmit, hideClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit?.();
  }

  const header = (
    <div className="modal-header">
      <h2 id={titleId} style={{ fontSize: 'var(--fs-lg)' }}>{title}</h2>
      {!hideClose && <Button variant="ghost" iconOnly aria-label="Kapat" onClick={onClose}><Icon name="x" /></Button>}
    </div>
  );
  const body = (
    <>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </>
  );

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
    >
      {open && (onSubmit ? (
        <form onSubmit={handleSubmit} noValidate>{header}{body}</form>
      ) : (
        <>{header}{body}</>
      ))}
    </dialog>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Onayla', tone = 'primary', busy, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={onConfirm}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button variant={tone} type="submit" loading={busy}>{confirmLabel}</Button>
        </>
      )}
    >
      {typeof message === 'string' ? <p className="muted">{message}</p> : message}
    </Dialog>
  );
}
