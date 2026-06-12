// Güvenlik olaylarını yapılandırılmış formatta loglar.
// İleride Datadog / Sentry / Slack entegrasyonu buraya eklenir.

const EVENTS = {
  AUTH_FAILED: 'AUTH_FAILED',
  SUSPENDED_ACCESS: 'SUSPENDED_ACCESS',
  SEED_BLOCKED: 'SEED_BLOCKED',
  RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
  IAP_REJECTED: 'IAP_REJECTED',
  ADMIN_LOGIN_LOCKED: 'ADMIN_LOGIN_LOCKED',
};

// Güvenlik olaylarını (başarısız giriş, askıya alınmış erişim, rate-limit, IAP reddi vb.)
// yapılandırılmış JSON olarak loglar. Tek noktada toplanır → ileride Sentry/Datadog/Slack'e
// kolayca yönlendirilebilir.
function logSecurityEvent(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };
  console.warn('[SECURITY]', JSON.stringify(entry));
}

module.exports = { logSecurityEvent, EVENTS };
