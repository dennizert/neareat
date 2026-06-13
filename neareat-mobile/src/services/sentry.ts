// Mobil crash/exception raporlama (S14-M3).
//
// Env-gated: DSN (app.json → extra.sentryDsn) tanımlı değilse TÜM fonksiyonlar no-op
// (geliştirme/test/DSN'siz build bozulmaz). DSN tanımlıysa @sentry/react-native başlatılır.
// Şifre/token gibi sırlar gönderilmeden önce maskelenir (beforeSend).
import Constants from 'expo-constants';

let _sentry: typeof import('@sentry/react-native') | null = null;
let _initialized = false;

function dsn(): string | null {
  const v = (Constants.expoConfig?.extra as any)?.sentryDsn;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// DSN gizli (token/şifre) alanlarını event gövdesinden temizler.
const PII_RE = /(password|token|authorization|idToken|purchaseToken)/i;
function scrub(event: any): any {
  try {
    if (event?.extra) {
      for (const k of Object.keys(event.extra)) if (PII_RE.test(k)) event.extra[k] = '[redacted]';
    }
    if (event?.request?.headers) delete event.request.headers; // header'larda token olabilir
  } catch { /* yut */ }
  return event;
}

// Uygulama açılışında bir kez çağrılır. DSN yoksa hiçbir şey yapmaz.
export function initSentry(): void {
  if (_initialized) return;
  _initialized = true;
  const d = dsn();
  if (!d) return;
  try {
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    Sentry.init({
      dsn: d,
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: 0, // sadece crash/exception
      beforeSend: scrub,
    });
    _sentry = Sentry;
  } catch {
    _sentry = null; // paket/native yoksa sessizce no-op
  }
}

// Yakalanan bir hatayı Sentry'ye gönderir (no-op if DSN/init yok).
export function captureException(err: unknown): void {
  try { _sentry?.captureException(err); } catch { /* yut */ }
}

// App bileşenini Sentry error boundary ile sarar; DSN yoksa bileşeni olduğu gibi döndürür.
export function wrapWithSentry<T>(AppComponent: T): T {
  return _sentry ? (_sentry.wrap(AppComponent as any) as T) : AppComponent;
}

export const __test = { scrub, dsn };
