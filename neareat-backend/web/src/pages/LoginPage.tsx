import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Alert } from '../components/Feedback';
import { Button } from '../components/Button';
import { Field, PasswordInput } from '../components/Field';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { classifyAuthError, getErrorMessage, type AuthErrorKind } from '../api/client';
import { canUsePanel, safeReturnPath, useSessionStore, WrongRoleError } from '../store/sessionStore';
import { validateEmail } from '../utils/validation';

/** 429 sonrası düğme kilidi (backend authLimiter penceresi 15 dk; düğme kısa süre kilitlenir). */
export const LOCK_MS = 60_000;

function ErrorBanner({ kind, google, message }: { kind: AuthErrorKind; google: boolean; message?: string }) {
  switch (kind) {
    case 'invalid':
      return google
        ? <Alert tone="danger" title="Google hesabınızla giriş yapılamadı.">{message || 'Bu Google hesabıyla restoran paneline giriş yapılamıyor.'}</Alert>
        : <Alert tone="danger" title="E-posta veya şifre hatalı.">Lütfen bilgilerinizi kontrol edip tekrar deneyin.</Alert>;
    case 'role':
      return <Alert tone="warning" title="Bu panel restoran sahipleri ve yöneticiler içindir.">Kullanıcı hesabınızla Eatlas mobil uygulamasını kullanabilirsiniz.</Alert>;
    case 'suspended':
      return <Alert tone="danger" icon="lock" title="Hesabınız askıya alınmıştır.">Destek için info@eatlas.app adresine yazabilirsiniz.</Alert>;
    case 'locked':
      return <Alert tone="danger" icon="lock" title="Çok fazla deneme yapıldı.">Güvenliğiniz için 15 dakika sonra tekrar deneyin.</Alert>;
    case 'network':
      return <Alert tone="danger" title="Sunucuya ulaşılamadı.">Bağlantınızı kontrol edip tekrar deneyin.</Alert>;
    default:
      return <Alert tone="danger" title="Giriş yapılamadı.">Lütfen biraz sonra tekrar deneyin.</Alert>;
  }
}

export default function LoginPage() {
  const loginEmail = useSessionStore((s) => s.loginEmail);
  const loginGoogle = useSessionStore((s) => s.loginGoogle);
  const notice = useSessionStore((s) => s.notice);
  const setNotice = useSessionStore((s) => s.setNotice);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<{ kind: AuthErrorKind; google: boolean; message?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const lockTimer = useRef<number | undefined>(undefined);
  const [shownNotice] = useState(notice);

  useEffect(() => {
    if (notice) setNotice(null); // bir kez göster
  }, [notice, setNotice]);
  useEffect(() => () => window.clearTimeout(lockTimer.current), []);

  const returnTo = safeReturnPath(params.get('donus')) ?? safeReturnPath((location.state as { from?: string } | null)?.from);
  const locked = lockedUntil > Date.now();

  function afterLogin() {
    const r = useSessionStore.getState().restaurant;
    if (!canUsePanel(r)) navigate('/basvuru-durumu', { replace: true });
    else navigate(returnTo ?? '/', { replace: true });
  }

  function handleError(err: unknown, google: boolean) {
    const kind = err instanceof WrongRoleError ? 'role' : classifyAuthError(err);
    setError({ kind, google, message: google ? getErrorMessage(err, '') : undefined });
    if (kind === 'locked') {
      setLockedUntil(Date.now() + LOCK_MS);
      window.clearTimeout(lockTimer.current);
      lockTimer.current = window.setTimeout(() => setLockedUntil(0), LOCK_MS);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || locked) return;
    const eErr = validateEmail(email);
    const pErr = password ? null : 'Bu alan zorunludur.';
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;
    setBusy(true);
    setError(null);
    try {
      await loginEmail(email.trim().toLowerCase(), password);
      afterLogin();
    } catch (err) {
      handleError(err, false);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle(credential: string) {
    if (busy || locked) return;
    setBusy(true);
    setError(null);
    try {
      await loginGoogle(credential);
      afterLogin();
    } catch (err) {
      handleError(err, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Panele giriş"
      subtitle="Restoranınızı ve rezervasyonlarınızı yönetin."
      foot={<>Restoranınız Eatlas'ta yok mu? <Link to="/kayit">Restoran başvurusu yapın</Link></>}
    >
      <form className="stack" onSubmit={onSubmit} noValidate>
        {shownNotice === 'expired' && <Alert tone="warning" title="Oturumunuzun süresi doldu.">Devam etmek için tekrar giriş yapın.</Alert>}
        {shownNotice === 'loggedOut' && <Alert tone="success" title="Çıkış yaptınız." />}
        {shownNotice === 'applicationReceived' && <Alert tone="success" title="Başvurunuz alındı, giriş yapın.">Başvurunuzun durumunu giriş yaptıktan sonra görebilirsiniz.</Alert>}
        <GoogleSignInButton onCredential={onGoogle} disabled={busy || locked} />
        {error && <ErrorBanner kind={error.kind} google={error.google} message={error.message} />}
        <Field id="email" label="E-posta" error={emailError ?? undefined}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="ornek@isletme.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error?.kind === 'invalid' && !error.google ? 'true' : undefined}
          />
        </Field>
        <Field id="sifre" label="Şifre" error={passwordError ?? undefined}>
          <PasswordInput autoComplete="current-password" placeholder="En az 8 karakter" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="row-between">
          <span />
          <Link to="/sifre-sifirla" className="subtle" style={{ color: 'var(--text-link)' }}>Şifremi unuttum</Link>
        </div>
        <Button type="submit" variant="primary" block loading={busy} disabled={locked}>Giriş yap</Button>
      </form>
    </AuthLayout>
  );
}
