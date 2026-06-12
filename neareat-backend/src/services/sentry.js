// Merkezi gözlemlenebilirlik (S14-B3).
//
// Neden: Güvenlik olayları (AUTH_FAILED, RATE_LIMIT_HIT, IAP_REJECTED, ADMIN_LOGIN_LOCKED)
// ve 5xx hataları sadece console'a yazılıyordu; Railway logları kalıcı değil ve alarm yok.
// Bu servis bunları Sentry'ye iletir.
//
// Env-gated: SENTRY_DSN tanımlı değilse TÜM fonksiyonlar no-op (geliştirme/test bozulmaz).
// Şifre/token gibi sırlar gönderilmeden önce maskelenir.

let _sentry = null;
let _initialized = false;

// Sentry istemcisini lazy başlatır; DSN yoksa null (no-op).
function getSentry() {
  if (_initialized) return _sentry;
  _initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return (_sentry = null);
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0, // sadece hata/olay; performans trace yok
    });
    _sentry = Sentry;
  } catch (err) {
    console.warn('[Sentry] init başarısız:', err.message);
    _sentry = null;
  }
  return _sentry;
}

const PII_KEYS = new Set(['password', 'passwordHash', 'token', 'purchaseToken', 'authorization', 'idToken']);

// Bağlam nesnesinden sır içeren alanları maskeler (PII/secret sızıntısını önler).
function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = PII_KEYS.has(k) ? '[redacted]' : v;
  }
  return out;
}

// 5xx/yakalanmamış hatayı Sentry'ye exception olarak gönderir (no-op if DSN yok).
function captureException(err, context) {
  const s = getSentry();
  if (!s) return;
  try {
    s.captureException(err, context ? { extra: scrub(context) } : undefined);
  } catch { /* gözlemlenebilirlik asıl akışı bozmamalı */ }
}

// Güvenlik olayını Sentry'ye uyarı seviyesinde mesaj olarak iletir (no-op if DSN yok).
function captureSecurityEvent(event, details) {
  const s = getSentry();
  if (!s) return;
  try {
    s.captureMessage(`[SECURITY] ${event}`, { level: 'warning', extra: scrub(details || {}) });
  } catch { /* yut */ }
}

module.exports = { getSentry, captureException, captureSecurityEvent, scrub };
