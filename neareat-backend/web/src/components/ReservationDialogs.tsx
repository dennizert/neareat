/**
 * Rezervasyon onay / red / katılım pencereleri (prototip `rezervasyonlar.html` dlg-onay,
 * dlg-red, dlg-katilim). Liste ve detay sayfası aynı bileşeni kullanır.
 */
import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Field } from './Field';
import { Alert } from './Feedback';
import { getOccupancy, markAttendance, updateReservationStatus, type OccupancyResponse } from '../services/reservations';
import { getErrorMessage, isSubscriptionRequired } from '../api/client';
import { toast } from '../store/toastStore';
import { validateRejectionReason, validateSeats } from '../utils/validation';
import { capacityCheck, RACE_MESSAGES } from '../utils/reservations';
import { formatDateShort } from '../utils/format';
import type { Reservation } from '../types';

export type ReservationAction = { kind: 'confirm' | 'reject'; reservation: Reservation } | { kind: 'attendance'; reservation: Reservation; attended: boolean };

export interface ReservationDialogsProps {
  action: ReservationAction | null;
  onClose: () => void;
  /** Başarı: güncellenmiş rezervasyon. */
  onDone: (updated: Reservation) => void;
  /** Yarış durumu (başka yerden güncellendi): listeyi yenile. */
  onStale: () => void;
  /** `SUBSCRIPTION_REQUIRED`: onay düğmeleri kilitlenir. */
  onSubscriptionRequired: () => void;
}

export function ReservationDialogs({ action, onClose, onDone, onStale, onSubscriptionRequired }: ReservationDialogsProps) {
  const r = action?.reservation;
  const [seats, setSeats] = useState('');
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [occ, setOcc] = useState<OccupancyResponse | null>(null);

  useEffect(() => {
    setFieldError(null);
    setError(null);
    setReason('');
    setOcc(null);
    if (action?.kind === 'confirm') {
      setSeats(String(action.reservation.guestCount));
      const day = action.reservation.date.slice(0, 10);
      let alive = true;
      getOccupancy(day).then((o) => { if (alive) setOcc(o); }).catch(() => {});
      return () => { alive = false; };
    }
  }, [action]);

  async function run(fn: () => Promise<Reservation>, successMsg: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      toast(successMsg, 'success');
      onDone(updated);
    } catch (err) {
      if (isSubscriptionRequired(err)) {
        onSubscriptionRequired();
        setError(getErrorMessage(err));
        return;
      }
      const msg = getErrorMessage(err);
      if (RACE_MESSAGES.includes(msg)) {
        toast(msg, 'error');
        onStale();
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function submitConfirm() {
    if (!r) return;
    const e = validateSeats(seats);
    setFieldError(e);
    if (e) return;
    run(() => updateReservationStatus(r.id, 'CONFIRMED', undefined, Number(seats)), 'Rezervasyon onaylandı.');
  }

  function submitReject() {
    if (!r) return;
    const e = validateRejectionReason(reason);
    setFieldError(e);
    if (e) return;
    run(() => updateReservationStatus(r.id, 'REJECTED', reason.trim()), 'Talep reddedildi.');
  }

  function submitAttendance() {
    if (!r || action?.kind !== 'attendance') return;
    const attended = action.attended;
    run(() => markAttendance(r.id, attended), attended ? 'Müşteri geldi olarak işaretlendi.' : 'Müşteri gelmedi olarak işaretlendi.');
  }

  const seatsNum = /^\d+$/.test(seats) ? Number(seats) : 0;
  const cap = action?.kind === 'confirm' && r ? capacityCheck(occ, r.time, seatsNum) : null;
  const when = r ? `${formatDateShort(r.date.slice(0, 10))} · ${r.time}` : '';

  return (
    <>
      <Dialog
        open={action?.kind === 'confirm'}
        title="Rezervasyonu onayla"
        onClose={onClose}
        onSubmit={submitConfirm}
        footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button type="submit" variant="primary" loading={busy}>Onayla</Button></>}
      >
        <div className="stack">
          <dl className="summary">
            <dt>Misafir</dt><dd>{r?.user?.displayName ?? '—'}</dd>
            <dt>Tarih</dt><dd className="num">{when}</dd>
            <dt>Kişi sayısı</dt><dd className="num">{r?.guestCount}</dd>
          </dl>
          <Field id="koltuk" label="Rezerve koltuk" error={fieldError} hint="Varsayılan kişi sayısıdır. Doluluk bu sayıya göre hesaplanır (1-5000).">
            <input className="input num" type="number" inputMode="numeric" min={1} max={5000} value={seats} onChange={(e) => setSeats(e.target.value)} />
          </Field>
          {cap?.overflow && (
            <Alert tone="warning">Bu saat diliminde {cap.reserved}/{cap.capacity} koltuk dolu. Onaylarsanız kapasite aşılır.</Alert>
          )}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>

      <Dialog
        open={action?.kind === 'reject'}
        title="Talebi reddet"
        onClose={onClose}
        onSubmit={submitReject}
        footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button type="submit" variant="danger" loading={busy}>Reddet</Button></>}
      >
        <p className="muted" style={{ marginBottom: 'var(--space-3)' }}>{r?.user?.displayName} adlı misafire neden bildirilecek.</p>
        <Field id="neden" label="Red nedeni" error={fieldError}>
          <textarea className="textarea" placeholder="Örn. O saat dilimi dolu" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <div style={{ marginTop: 'var(--space-3)' }}><Alert tone="danger">{error}</Alert></div>}
      </Dialog>

      <Dialog
        open={action?.kind === 'attendance'}
        title="Katılım durumu"
        onClose={onClose}
        onSubmit={submitAttendance}
        hideClose
        footer={<><Button variant="secondary" onClick={onClose}>Vazgeç</Button><Button type="submit" variant="primary" loading={busy}>Evet, işaretle</Button></>}
      >
        <p><strong>{r?.user?.displayName}</strong></p>
        <p className="muted">
          {action?.kind === 'attendance' && action.attended ? 'Müşteri geldi olarak işaretlensin mi?' : 'Müşteri gelmedi olarak işaretlensin mi?'}
        </p>
        {error && <div style={{ marginTop: 'var(--space-3)' }}><Alert tone="danger">{error}</Alert></div>}
      </Dialog>
    </>
  );
}
