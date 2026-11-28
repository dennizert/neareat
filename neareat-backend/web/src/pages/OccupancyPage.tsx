import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, SkeletonBlock, StatusBadge, SubscriptionLocked } from '../components/Feedback';
import { getOccupancy, type OccupancyResponse } from '../services/reservations';
import { getErrorMessage, isSubscriptionRequired } from '../api/client';
import { bandColorKey, bandForPercent, bandLabel, shouldShowBand } from '../utils/occupancyBand';
import { addDays, toIsoDay } from '../utils/format';

export function OccupancyList({ data }: { data: OccupancyResponse }) {
  const cap = data.seatCapacity ?? 0;
  return (
    <ul className="occ-list" role="list">
      {data.slots.map((s) => {
        const pct = s.percent ?? (cap ? Math.round((s.reserved * 100) / cap) : 0);
        const band = shouldShowBand(s.band) ? s.band : bandForPercent(pct);
        const label = bandLabel(band) ?? '';
        const tone = bandColorKey(band);
        return (
          <li key={s.time} className="occ-row" data-band={band}>
            <span className="occ-time">{s.time}</span>
            <div className="occ-bar" role="img" aria-label={`${s.time}: ${s.reserved}/${cap} koltuk, yüzde ${pct}, ${label}`}>
              <span style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <span className="occ-meta">
              <span className="num">{s.reserved}/{cap} · %{pct}</span>
              {tone !== 'muted' && <StatusBadge tone={tone}>{label}</StatusBadge>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function OccupancyPage() {
  const [params, setParams] = useSearchParams();
  const today = toIsoDay(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('tarih') ?? '') ? (params.get('tarih') as string) : today;
  const [data, setData] = useState<OccupancyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getOccupancy(date));
      setLocked(false);
    } catch (err) {
      if (isSubscriptionRequired(err)) setLocked(true);
      else setError(getErrorMessage(err, 'Doluluk yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  function go(next: string) {
    const p = new URLSearchParams(params);
    if (next === today) p.delete('tarih'); else p.set('tarih', next);
    setParams(p, { replace: true });
  }

  const peak = useMemo(() => {
    if (!data?.slots?.length) return null;
    return data.slots.reduce((a, b) => (b.reserved > a.reserved ? b : a));
  }, [data]);

  return (
    <>
      <PageHeader
        title="Doluluk"
        description="Seçili gün için saat saat koltuk durumu."
        action={(
          <div className="date-nav">
            <Button variant="secondary" iconOnly aria-label="Önceki gün" onClick={() => go(addDays(date, -1))}><Icon name="chev-l" /></Button>
            <label className="sr-only" htmlFor="dt">Tarih</label>
            <input className="input" id="dt" type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} />
            <Button variant="secondary" iconOnly aria-label="Sonraki gün" onClick={() => go(addDays(date, 1))}><Icon name="chev-r" /></Button>
            <Button variant="ghost" onClick={() => go(today)} disabled={date === today}>Bugün</Button>
          </div>
        )}
      />
      {loading ? (
        <SkeletonBlock rows={6} />
      ) : locked ? (
        <SubscriptionLocked feature="Doluluk paneli" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data?.seatCapacity ? (
        <div className="card">
          <EmptyState icon="gauge" title="Koltuk kapasitesi girin" action={<Link className="btn btn-primary" to="/bilgiler">Kapasite gir</Link>}>
            Doluluğu görebilmek için restoranınızın toplam koltuk sayısını Bilgiler sayfasından girin.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="grid grid-stats">
            <div className="stat"><div className="stat-label">Koltuk kapasitesi</div><div className="stat-value">{data.seatCapacity}</div><div className="stat-meta"><Link to="/bilgiler">Değiştir</Link></div></div>
            {peak && peak.reserved > 0 && (
              <div className="stat"><div className="stat-label">En yoğun saat</div><div className="stat-value num">{peak.time}</div>
                <div className="stat-meta">{bandLabel(peak.band) && <StatusBadge tone={bandColorKey(peak.band) === 'muted' ? 'neutral' : (bandColorKey(peak.band) as 'success')}>{bandLabel(peak.band)}</StatusBadge>} {peak.reserved}/{data.seatCapacity} koltuk</div></div>
            )}
          </div>
          <div className="card section">
            <div className="card-header">
              <h2 className="card-title">Saatlik doluluk</h2>
              <div className="row subtle"><StatusBadge tone="success">Müsait</StatusBadge><StatusBadge tone="warning">Az yer kaldı (%70+)</StatusBadge><StatusBadge tone="danger">Dolu</StatusBadge></div>
            </div>
            <OccupancyList data={data} />
            <p className="subtle" style={{ marginTop: 'var(--space-3)' }}>Yalnızca onaylı rezervasyonlar sayılır. Her rezervasyon yaklaşık 2 saat yer tutar.</p>
          </div>
        </>
      )}
    </>
  );
}
