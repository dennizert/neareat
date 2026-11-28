import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/AuthLayout';
import { Icon } from '../components/Icon';
import { Alert, DataTableEmpty, ErrorState, ReservationStatusBadge, SkeletonBlock, StatusBadge } from '../components/Feedback';
import { DataTable } from '../components/DataTable';
import { getRestaurantStats } from '../services/restaurantAccount';
import { getRestaurantReservations } from '../services/reservations';
import { getSubscription } from '../services/subscriptions';
import { getErrorMessage } from '../api/client';
import { useCountsStore } from '../store/countsStore';
import { formatDateLong, formatDecimal, toIsoDay } from '../utils/format';
import { trialDaysLeft } from '../utils/occupancyBand';
import type { Reservation, RestaurantStats, Subscription } from '../types';

const QUICK = [
  { to: '/rezervasyonlar', icon: 'calendar', label: 'Rezervasyonlar' },
  { to: '/doluluk', icon: 'gauge', label: 'Doluluk' },
  { to: '/bilgiler', icon: 'store', label: 'Bilgiler' },
  { to: '/saatler', icon: 'clock', label: 'Çalışma saatleri' },
  { to: '/menu', icon: 'book', label: 'Menü' },
  { to: '/yorumlar', icon: 'star', label: 'Yorumlar' },
  { to: '/indirim', icon: 'tag', label: 'İndirim' },
  { to: '/kampanya', icon: 'megaphone', label: 'Kampanya' },
  { to: '/analitik', icon: 'trend', label: 'Analitik' },
];

/** Abonelik banner'ı kararı (saf): trial → kalan gün; aktif değil → kilit bilgisi. */
export function subscriptionBanner(sub: Subscription | null, now = new Date()): { kind: 'trial'; days: number } | { kind: 'inactive' } | null {
  if (sub && sub.status === 'trial') {
    const d = trialDaysLeft(sub.expiresAt, now);
    if (d && d > 0) return { kind: 'trial', days: d };
    return { kind: 'inactive' };
  }
  const active = !!sub && ['active', 'cancelled'].includes(sub.status) && !!sub.expiresAt && new Date(sub.expiresAt).getTime() > now.getTime();
  return active ? null : { kind: 'inactive' };
}

export default function OverviewPage() {
  const [stats, setStats] = useState<RestaurantStats | null>(null);
  const [pending, setPending] = useState<Reservation[]>([]);
  const [today, setToday] = useState<Reservation[]>([]);
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setPendingCount = useCountsStore((s) => s.setPending);
  const todayIso = toIsoDay(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, t, sb] = await Promise.all([
        getRestaurantStats(),
        getRestaurantReservations('PENDING'),
        getRestaurantReservations(undefined, todayIso),
        getSubscription().catch(() => undefined),
      ]);
      setStats(s);
      setPending(p);
      setPendingCount(p.length);
      setToday(t.filter((r) => r.status !== 'CANCELLED' && r.status !== 'REJECTED'));
      setSub(sb);
    } catch (err) {
      setError(getErrorMessage(err, 'Özet yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [todayIso, setPendingCount]);

  useEffect(() => { load(); }, [load]);

  const banner = sub === undefined ? null : subscriptionBanner(sub);
  const priorityCount = pending.filter((r) => r.isPriority).length;
  const todayGuests = today.reduce((n, r) => n + (r.guestCount || 0), 0);

  return (
    <>
      <PageHeader
        title="Genel bakış"
        description={formatDateLong(new Date())}
        action={<Link className="btn btn-primary" to="/rezervasyonlar?durum=PENDING"><Icon name="calendar" />Bekleyen talepler ({pending.length})</Link>}
      />
      {loading ? <SkeletonBlock /> : error ? <ErrorState message={error} onRetry={load} /> : (
        <>
          {banner && (
            <div className="section">
              {banner.kind === 'trial' ? (
                <Alert tone="warning" icon="clock" title={`Ücretsiz denemenizin bitmesine ${banner.days} gün kaldı.`}>
                  Deneme sonunda abonelik 1.299,90 ₺/ay'dır. Web'den abonelik yakında açılacak.
                </Alert>
              ) : (
                <Alert tone="danger" icon="lock" title="Aboneliğiniz aktif değil.">
                  Rezervasyon onayı, indirim, kampanya ve analitik kapalı. Restoranınız listede görünmeye devam eder.
                </Alert>
              )}
            </div>
          )}
          <div className="section grid grid-stats">
            <div className="stat"><div className="stat-label">Bugünkü rezervasyon</div><div className="stat-value">{today.length}</div><div className="stat-meta">{todayGuests} kişi</div></div>
            <Link to="/rezervasyonlar?durum=PENDING" className="stat" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="stat-label">Bekleyen talep</div><div className="stat-value">{pending.length}</div>
              <div className="stat-meta">{priorityCount > 0 ? <StatusBadge tone="priority">{priorityCount} öncelikli</StatusBadge> : 'Tümünü gör'}</div>
            </Link>
            <div className="stat"><div className="stat-label">Eatlas puanı</div><div className="stat-value">{stats?.avgRating ? formatDecimal(stats.avgRating) : '—'}</div><div className="stat-meta">{stats?.reviews ?? 0} yorum</div></div>
            <div className="stat"><div className="stat-label">Favori</div><div className="stat-value">{stats?.favorites ?? 0}</div><div className="stat-meta">{stats?.recommendations ?? 0} öneri</div></div>
          </div>
          <div className="section grid grid-2">
            <div className="card card-flush">
              <div className="card-header" style={{ padding: 'var(--space-4) var(--space-5) 0' }}><h2 className="card-title">Bugün</h2><Link to={`/rezervasyonlar?durum=ALL&tarih=${todayIso}`} className="subtle" style={{ color: 'var(--text-link)' }}>Tümünü gör</Link></div>
              {today.length === 0 ? <DataTableEmpty>Bugün için rezervasyon yok.</DataTableEmpty> : (
                <DataTable
                  caption="Bugünkü rezervasyonlar"
                  rows={today}
                  rowKey={(r) => r.id}
                  columns={[
                    { key: 'g', header: 'Misafir', render: (r) => <><Link className="cell-title" to={`/rezervasyonlar/${r.id}`}>{r.user?.displayName}</Link>{r.isPriority && <> <StatusBadge tone="priority">Öncelikli</StatusBadge></>}</> },
                    { key: 't', header: 'Saat', className: 'num', render: (r) => r.time },
                    { key: 'k', header: 'Kişi', className: 'num', render: (r) => r.guestCount },
                    { key: 's', header: 'Durum', render: (r) => <ReservationStatusBadge status={r.status} /> },
                  ]}
                />
              )}
            </div>
            <div className="card">
              <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Hızlı erişim</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 'var(--space-2)' }}>
                {QUICK.map((q) => (
                  <Link key={q.to} className="card nav-link" style={{ minHeight: 64, boxShadow: 'none' }} to={q.to}><Icon name={q.icon} /><span>{q.label}</span></Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
