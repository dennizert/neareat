import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Alert, EmptyState } from '../components/Feedback';
import { Button } from '../components/Button';
import { Field, PasswordInput } from '../components/Field';
import { Icon } from '../components/Icon';
import { forgotPassword, resetPassword } from '../services/auth';
import { getErrorMessage, getStatus } from '../api/client';
import { validateEmail, validatePassword, validatePasswordConfirm } from '../utils/validation';

type View = 'request' | 'sent' | 'new' | 'done' | 'invalid';

/**
 * `/panel/sifre-sifirla` (talep) ve `/panel/sifre-sifirla?token=` (yeni şifre).
 * Hesap var/yok ve throttle (429) durumlarında AYNI "gönderildi" ekranı — sayım sızdırmaz.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [view, setView] = useState<View>(token ? 'new' : 'request');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pw2Error, setPw2Error] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const err = validateEmail(email);
    setEmailError(err);
    if (err) return;
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setView('sent');
    } catch (ex) {
      // 429 (IP limiti) dahil: hesabın varlığını/throttle durumunu sızdırmamak için aynı ekran.
      if (getStatus(ex) === 429) setView('sent');
      else setError(getErrorMessage(ex, 'Bağlantı gönderilemedi. Lütfen tekrar deneyin.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitNew(e: FormEvent) {
    e.preventDefault();
    if (busy || !token) return;
    const a = validatePassword(pw);
    const b = validatePasswordConfirm(pw, pw2);
    setPwError(a);
    setPw2Error(b);
    if (a || b) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, pw);
      setView('done');
    } catch (ex) {
      const msg = getErrorMessage(ex, '');
      if (getStatus(ex) === 400 && /geçersiz|süresi dolmuş/i.test(msg)) setView('invalid');
      else setError(msg || 'Şifre güncellenemedi. Lütfen tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  function requestNewLink() {
    navigate('/sifre-sifirla', { replace: true });
    setView('request');
  }

  return (
    <AuthLayout title="Şifre sıfırlama">
      {view === 'request' && (
        <form className="stack" onSubmit={sendLink} noValidate>
          <p className="muted">Hesabınıza bağlı e-posta adresini girin. Şifre sıfırlama bağlantısı göndereceğiz.</p>
          {error && <Alert tone="danger" title={error} />}
          <Field id="r-email" label="E-posta" error={emailError}>
            <input className="input" type="email" autoComplete="email" inputMode="email" placeholder="ornek@isletme.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" block loading={busy}>Bağlantı gönder</Button>
          <Link className="btn btn-ghost btn-block" to="/giris"><Icon name="chev-l" />Girişe dön</Link>
        </form>
      )}
      {view === 'sent' && (
        <div style={{ padding: 'var(--space-4) 0' }}>
          <EmptyState icon="mail" title="E-postanızı kontrol edin" action={(
            <Button variant="secondary" loading={busy} onClick={() => sendLink()}>Tekrar gönder</Button>
          )}>
            Bu adres kayıtlıysa birkaç dakika içinde bir sıfırlama bağlantısı gelecek. Bağlantı 1 saat geçerlidir.
          </EmptyState>
          <p className="subtle" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>Saatte en fazla 3 gönderim yapılabilir.</p>
          <p style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}><Link to="/giris">Girişe dön</Link></p>
        </div>
      )}
      {view === 'new' && (
        <form className="stack" onSubmit={submitNew} noValidate>
          <p className="muted">Yeni şifrenizi belirleyin.</p>
          {error && <Alert tone="danger" title={error} />}
          <Field id="n1" label="Yeni şifre" hint="En az 8 karakter." error={pwError}>
            <PasswordInput autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field id="n2" label="Yeni şifre (tekrar)" error={pw2Error}>
            <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" block loading={busy}>Şifreyi güncelle</Button>
        </form>
      )}
      {view === 'done' && (
        <div style={{ padding: 'var(--space-4) 0' }}>
          <EmptyState icon="check-circle" tone="success" title="Şifreniz güncellendi" action={<Link className="btn btn-primary" to="/giris">Giriş yap</Link>}>
            Açık olan diğer oturumlarınız kapatıldı. Yeni şifrenizle giriş yapabilirsiniz.
          </EmptyState>
        </div>
      )}
      {view === 'invalid' && (
        <div style={{ padding: 'var(--space-4) 0' }}>
          <EmptyState icon="x-circle" tone="danger" title="Bağlantı geçersiz" action={<Button variant="primary" onClick={requestNewLink}>Yeni bağlantı iste</Button>}>
            Bu bağlantının süresi dolmuş ya da daha önce kullanılmış.
          </EmptyState>
        </div>
      )}
    </AuthLayout>
  );
}
