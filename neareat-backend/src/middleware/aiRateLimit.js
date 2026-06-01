const { getRedis } = require('../services/redis');
const { logSecurityEvent, EVENTS } = require('./securityLogger');

// AI öneri (LLM streaming) ve foto analizi (Vision) gibi PAHALI uçlar için
// kullanıcı bazlı sıkı limit. Anthropic maliyeti yüksek olduğundan, genel
// 60/dk userRateLimit'in üstüne bu ek koruma uygulanır.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = parseInt(process.env.AI_RATE_LIMIT_PER_MIN || '10', 10);

module.exports = async function aiRateLimit(req, res, next) {
  if (!req.user?.id) return next();

  try {
    const redis = getRedis();
    const windowKey = Math.floor(Date.now() / WINDOW_MS);
    const key = `rl:ai:${req.user.id}:${windowKey}`;

    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, WINDOW_MS * 2);

    res.setHeader('X-RateLimit-Limit-AI', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining-AI', Math.max(0, MAX_REQUESTS - count));

    if (count > MAX_REQUESTS) {
      logSecurityEvent(EVENTS.RATE_LIMIT_HIT, {
        userId: req.user.id,
        ip: req.ip,
        path: req.path,
        requestId: req.id,
        count,
        scope: 'ai',
      });
      return res.status(429).json({ error: 'AI özelliği için çok fazla istek gönderildi, lütfen biraz bekleyin.' });
    }

    next();
  } catch {
    next(); // Redis hatası durumunda servisi engelleme — fail open
  }
};
