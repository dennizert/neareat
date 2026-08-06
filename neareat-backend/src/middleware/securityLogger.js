// Güvenlik olaylarını yapılandırılmış formatta loglar + (S14-B3) Sentry'ye iletir.

const { captureSecurityEvent } = require('../services/sentry');
const { getRequestId } = require('../utils/requestContext'); // S21-2

const EVENTS = {
  AUTH_FAILED: 'AUTH_FAILED',
  SUSPENDED_ACCESS: 'SUSPENDED_ACCESS',
  SEED_BLOCKED: 'SEED_BLOCKED',
  RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
  IAP_REJECTED: 'IAP_REJECTED',
  ADMIN_LOGIN_LOCKED: 'ADMIN_LOGIN_LOCKED',
  METRICS_ALARM: 'METRICS_ALARM',
};

// Güvenlik olaylarını (başarısız giriş, askıya alınmış erişim, rate-limit, IAP reddi vb.)
// yapılandırılmış JSON olarak loglar. Tek noktada toplanır → ileride Sentry/Datadog/Slack'e
// kolayca yönlendirilebilir.
function logSecurityEvent(event, details = {}) {
  // S21-2 — çıktı BİÇİMİ kasıtlı olarak değiştirilmedi: `console.warn('[SECURITY]', <json>)`
  // sözleşmesi testlerle sabitlenmiş ve dışarıdan ayrıştırılıyor olabilir. Yalnızca İÇERİK
  // zenginleştirildi: çağıran açıkça geçmediyse requestId istek bağlamından eklenir.
  const contextRequestId = getRequestId();
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...(contextRequestId ? { requestId: contextRequestId } : {}),
    ...details, // çağıranın açık değeri bağlamdakini ezer
  };
  console.warn('[SECURITY]', JSON.stringify(entry));
  captureSecurityEvent(event, details); // DSN yoksa no-op
}

module.exports = { logSecurityEvent, EVENTS };
