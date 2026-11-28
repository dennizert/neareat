import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { Alert, EmptyState, ErrorState, ReservationStatusBadge, SkeletonBlock, StatusBadge } from '../components/Feedback';
import { ReservationDialogs, type ReservationAction } from '../components/ReservationDialogs';
import { getReservationDetail, getReservationMessages, sendReservationMessage } from '../services/reservations';
import { getErrorMessage } from '../api/client';
import { useCountsStore } from '../store/countsStore';
import { canMarkAttendance } from '../utils/reservations';
import { formatDateLong, formatDateTime } from '../utils/format';
import { validateMessage } from '../utils/validation';
import type { Reservation, ReservationMessage } from '../types';

export default function ReservationDetailPage() {
  const { id = '' } = useParams();
  const [res, setRes] = useState<Reservation | null>(null);
  const [messages, setMessages] = useState<ReservationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [msgError, setMsgError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [action, setAction] = useState<ReservationAction | null>(null);
  const [locked, setLocked] = useState(false);
  const refreshPending = useCountsStore((s) => s.refreshPending);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, m] = await Promise.all([getReservationDetail(id), getReservationMessages(id).catch(() => [] as ReservationMessage[])]);
      setRes(r);
      setMessages(m);
    } catch (err) {
      setError(getErrorMessage(err, 'Rezervasyon yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const err = validateMessage(text);
    setMsgError(err);
    if (err) return;
    setSending(true);
    try {
      const m = await sendReservationMessage(id, text.trim());
      setMessages((prev) => [...prev, m]);
      setText('');
    } catch (ex) {
      setMsgError(getErrorMessage(ex, 'Mesaj gönderilemedi.'));
    } finally {
      setSending(false);
    }
  }

  const back = <Link className="btn btn-ghost" to="/rezervasyonlar"><Icon name="chev-l" />Rezervasyonlar</Link>;

  if (loading) return <><PageHeader title="Rezervasyon" action={back} /><SkeletonBlock /></>;
  if (error || !res) return <><PageHeader title="Rezervasyon" action={back} /><ErrorState message={error ?? 'Rezervasyon bulunamadı.'} onRetry={load} /></>;

  return (
    <>
      <PageHeader title={res.user?.displayName ?? 'Rezervasyon'} description={`${formatDateLong(res.date.slice(0, 10))} · ${res.time}`} action={back} />
      {locked && <div className="section"><Alert tone="danger" icon="lock" title="Aboneliğiniz aktif değil.">Rezervasyon onaylamak ve reddetmek için aktif abonelik ya da deneme süresi gerekir.</Alert></div>}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h2 className="card-title">Ayrıntılar</h2><ReservationStatusBadge status={res.status} /></div>
          <dl className="summary">
            <dt>Misafir</dt><dd>{res.user?.displayName}{res.isPriority && <> <StatusBadge tone="priority">Öncelikli kullanıcı</StatusBadge></>}</dd>
            <dt>Tarih</dt><dd>{formatDateLong(res.date.slice(0, 10))}</dd>
            <dt>Saat</dt><dd className="num">{res.time}</dd>
            <dt>Kişi</dt><dd className="num">{res.guestCount}</dd>
            <dt>Rezerve koltuk</dt><dd className="num">{res.reservedSeats ?? '—'}</dd>
            {res.occasion && <><dt>Özel gün</dt><dd>{res.occasion}</dd></>}
            <dt>Not</dt><dd>{res.specialRequests || '—'}</dd>
            {res.rejectionReason && <><dt>Red nedeni</dt><dd>{res.rejectionReason}</dd></>}
            {res.attended != null && <><dt>Katılım</dt><dd>{res.attended ? 'Geldi' : 'Gelmedi'}</dd></>}
          </dl>
          {res.status === 'PENDING' && (
            <div className="row" style={{ marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" disabled={locked} onClick={() => setAction({ kind: 'reject', reservation: res })}>Reddet</Button>
              <Button variant="primary" disabled={locked} onClick={() => setAction({ kind: 'confirm', reservation: res })}>Onayla</Button>
            </div>
          )}
          {canMarkAttendance(res) && (
            <div className="row" style={{ marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setAction({ kind: 'attendance', reservation: res, attended: false })}>Gelmedi</Button>
              <Button variant="success" onClick={() => setAction({ kind: 'attendance', reservation: res, attended: true })}>Geldi</Button>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Mesajlar</h2>
          {messages.length === 0 ? (
            <EmptyState icon="mail" title="Henüz mesaj yok">Misafirle bu rezervasyon hakkında yazışabilirsiniz.</EmptyState>
          ) : (
            <ul className="msg-list" aria-label="Mesaj geçmişi">
              {messages.map((m) => (
                <li key={m.id} className="msg" data-mine={m.senderRole === 'RESTAURANT'}>
                  <span className="sr-only">{m.senderRole === 'RESTAURANT' ? 'Siz: ' : 'Misafir: '}</span>
                  {m.content}
                  <time dateTime={m.createdAt}>{formatDateTime(m.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
          <form className="stack" onSubmit={onSend} noValidate style={{ marginTop: 'var(--space-4)' }}>
            <Field id="mesaj" label="Mesaj yaz" error={msgError}>
              <textarea className="textarea" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <div className="row-between">
              <span className="counter">{text.length}/1000</span>
              <Button type="submit" variant="primary" loading={sending} disabled={!text.trim()}>Gönder</Button>
            </div>
          </form>
        </div>
      </div>
      <ReservationDialogs
        action={action}
        onClose={() => setAction(null)}
        onDone={(u) => { setAction(null); setRes((prev) => (prev ? { ...prev, ...u } : u)); refreshPending(); }}
        onStale={() => { setAction(null); load(); }}
        onSubscriptionRequired={() => setLocked(true)}
      />
    </>
  );
}
