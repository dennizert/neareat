import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Alert, ErrorState, SkeletonBlock, StatusBadge } from '../components/Feedback';
import { ConfirmDialog } from '../components/Dialog';
import { activateInstantDiscount, deactivateInstantDiscount, getMyRestaurantProfile, updateDiscount } from '../services/restaurantAccount';
import { getErrorMessage, isSubscriptionRequired } from '../api/client';
import { toast } from '../store/toastStore';
import { formatDateTime } from '../utils/format';
import { validateDiscountDuration, validateDiscountPercent } from '../utils/validation';
import type { RestaurantProfile } from '../types';

// Mobil `RestaurantDiscountScreen` ile aynı tablo ve süre seçenekleri (+ backend sınırına kadar uzun süreler).
const STAR_RATES = [
  { label: 'Seviye 2 (10+ ⭐)', pct: 10 },
  { label: 'Seviye 3 (25+ ⭐)', pct: 15 },
  { label: 'Seviye 4 (50+ ⭐)', pct: 20 },
  { label: 'Seviye 5 (100+ ⭐)', pct: 25 },
];
export const DURATION_OPTIONS = [
  { label: '30 dk', value: 30 }, { label: '1 saat', value: 60 }, { label: '2 saat', value: 120 },
  { label: '3 saat', value: 180 }, { label: '6 saat', value: 360 }, { label: '12 saat', value: 720 }, { label: '24 saat', value: 1440 },
];

export function isInstantActive(p: Pick<RestaurantProfile, 'discountActiveUntil'> | null, now = new Date()): boolean {
  return !!p?.discountActiveUntil && new Date(p.discountActiveUntil).getTime() > now.getTime();
}

export default function DiscountPage() {
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starEnabled, setStarEnabled] = useState(false);
  const [savingStar, setSavingStar] = useState(false);
  const [percent, setPercent] = useState('');
  const [duration, setDuration] = useState('60');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ percent?: string; duration?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await getMyRestaurantProfile();
      setProfile(p);
      setStarEnabled(!!p.discountEnabled);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'İndirim bilgileri yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  function fail(err: unknown) {
    if (isSubscriptionRequired(err)) setLocked(true);
    setError(getErrorMessage(err, 'İşlem başarısız.'));
  }

  async function saveStar() {
    setSavingStar(true);
    setError(null);
    try {
      const p = await updateDiscount({ starDiscountEnabled: starEnabled });
      setProfile((prev) => ({ ...(prev as RestaurantProfile), ...p }));
      toast('Yıldız programı ayarı kaydedildi.', 'success');
    } catch (err) {
      fail(err);
    } finally {
      setSavingStar(false);
    }
  }

  async function activate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs = { percent: validateDiscountPercent(percent) ?? undefined, duration: validateDiscountDuration(duration) ?? undefined };
    setErrors(errs);
    if (errs.percent || errs.duration) return;
    setBusy(true);
    setError(null);
    try {
      const p = await activateInstantDiscount(Number(duration), Number(percent), note.trim() || undefined);
      setProfile((prev) => ({ ...(prev as RestaurantProfile), ...p }));
      toast('Anlık indirim başlatıldı.', 'success');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setError(null);
    try {
      const p = await deactivateInstantDiscount();
      setProfile((prev) => ({ ...(prev as RestaurantProfile), ...p, discountActiveUntil: p?.discountActiveUntil ?? null }));
      setConfirmStop(false);
      toast('Anlık indirim kapatıldı.', 'success');
    } catch (err) {
      setConfirmStop(false);
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <><PageHeader title="İndirim" /><SkeletonBlock /></>;
  if (loadError || !profile) return <><PageHeader title="İndirim" /><ErrorState message={loadError ?? ''} onRetry={load} /></>;

  const active = isInstantActive(profile);

  return (
    <>
      <PageHeader title="İndirim" description="Yıldız programı ve kısa süreli anlık indirimler." />
      {error && <div className="section"><Alert tone="danger" icon={locked ? 'lock' : undefined} title={locked ? 'Abonelik gerekli' : undefined}>{error}</Alert></div>}
      <div className="grid grid-2">
        <div className="card">
          <h2 className="card-title">Yıldız programı</h2>
          <p className="muted" style={{ margin: 'var(--space-2) 0 var(--space-4)' }}>
            Programa katılarak kullanıcılara yıldız seviyelerine göre otomatik indirim sunun. Kullanıcılar sizi "Seçili Restoran" olarak görür.
          </p>
          <label className="check"><input type="checkbox" checked={starEnabled} onChange={(e) => setStarEnabled(e.target.checked)} /><span>Yıldız programına katıl</span></label>
          <dl className="summary" style={{ marginTop: 'var(--space-3)' }}>
            {STAR_RATES.map((r) => <Fragment key={r.label}><dt>{r.label}</dt><dd>%{r.pct}</dd></Fragment>)}
          </dl>
          <div className="row" style={{ marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
            <Button variant="primary" loading={savingStar} disabled={starEnabled === !!profile.discountEnabled} onClick={saveStar}>Kaydet</Button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2 className="card-title">Anlık indirim</h2>{active && <StatusBadge tone="success">Aktif</StatusBadge>}</div>
          <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>Restoranınız için kısa süreli indirim başlatın. Yıldız programından bağımsız çalışır.</p>
          {active ? (
            <div className="stack">
              <Alert tone="success" title={`%${profile.discountPercent} indirim aktif`}>
                Bitiş: {formatDateTime(profile.discountActiveUntil as string)}{profile.discountNote ? ` · ${profile.discountNote}` : ''}
              </Alert>
              <Button variant="danger" onClick={() => setConfirmStop(true)}>İndirimi kapat</Button>
            </div>
          ) : (
            <form onSubmit={activate} noValidate>
              <Field id="percent" label="İndirim oranı (%)" hint="%1-80" error={errors.percent}>
                <input className="input num" type="number" inputMode="numeric" min={1} max={80} placeholder="Örn: 20" value={percent} onChange={(e) => setPercent(e.target.value)} />
              </Field>
              <Field id="duration" label="Süre" error={errors.duration}>
                <select className="select" value={duration} onChange={(e) => setDuration(e.target.value)}>
                  {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field id="note" label="Not" optional>
                <input className="input" maxLength={120} placeholder="Örn: Yalnızca hafta içi geçerli" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="row" style={{ marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
                <Button type="submit" variant="primary" loading={busy} disabled={locked}>İndirimi başlat</Button>
              </div>
            </form>
          )}
        </div>
      </div>
      <ConfirmDialog open={confirmStop} title="Anlık indirimi kapat" message="İndirim hemen sona erecek." confirmLabel="Kapat" tone="danger" busy={busy} onConfirm={stop} onClose={() => setConfirmStop(false)} />
    </>
  );
}
