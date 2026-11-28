import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { EmptyState, ErrorState, SkeletonBlock } from '../components/Feedback';
import { ConfirmDialog } from '../components/Dialog';
import { deleteReply, getMyRestaurantReviews, replyToReview } from '../services/restaurantAccount';
import { getErrorMessage } from '../api/client';
import { toast } from '../store/toastStore';
import { formatDateShort } from '../utils/format';
import { validateReply } from '../utils/validation';
import type { AppReview } from '../types';

export const REPLY_MAX = 500;

function Stars({ value }: { value: number }) {
  return <span aria-label={`${value} / 5 puan`} style={{ color: 'var(--amber-text)' }}>{'★'.repeat(value)}<span style={{ color: 'var(--bar-track)' }}>{'★'.repeat(Math.max(0, 5 - value))}</span></span>;
}

function ReviewItem({ review, onChange, onAskDelete }: { review: AppReview; onChange: (r: AppReview) => void; onAskDelete: (r: AppReview) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.reply?.content ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = `reply-${review.id}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const v = validateReply(text);
    setError(v);
    if (v) return;
    setBusy(true);
    try {
      const reply = await replyToReview(review.id, text.trim());
      onChange({ ...review, reply: reply ?? { id: 'local', content: text.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), restaurant: { businessName: '' } } });
      setOpen(false);
      toast('Yanıtınız yayınlandı.', 'success');
    } catch (err) {
      setError(getErrorMessage(err, 'Yanıt gönderilemedi.')); // içerik filtresi mesajı birebir
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="review">
      <div className="row-between">
        <strong>{review.user?.displayName ?? 'Kullanıcı'}</strong>
        <span className="subtle">{formatDateShort(review.createdAt)}</span>
      </div>
      <Stars value={review.rating} />
      {review.body && <p className="wrap-anywhere" style={{ marginTop: 'var(--space-2)' }}>{review.body}</p>}
      {review.reply && !open && (
        <div className="reply">
          <div className="subtle">Yanıtınız · {formatDateShort(review.reply.updatedAt || review.reply.createdAt)}</div>
          {review.reply.content}
        </div>
      )}
      {open ? (
        <form className="stack" onSubmit={submit} noValidate style={{ marginTop: 'var(--space-3)' }}>
          <Field id={id} label="Yanıtınız" error={error}>
            <textarea className="textarea" rows={3} maxLength={REPLY_MAX} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="row-between">
            <span className="counter" aria-live="polite">{text.length}/{REPLY_MAX}</span>
            <div className="row">
              <Button variant="secondary" onClick={() => { setOpen(false); setError(null); setText(review.reply?.content ?? ''); }}>Vazgeç</Button>
              <Button type="submit" variant="primary" loading={busy} disabled={!text.trim()}>Yanıtla</Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="row" style={{ marginTop: 'var(--space-3)' }}>
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{review.reply ? 'Yanıtı düzenle' : 'Yanıtla'}</Button>
          {review.reply && <Button size="sm" variant="ghost" onClick={() => onAskDelete(review)}>Yanıtı sil</Button>}
        </div>
      )}
    </li>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AppReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AppReview | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReviews(await getMyRestaurantReviews());
    } catch (err) {
      setError(getErrorMessage(err, 'Yorumlar yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteReply(toDelete.id);
      setReviews((prev) => prev.map((r) => (r.id === toDelete.id ? { ...r, reply: null } : r)));
      toast('Yanıt silindi.', 'success');
      setToDelete(null);
    } catch (err) {
      toast(getErrorMessage(err, 'Silinemedi.'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader title="Yorumlar" description="Eatlas kullanıcılarının restoranınız için yazdığı yorumlar." />
      {loading ? <SkeletonBlock /> : error ? <ErrorState message={error} onRetry={load} /> : reviews.length === 0 ? (
        <div className="card"><EmptyState icon="star" title="Henüz yorum yok">Kullanıcılar yorum yazdığında burada görünür ve yanıtlayabilirsiniz.</EmptyState></div>
      ) : (
        <div className="card">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {reviews.map((r) => (
              <ReviewItem key={r.id} review={r} onChange={(u) => setReviews((prev) => prev.map((x) => (x.id === u.id ? u : x)))} onAskDelete={setToDelete} />
            ))}
          </ul>
        </div>
      )}
      <ConfirmDialog open={!!toDelete} title="Yanıtı sil" message="Bu yoruma verdiğiniz yanıt silinecek." confirmLabel="Sil" tone="danger" busy={deleting} onConfirm={confirmDelete} onClose={() => setToDelete(null)} />
    </>
  );
}
