const { getRedis } = require('../services/redis');
const { logSecurityEvent, EVENTS } = require('./securityLogger');

// Kimliği doğrulanmış kullanıcı başına dakikada maksimum istek sayısı.
// Global IP limitinin yanında, aynı IP'den birden fazla hesap açılmasına karşı koruma sağlar.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;

// Kullanıcı-başına (userId) dakikalık istek limiti. Redis'te kayan pencere sayacı tutar.
// IP bazlı global limitin üstüne, tek IP'den çok hesapla suistimali sınırlar. Redis
// erişilemezse fail-open (servisi engelleme) — limit, kullanılabilirlikten önce gelmez.
module.exports = async function userRateLimit(req, res, next) {
  if (!req.user?.id) return next();

  try {
    const redis = getRedis();
    const windowKey = Math.floor(Date.now() / WINDOW_MS);
    const key = `rl:user:${req.user.id}:${windowKey}`;

    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, WINDOW_MS * 2);

    res.setHeader('X-RateLimit-Limit-User', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining-User', Math.max(0, MAX_REQUESTS - count));

    if (count > MAX_REQUESTS) {
      logSecurityEvent(EVENTS.RATE_LIMIT_HIT, {
        userId: req.user.id,
        ip: req.ip,
        path: req.path,
        requestId: req.id,
        count,
      });
      return res.status(429).json({ error: 'Çok fazla istek gönderildi, lütfen bekleyin' });
    }

    next();
  } catch {
    next(); // Redis hatası durumunda servisi engelleme, fail open
  }
};
