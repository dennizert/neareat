import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { EmptyState, ErrorState, SkeletonBlock } from '../components/Feedback';
import { getNotifications, markAllAsRead, markAsRead } from '../services/notifications';
import { getErrorMessage } from '../api/client';
import { useCountsStore } from '../store/countsStore';
import { toast } from '../store/toastStore';
import { formatDateTime } from '../utils/format';
import type { AppNotification } from '../types';

/** Mobil `utils/notificationTarget.ts`: tüm RESERVATION_* tipleri `reservationId` taşır. */
export function notificationTarget(n: Pick<AppNotification, 'type' | 'data'>): string | null {
  const id = n.data && typeof n.data.reservationId === 'string' ? n.data.reservationId : null;
  if (n.type.startsWith('RESERVATION_') && id) return `/rezervasyonlar/${id}`;
  return null;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const { setUnread, refreshUnread } = useCountsStore();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getNotifications(1);
      setItems(r.notifications);
      setHasMore(r.hasMore);
      setPage(1);
    } catch (err) {
      setError(getErrorMessage(err, 'Bildirimler yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function more() {
    setLoadingMore(true);
    try {
      const r = await getNotifications(page + 1);
      setItems((prev) => [...prev, ...r.notifications]);
      setHasMore(r.hasMore);
      setPage(page + 1);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  async function readOne(n: AppNotification) {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    try {
      await markAsRead(n.id);
      refreshUnread();
    } catch (err) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: false } : x)));
      toast(getErrorMessage(err), 'error');
    }
  }

  async function readAll() {
    setBusyAll(true);
    try {
      await markAllAsRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setUnread(0);
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusyAll(false);
    }
  }

  function open(n: AppNotification) {
    readOne(n);
    const target = notificationTarget(n);
    if (target) navigate(target);
  }

  const anyUnread = items.some((n) => !n.isRead);

  return (
    <>
      <PageHeader title="Bildirimler" action={<Button variant="secondary" onClick={readAll} loading={busyAll} disabled={!anyUnread}>Tümünü okundu işaretle</Button>} />
      {loading ? <SkeletonBlock /> : error ? <ErrorState message={error} onRetry={load} /> : items.length === 0 ? (
        <div className="card"><EmptyState icon="bell" title="Bildirim yok">Yeni rezervasyon talepleri ve mesajlar burada görünür.</EmptyState></div>
      ) : (
        <div className="card">
          <ul className="notif-list">
            {items.map((n) => {
              const target = notificationTarget(n);
              return (
                <li key={n.id} className="notif" data-read={n.isRead}>
                  <div className="notif-body">
                    {target ? (
                      <button type="button" className="btn btn-ghost" style={{ padding: 0, minHeight: 0, height: 'auto', textAlign: 'left', display: 'block' }} onClick={() => open(n)}>
                        <span className="notif-title">{n.title}</span>
                      </button>
                    ) : <span className="notif-title">{n.title}</span>}
                    <div className="muted">{n.body}</div>
                    <div className="subtle">{formatDateTime(n.createdAt)}{!n.isRead && ' · Okunmadı'}</div>
                  </div>
                  {!n.isRead && <Button size="sm" variant="ghost" onClick={() => readOne(n)}>Okundu</Button>}
                </li>
              );
            })}
          </ul>
          {hasMore && <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}><Button variant="secondary" onClick={more} loading={loadingMore}>Daha fazla yükle</Button></div>}
        </div>
      )}
    </>
  );
}
