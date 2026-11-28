import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { EmptyState, ErrorState, Skeleton, SkeletonBlock, SubscriptionLocked } from '../components/Feedback';
import { getRestaurantAnalytics, getWeeklyReport } from '../services/restaurantAccount';
import { getErrorMessage, isSubscriptionRequired } from '../api/client';
import { formatDecimal, formatPercent } from '../utils/format';
import type { RestaurantAnalytics, WeeklyReport } from '../types';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekleyen', CONFIRMED: 'Onaylı', REJECTED: 'Reddedilen', CANCELLED: 'İptal', COMPLETED: 'Tamamlanan',
};

export function hasAnalyticsData(a: RestaurantAnalytics | null): boolean {
  if (!a) return false;
  return a.reservations.totalReservations > 0 || a.reviews.reviewCount > 0;
}

/** Yatay çubuk grafik + ekran okuyucu için tablo karşılığı (görsel `aria-hidden`). */
function Bars({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card">
      <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>{title}</h2>
      {rows.length === 0 ? <p className="subtle">Henüz veri yok.</p> : (
        <>
          <ul className="bars" aria-hidden="true">
            {rows.map((r) => (
              <li key={r.label}><span className="num">{r.label}</span><span className="bar"><span style={{ width: `${(r.value / max) * 100}%` }} /></span><span className="num text-right">{r.value}</span></li>
            ))}
          </ul>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>{rows.map((r) => <tr key={r.label}><th scope="row">{r.label}</th><td>{r.value}</td></tr>)}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

function ReportCard() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'locked'>('loading');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setState('loading');
    try {
      setReport(await getWeeklyReport());
      setState('ok');
    } catch (err) {
      if (isSubscriptionRequired(err)) { setState('locked'); return; }
      setError(getErrorMessage(err, 'Rapor oluşturulamadı.'));
      setState('error');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card section">
      <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Haftalık işletme raporu</h2>
      {state === 'loading' && <div className="stack-sm" role="status"><span className="sr-only">Rapor hazırlanıyor…</span><Skeleton width="90%" /><Skeleton width="80%" /><Skeleton width="60%" /></div>}
      {state === 'error' && <div className="row-between"><p className="muted">{error}</p><Button variant="primary" onClick={load}>Tekrar dene</Button></div>}
      {state === 'locked' && <p className="muted">İşletme raporu aktif abonelik ya da deneme süresi gerektirir.</p>}
      {state === 'ok' && report && (
        <>
          <p style={{ whiteSpace: 'pre-line' }}>{report.report}</p>
          {report.fallback && <p className="subtle" style={{ marginTop: 'var(--space-2)' }}>AI özet şu an kullanılamadı, otomatik özet gösteriliyor.</p>}
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<RestaurantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getRestaurantAnalytics());
    } catch (err) {
      if (isSubscriptionRequired(err)) setLocked(true);
      else setError(getErrorMessage(err, 'Analitik yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const header = <PageHeader title="Analitik" description="Rezervasyon ve yorum özetleri." />;
  if (loading) return <>{header}<SkeletonBlock /></>;
  if (locked) return <>{header}<SubscriptionLocked feature="Analitik ve işletme raporu" /></>;
  if (error || !data) return <>{header}<ErrorState message={error ?? ''} onRetry={load} /></>;

  const r = data.reservations;
  const rev = data.reviews;
  return (
    <>
      {header}
      {!hasAnalyticsData(data) ? (
        <div className="card"><EmptyState icon="trend" title="Henüz analitik verisi yok">Rezervasyon ve yorum geldikçe özetler burada oluşur.</EmptyState></div>
      ) : (
        <>
          <div className="grid grid-stats">
            <div className="stat"><div className="stat-label">Toplam rezervasyon</div><div className="stat-value">{r.totalReservations}</div></div>
            <div className="stat"><div className="stat-label">Katılım oranı</div><div className="stat-value">{r.attendanceRate != null ? formatPercent(r.attendanceRate * 100) : '—'}</div></div>
            <div className="stat"><div className="stat-label">Ortalama puan</div><div className="stat-value">{rev.avgRating != null ? formatDecimal(rev.avgRating) : '—'}</div><div className="stat-meta">{rev.reviewCount} yorum</div></div>
          </div>
          <div className="section grid grid-2">
            <Bars title="Son 7 gün rezervasyon" rows={r.trend.map((t) => ({ label: t.date.slice(5), value: t.count }))} />
            <Bars title="En yoğun saatler" rows={r.busiestHours.map((h) => ({ label: `${h.hour}:00`, value: h.count }))} />
            <Bars title="Rezervasyon durumları" rows={Object.entries(r.statusBreakdown).map(([k, v]) => ({ label: STATUS_LABELS[k] ?? k, value: v }))} />
            <Bars title="Puan dağılımı" rows={[5, 4, 3, 2, 1].map((s) => ({ label: `${s}★`, value: rev.distribution[s as 1 | 2 | 3 | 4 | 5] ?? 0 }))} />
          </div>
        </>
      )}
      <ReportCard />
    </>
  );
}
