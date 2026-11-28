import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'google';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  block?: boolean;
  /** Yükleniyor: `aria-busy`, metin gizli, tıklama/gönderim İKİNCİ kez tetiklenmez. */
  loading?: boolean;
  icon?: string;
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary', size = 'md', block, loading, icon, iconOnly, className, onClick, type = 'button', children, ...rest
}: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', iconOnly && 'btn-icon', className]
    .filter(Boolean).join(' ');
  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      e.preventDefault(); // submit butonunda formu da durdurur
      return;
    }
    onClick?.(e);
  }
  return (
    <button
      {...rest}
      type={type}
      className={cls}
      onClick={handleClick}
      aria-busy={loading ? 'true' : undefined}
      aria-disabled={loading ? 'true' : rest['aria-disabled']}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
