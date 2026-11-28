import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Alert, ErrorState, SkeletonBlock } from '../components/Feedback';
import { ConfirmDialog } from '../components/Dialog';
import { getMyRestaurantProfile, updateHours } from '../services/restaurantAccount';
import { getErrorMessage } from '../api/client';
import { toast } from '../store/toastStore';
import { useUnsavedChangesWarning, UNSAVED_MESSAGE } from '../hooks/useUnsavedChangesWarning';
import type { OpeningHours } from '../types';

// Mobil `RestaurantHoursScreen` ile aynı anahtarlar, varsayılan ve 30 dk adımlı saat seçenekleri.
// Kapanışın açılıştan önce olması mobilde engellenmiyor (gece yarısını geçen saat) — web de engellemez.
export const DAYS = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Salı' },
  { key: 'wednesday', label: 'Çarşamba' },
  { key: 'thursday', label: 'Perşembe' },
  { key: 'friday', label: 'Cuma' },
  { key: 'saturday', label: 'Cumartesi' },
  { key: 'sunday', label: 'Pazar' },
];

export const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`]).flat();

export const DEFAULT_HOURS: OpeningHours = Object.fromEntries(DAYS.map((d) => [d.key, { open: '09:00', close: '22:00', closed: false }]));

/** Mobilin kaydettiği biçim aynen okunur; eksik günler varsayılanla tamamlanır. */
export function mergeHours(saved: OpeningHours | null | undefined): OpeningHours {
  return { ...DEFAULT_HOURS, ...(saved ?? {}) };
}

export default function HoursPage() {
  const [initial, setInitial] = useState<OpeningHours | null>(null);
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await getMyRestaurantProfile();
      const h = mergeHours(p.openingHours);
      setInitial(h);
      setHours(h);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Saatler yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => !!initial && JSON.stringify(hours) !== JSON.stringify(initial), [hours, initial]);
  const blocker = useUnsavedChangesWarning(dirty && !busy);

  function setDay(day: string, patch: Partial<OpeningHours[string]>) {
    setHours((prev) => ({ ...prev, [day]: { ...(prev[day] ?? DEFAULT_HOURS[day]), ...patch } }));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const p = await updateHours(hours);
      const h = mergeHours(p.openingHours ?? hours);
      setInitial(h);
      setHours(h);
      toast('Çalışma saatleri güncellendi.', 'success');
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Kaydedilemedi.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <><PageHeader title="Çalışma saatleri" /><SkeletonBlock rows={7} /></>;
  if (loadError) return <><PageHeader title="Çalışma saatleri" /><ErrorState message={loadError} onRetry={load} /></>;

  return (
    <>
      <PageHeader title="Çalışma saatleri" description="Her gün için açılış/kapanış saatini ayarlayın veya o günü kapalı işaretleyin." />
      <div className="card">
        {DAYS.map(({ key, label }) => {
          const d = hours[key] ?? DEFAULT_HOURS[key];
          return (
            <fieldset key={key} className="hours-row" style={{ border: 0, margin: 0, paddingInline: 0 }}>
              <legend className="sr-only">{label}</legend>
              <strong aria-hidden="true">{label}</strong>
              <label className="check" style={{ minHeight: 'var(--control-h)' }}>
                <input type="checkbox" checked={d.closed} onChange={(e) => setDay(key, { closed: e.target.checked })} />
                <span>Kapalı</span>
              </label>
              {!d.closed && (
                <div className="hours-times">
                  <label className="sr-only" htmlFor={`${key}-open`}>{label} açılış</label>
                  <select className="select" id={`${key}-open`} value={d.open} onChange={(e) => setDay(key, { open: e.target.value })}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span aria-hidden="true">→</span>
                  <label className="sr-only" htmlFor={`${key}-close`}>{label} kapanış</label>
                  <select className="select" id={`${key}-close`} value={d.close} onChange={(e) => setDay(key, { close: e.target.value })}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {d.close <= d.open && <span className="subtle">Ertesi gün kapanır</span>}
                </div>
              )}
            </fieldset>
          );
        })}
        {saveError && <div style={{ marginTop: 'var(--space-4)' }}><Alert tone="danger">{saveError}</Alert></div>}
        <div className="row" style={{ marginTop: 'var(--space-5)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" disabled={!dirty || busy} onClick={() => initial && setHours(initial)}>Vazgeç</Button>
          <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>Kaydet</Button>
        </div>
      </div>
      <ConfirmDialog open={blocker.state === 'blocked'} title="Kaydedilmemiş değişiklikler" message={UNSAVED_MESSAGE} confirmLabel="Ayrıl" tone="danger" onConfirm={() => blocker.proceed?.()} onClose={() => blocker.reset?.()} />
    </>
  );
}
