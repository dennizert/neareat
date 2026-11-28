import { useState, type FormEvent } from 'react';
import { PageHeader } from '../components/AuthLayout';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Alert } from '../components/Feedback';
import { ConfirmDialog } from '../components/Dialog';
import { CampaignLimitError, sendCampaign, type CampaignAudience } from '../services/restaurantAccount';
import { getErrorMessage, isSubscriptionRequired } from '../api/client';
import { toast } from '../store/toastStore';
import { validateCampaignMessage } from '../utils/validation';

export const CAMPAIGN_MAX = 200;
export const AUDIENCES: { key: CampaignAudience; label: string; desc: string }[] = [
  { key: 'all', label: 'Herkes', desc: 'Favorileyenler + rezervasyon yapanlar' },
  { key: 'favorites', label: 'Favorileyenler', desc: 'Restoranı favorileyen kullanıcılar' },
  { key: 'reservations', label: 'Rezervasyon yapanlar', desc: 'Daha önce rezervasyon yapanlar' },
];

export default function CampaignPage() {
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<CampaignAudience>('all');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; lock?: 'limit' | 'subscription' } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  function ask(e: FormEvent) {
    e.preventDefault();
    const v = validateCampaignMessage(message);
    setFieldError(v);
    if (!v) setConfirm(true);
  }

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await sendCampaign(message.trim(), audience);
      setSent(r.sent);
      setMessage('');
      toast(`Kampanya ${r.sent} kullanıcıya gönderildi.`, 'success');
    } catch (err) {
      if (err instanceof CampaignLimitError) setError({ text: err.message, lock: 'limit' });
      else if (isSubscriptionRequired(err)) setError({ text: getErrorMessage(err), lock: 'subscription' });
      else setError({ text: getErrorMessage(err, 'Kampanya gönderilemedi.') });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  const locked = !!error?.lock;
  const aud = AUDIENCES.find((a) => a.key === audience);

  return (
    <>
      <PageHeader title="Kampanya" description="Restoranınızı favorileyen veya rezervasyon yapan kullanıcılara anlık bir bildirim gönderin. Günde yalnızca 1 kampanya hakkınız var." />
      {error && <div className="section"><Alert tone="danger" icon={error.lock ? 'lock' : undefined}>{error.text}</Alert></div>}
      {sent != null && !error && <div className="section"><Alert tone="success" title="Kampanya gönderildi.">{sent} kullanıcıya bildirim gitti.</Alert></div>}
      <form className="card" onSubmit={ask} noValidate style={{ maxWidth: 640 }}>
        <Field id="campaign-msg" label="Mesaj" error={fieldError} hint="5-200 karakter">
          <textarea className="textarea" rows={4} maxLength={CAMPAIGN_MAX} placeholder="Örn: Bu akşam tüm pizzalarda %20 indirim!" value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <p className="counter" aria-live="polite">{message.length}/{CAMPAIGN_MAX}</p>
        <fieldset style={{ border: 0, padding: 0, margin: 'var(--space-4) 0 0' }}>
          <legend className="label">Hedef kitle</legend>
          {AUDIENCES.map((a) => (
            <label key={a.key} className="check" style={{ border: '1px solid var(--border-input)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <input type="radio" name="audience" value={a.key} checked={audience === a.key} onChange={() => setAudience(a.key)} />
              <span><strong>{a.label}</strong><br /><span className="subtle">{a.desc}</span></span>
            </label>
          ))}
        </fieldset>
        <div className="row" style={{ marginTop: 'var(--space-5)', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="primary" icon="megaphone" disabled={locked}>Kampanyayı gönder</Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirm}
        title="Kampanyayı gönder"
        message={<p className="muted">"{message.trim()}" mesajı <strong>{aud?.label}</strong> kitlesine bildirim olarak gönderilecek. Bugün başka kampanya gönderemezsiniz.</p>}
        confirmLabel="Gönder"
        busy={busy}
        onConfirm={send}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
