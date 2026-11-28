import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/AuthLayout';
import { Tabs } from '../components/Tabs';
import { DataTable } from '../components/DataTable';
import { Button } from '../components/Button';
import { Alert, EmptyState, ErrorState, ReservationStatusBadge, SkeletonBlock, StatusBadge } from '../components/Feedback';
import { ReservationDialogs, type ReservationAction } from '../components/ReservationDialogs';
import { getRestaurantReservations } from '../services/reservations';
import { getErrorMessage } from '../api/client';
import { useCountsStore } from '../store/countsStore';
import { canMarkAttendance, countByTab, filterByTab, isReservationTab, replaceReservation, RESERVATION_TABS, sortPending, type ReservationTab } from '../utils/reservations';
import { formatDateShort } from '../utils/format';
import type { Reservation } from '../types';

export default function ReservationsPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('durum');
  const tab: ReservationTab = isReservationTab(tabParam) ? tabParam : 'PENDING';
  const date = params.get('tarih') ?? '';
  const [all, setAll] = useState<Reservation[]>([]);
  const [pendingOrdered, setPendingOrdered] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ReservationAction | null>(null);
  const [locked, setLocked] = useState(false);
  const setPendingCount = useCountsStore((s) => s.setPending);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Bekleyenler backend sırasıyla (S19-4: öncelik desc → tarih/saat asc) ayrı çekilir;
      // diğer sekmeler ve sayılar tüm listeden.
      const [everything, pending] = await Promise.all([
        getRestaurantReservations(undefined, date || undefined),
        getRestaurantReservations('PENDING', date || undefined),
      ]);
      setAll(everything);
      setPendingOrdered(pending);
      if (!date) setPendingCount(pending.length);
    } catch (err) {
      setError(getErrorMessage(err, 'Rezervasyonlar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [date, setPendingCount]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => countByTab(all), [all]);
  const rows = tab === 'PENDING' ? pendingOrdered : filterByTab(all, tab);

  function setTab(next: ReservationTab) {
    const p = new URLSearchParams(params);
    p.set('durum', next);
    setParams(p, { replace: true });
  }
  function setDate(next: string) {
    const p = new URLSearchParams(params);
    if (next) p.set('tarih', next); else p.delete('tarih');
    setParams(p, { replace: true });
  }

  function onDone(updated: Reservation) {
    setAction(null);
    const nextAll = replaceReservation(all, updated);
    setAll(nextAll);
    const nextPending = sortPending(pendingOrdered.filter((r) => r.id !== updated.id || updated.status === 'PENDING'));
    setPendingOrdered(nextPending);
    if (!date) setPendingCount(nextPending.length);
  }

  return (
    <>
      <PageHeader
        title="Rezervasyonlar"
        description="Bekleyen talepler öncelik sırasına göre (3. seviye ve üstü kullanıcılar üstte)."
        action={(
          <div className="row">
            <label className="sr-only" htmlFor="tarih">Tarih</label>
            <input className="input" id="tarih" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
            {date && <Button variant="ghost" onClick={() => setDate('')}>Tüm tarihler</Button>}
          </div>
        )}
      />
      {locked && (
        <div className="section">
          <Alert tone="danger" icon="lock" title="Aboneliğiniz aktif değil.">Rezervasyon onaylamak ve reddetmek için aktif abonelik ya da deneme süresi gerekir.</Alert>
        </div>
      )}
      <Tabs label="Duruma göre filtre" items={RESERVATION_TABS.map((t) => ({ ...t, count: loading ? null : counts[t.key] }))} value={tab} onChange={setTab} />
      {loading ? (
        <SkeletonBlock />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon="calendar" title="Bu sekmede rezervasyon yok">{date ? 'Seçili tarih için kayıt bulunamadı.' : 'Yeni talepler geldiğinde burada görünür.'}</EmptyState></div>
      ) : (
        <div className="card card-flush">
          <DataTable
            caption="Rezervasyon talepleri"
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { key: 'guest', header: 'Misafir', render: (r) => (
                <>
                  <Link className="cell-title" to={`/rezervasyonlar/${r.id}`}>{r.user?.displayName ?? 'Misafir'}</Link>
                  {r.isPriority && <> <StatusBadge tone="priority">Öncelikli kullanıcı</StatusBadge></>}
                  {r.occasion && <div className="subtle">Özel gün: {r.occasion}</div>}
                  {r.specialRequests && <div className="subtle">Not: {r.specialRequests}</div>}
                  {r.status === 'REJECTED' && r.rejectionReason && <div className="subtle">Red nedeni: {r.rejectionReason}</div>}
                </>
              ) },
              { key: 'when', header: 'Tarih · saat', className: 'num', render: (r) => `${formatDateShort(r.date.slice(0, 10))} · ${r.time}` },
              { key: 'guests', header: 'Kişi', className: 'num', render: (r) => r.guestCount },
              { key: 'seats', header: 'Rezerve koltuk', className: 'num', render: (r) => (r.reservedSeats && (r.status === 'CONFIRMED' || r.status === 'COMPLETED') ? `${r.reservedSeats} koltuk` : '—') },
              { key: 'status', header: 'Durum', render: (r) => (
                <>
                  <ReservationStatusBadge status={r.status} />
                  {r.attended === true && <div className="subtle">Geldi</div>}
                  {r.attended === false && <div className="subtle">Gelmedi</div>}
                </>
              ) },
            ]}
            actions={(r) => {
              if (r.status === 'PENDING') {
                return (
                  <>
                    <Button size="sm" variant="secondary" disabled={locked} onClick={() => setAction({ kind: 'reject', reservation: r })}>Reddet</Button>
                    <Button size="sm" variant="primary" disabled={locked} onClick={() => setAction({ kind: 'confirm', reservation: r })}>Onayla</Button>
                  </>
                );
              }
              if (canMarkAttendance(r)) {
                return (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'attendance', reservation: r, attended: false })}>Gelmedi</Button>
                    <Button size="sm" variant="success" onClick={() => setAction({ kind: 'attendance', reservation: r, attended: true })}>Geldi</Button>
                  </>
                );
              }
              return <span className="subtle">—</span>;
            }}
          />
        </div>
      )}
      <ReservationDialogs
        action={action}
        onClose={() => setAction(null)}
        onDone={onDone}
        onStale={() => { setAction(null); load(); }}
        onSubscriptionRequired={() => setLocked(true)}
      />
    </>
  );
}
