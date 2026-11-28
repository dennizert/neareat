import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useToastStore } from '../store/toastStore';
import type { ReservationStatus } from '../types';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';
const ALERT_ICON: Record<AlertTone, string> = { info: 'info', success: 'check-circle', warning: 'alert', danger: 'x-circle' };

/** Hata `role="alert"`, bilgi `role="status"` (BILESENLER §2). */
export function Alert({ tone = 'info', title, children, action, icon }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: string }) {
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status';
  return (
    <div className={`alert${tone === 'info' ? '' : ` alert-${tone}`}`} role={role}>
      <Icon name={icon ?? ALERT_ICON[tone]} />
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
      {action && <div className="alert-action">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'info', title, children, action, tone }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode; tone?: 'danger' | 'success' | 'warning' }) {
  const style = tone ? { color: `var(--${tone})`, background: `var(--${tone}-bg)` } : undefined;
  return (
    <div className="empty">
      <div className="empty-icon" style={style}><Icon name={icon} /></div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ width = '100%', height }: { width?: string; height?: string }) {
  return <div className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

/** Yükleniyor iskeleti: birkaç satır + ekran okuyucu için metin. */
export function SkeletonBlock({ rows = 5, label = 'Yükleniyor…' }: { rows?: number; label?: string }) {
  const widths = ['40%', '90%', '75%', '85%', '60%', '95%'];
  return (
    <div className="card stack" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} width={widths[i % widths.length]} />)}
    </div>
  );
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'priority' | 'neutral';

export function StatusBadge({ tone, children, noDot }: { tone: BadgeTone; children: ReactNode; noDot?: boolean }) {
  const cls = ['badge', tone !== 'neutral' && `badge-${tone}`, noDot && 'no-dot'].filter(Boolean).join(' ');
  return <span className={cls}>{children}</span>;
}

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Bekliyor', tone: 'warning' },
  CONFIRMED: { label: 'Onaylı', tone: 'success' },
  COMPLETED: { label: 'Tamamlandı', tone: 'info' },
  REJECTED: { label: 'Reddedildi', tone: 'danger' },
  CANCELLED: { label: 'İptal edildi', tone: 'neutral' },
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const s = RESERVATION_STATUS[status] ?? { label: status, tone: 'neutral' as const };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function ToastRegion() {
  const items = useToastStore((s) => s.items);
  return (
    <div className="toast-region" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast" role="status">
          {t.tone === 'success' && <Icon name="check-circle" />}
          {t.tone === 'error' && <Icon name="x-circle" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/** Kart içi küçük boş satır (tablo yerine). */
export function DataTableEmpty({ children }: { children: ReactNode }) {
  return <p className="subtle" style={{ padding: 'var(--space-5)' }}>{children}</p>;
}

/** Ağ/5xx hata durumu + "Tekrar dene". */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card">
      <EmptyState icon="x-circle" tone="danger" title="Yüklenemedi" action={onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>Tekrar dene</button>
      )}>
        {message}
      </EmptyState>
    </div>
  );
}

/** `SUBSCRIPTION_REQUIRED` kilit durumu — Faz 1'de ödeme yönlendirmesi yok (V7, §4-8). */
export function SubscriptionLocked({ feature }: { feature: string }) {
  return (
    <div className="card">
      <EmptyState icon="lock" tone="danger" title="Abonelik gerekli">
        {feature} aktif abonelik ya da deneme süresi gerektirir. Abonelik işlemleri yakında web panelinden yapılabilecek.
      </EmptyState>
    </div>
  );
}
