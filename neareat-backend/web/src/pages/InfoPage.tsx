import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Alert, ErrorState, SkeletonBlock } from '../components/Feedback';
import { ConfirmDialog } from '../components/Dialog';
import { getMyRestaurantProfile, updateInfo } from '../services/restaurantAccount';
import { getErrorMessage, isSubscriptionRequired } from '../api/client';
import { toast } from '../store/toastStore';
import { useSessionStore } from '../store/sessionStore';
import { useUnsavedChangesWarning, UNSAVED_MESSAGE } from '../hooks/useUnsavedChangesWarning';
import { MSG, validateAltPhone, validateDisplayName, validateOptionalRange } from '../utils/validation';
import type { RestaurantProfile } from '../types';

export interface InfoForm {
  displayName: string;
  phone: string;
  altPhone: string;
  contactEmail: string;
  address: string;
  reservationUrl: string;
  acceptsReservations: boolean;
  tableCount: string;
  seatCapacity: string;
}

export function formFromProfile(p: RestaurantProfile): InfoForm {
  return {
    displayName: p.displayName ?? '',
    phone: p.phone ?? '',
    altPhone: p.altPhone ?? '',
    contactEmail: p.contactEmail ?? '',
    address: p.address ?? '',
    reservationUrl: p.reservationUrl ?? '',
    acceptsReservations: !!p.acceptsReservations,
    tableCount: p.tableCount != null ? String(p.tableCount) : '',
    seatCapacity: p.seatCapacity != null ? String(p.seatCapacity) : '',
  };
}

export type InfoErrors = Partial<Record<keyof InfoForm, string>>;

/** Backend `updateInfo` kurallarıyla aynı (FAZ1 §5). */
export function validateInfo(f: InfoForm): InfoErrors {
  const e: InfoErrors = {};
  const dn = validateDisplayName(f.displayName); if (dn) e.displayName = dn;
  const tc = validateOptionalRange(f.tableCount, 1, 500, MSG.tableCount); if (tc) e.tableCount = tc;
  const sc = validateOptionalRange(f.seatCapacity, 1, 5000, MSG.seatCapacity); if (sc) e.seatCapacity = sc;
  const ap = validateAltPhone(f.altPhone); if (ap) e.altPhone = ap;
  return e;
}

/** Backend hata metnini ilgili alana eşler (içerik filtresi dahil). */
export function fieldForServerError(msg: string): keyof InfoForm | null {
  if (/Görünen ad/i.test(msg)) return 'displayName';
  if (/Masa kapasitesi/i.test(msg)) return 'tableCount';
  if (/Koltuk kapasitesi/i.test(msg)) return 'seatCapacity';
  if (/Alternatif telefon/i.test(msg)) return 'altPhone';
  return null;
}

export default function InfoPage() {
  const setRestaurant = useSessionStore((s) => s.setRestaurant);
  const restaurant = useSessionStore((s) => s.restaurant);
  const [initial, setInitial] = useState<InfoForm | null>(null);
  const [form, setForm] = useState<InfoForm | null>(null);
  const [errors, setErrors] = useState<InfoErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const p = await getMyRestaurantProfile();
      const f = formFromProfile(p);
      setInitial(f);
      setForm(f);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Bilgiler yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const blocker = useUnsavedChangesWarning(dirty && !busy);

  function set<K extends keyof InfoForm>(k: K, v: InfoForm[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    const errs = validateInfo(form);
    setErrors(errs);
    setSaveError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const p = await updateInfo({
        displayName: form.displayName.trim() || '',
        phone: form.phone.trim(),
        altPhone: form.altPhone.trim() || '',
        contactEmail: form.contactEmail.trim(),
        address: form.address.trim(),
        reservationUrl: form.reservationUrl.trim() || undefined,
        acceptsReservations: form.acceptsReservations,
        tableCount: form.tableCount.trim() ? Number(form.tableCount) : null,
        seatCapacity: form.seatCapacity.trim() ? Number(form.seatCapacity) : null,
      });
      const f = formFromProfile(p);
      setInitial(f);
      setForm(f);
      if (restaurant) setRestaurant({ ...restaurant, displayName: p.displayName ?? null });
      toast('Restoran bilgileriniz güncellendi.', 'success');
    } catch (err) {
      if (isSubscriptionRequired(err)) { setLocked(true); setSaveError(getErrorMessage(err)); return; }
      const msg = getErrorMessage(err, 'Kaydedilemedi.');
      const field = fieldForServerError(msg);
      if (field) setErrors({ [field]: msg });
      else setSaveError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <><PageHeader title="Restoran bilgileri" /><SkeletonBlock /></>;
  if (loadError || !form) return <><PageHeader title="Restoran bilgileri" /><ErrorState message={loadError ?? ''} onRetry={load} /></>;

  return (
    <>
      <PageHeader title="Restoran bilgileri" description="Kullanıcılara gösterilen iletişim ve kapasite bilgileri." />
      <form onSubmit={onSubmit} noValidate className="grid grid-2">
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>İletişim</h2>
          <Field id="displayName" label="Görünen ad" optional hint="Kullanıcılara gösterilecek ad (2-80 karakter)." error={errors.displayName}>
            <input className="input" maxLength={80} value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
          </Field>
          <Field id="phone" label="Telefon numarası">
            <input className="input" type="tel" autoComplete="tel" placeholder="+90 555 000 00 00" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field id="altPhone" label="Alternatif telefon" optional error={errors.altPhone}>
            <input className="input" type="tel" maxLength={20} placeholder="+90 555 111 11 11" value={form.altPhone} onChange={(e) => set('altPhone', e.target.value)} />
          </Field>
          <Field id="contactEmail" label="İletişim e-postası">
            <input className="input" type="email" placeholder="isletme@ornek.com" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </Field>
          <Field id="address" label="Adres">
            <textarea className="textarea" rows={3} placeholder="Mahalle, sokak, bina..." value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Rezervasyon ve kapasite</h2>
          <label className="check">
            <input type="checkbox" checked={form.acceptsReservations} onChange={(e) => set('acceptsReservations', e.target.checked)} />
            <span>Eatlas üzerinden rezervasyon kabul et</span>
          </label>
          <Field id="reservationUrl" label="Dış rezervasyon URL" optional>
            <input className="input" type="url" placeholder="https://rezervasyon.siteniz.com" value={form.reservationUrl} onChange={(e) => set('reservationUrl', e.target.value)} />
          </Field>
          <Field id="tableCount" label="Masa kapasitesi" optional hint="Aynı saate en fazla rezervasyon (boş = sınırsız, 1-500)." error={errors.tableCount}>
            <input className="input num" type="number" inputMode="numeric" min={1} max={500} value={form.tableCount} onChange={(e) => set('tableCount', e.target.value)} />
          </Field>
          <Field id="seatCapacity" label="Koltuk kapasitesi" optional hint="Toplam sandalye sayısı; doluluk bu sayıyla hesaplanır (1-5000)." error={errors.seatCapacity}>
            <input className="input num" type="number" inputMode="numeric" min={1} max={5000} value={form.seatCapacity} onChange={(e) => set('seatCapacity', e.target.value)} />
          </Field>
          {(saveError || locked) && <div style={{ marginTop: 'var(--space-4)' }}><Alert tone="danger" icon={locked ? 'lock' : undefined}>{saveError}</Alert></div>}
          <div className="row" style={{ marginTop: 'var(--space-5)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" disabled={!dirty || busy} onClick={() => { setForm(initial); setErrors({}); }}>Vazgeç</Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>Kaydet</Button>
          </div>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Kaydedilmemiş değişiklikler"
        message={UNSAVED_MESSAGE}
        confirmLabel="Ayrıl"
        tone="danger"
        onConfirm={() => blocker.proceed?.()}
        onClose={() => blocker.reset?.()}
      />
    </>
  );
}
