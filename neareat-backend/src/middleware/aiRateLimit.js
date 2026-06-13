const { getRedis } = require('../services/redis');
const { logSecurityEvent, EVENTS } = require('./securityLogger');

// AI öneri (LLM streaming) ve foto analizi (Vision) gibi PAHALI uçlar için
// kullanıcı bazlı sıkı limit. Anthropic maliyeti yüksek olduğundan, genel
// 60/dk userRateLimit'in üstüne bu ek koruma uygulanır.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = parseInt(process.env.AI_RATE_LIMIT_PER_MIN || '10', 10);

// S14-B5: Redis erişilemezse FAIL-OPEN yerine düşük bir süreç-içi (in-memory) fallback
// limiti uygula. Aksi halde Redis çökünce pahalı Anthropic uçları sınırsız çağrılıp
// kontrolsüz maliyet doğurabilirdi. Fallback tek instance kapsamında; amaç felaket-modu freni.
const FALLBACK_MAX = parseInt(process.env.AI_RATE_LIMIT_FALLBACK_PER_MIN || '3', 10);
const memCounters = new Map(); // userId -> { windowKey, count }

function fallbackIncr(userId, windowKey) {
  const entry = memCounters.get(userId);
  if (!entry || entry.windowKey !== windowKey) {
    // Pencere değiştiğinde sınırsız büyümeyi önlemek için eski kayıtları buda.
    if (memCounters.size > 5000) {
      for (const [k, v] of memCounters) if (v.windowKey !== windowKey) memCounters.delete(k);
    }
    memCounters.set(userId, { windowKey, count: 1 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

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
    // Redis erişilemez → fail-CLOSED düşük fallback limiti (maliyet koruması).
    const windowKey = Math.floor(Date.now() / WINDOW_MS);
    const count = fallbackIncr(req.user.id, windowKey);

    res.setHeader('X-RateLimit-Limit-AI', FALLBACK_MAX);
    res.setHeader('X-RateLimit-Remaining-AI', Math.max(0, FALLBACK_MAX - count));

    if (count > FALLBACK_MAX) {
      logSecurityEvent(EVENTS.RATE_LIMIT_HIT, {
        userId: req.user.id,
        ip: req.ip,
        path: req.path,
        requestId: req.id,
        count,
        scope: 'ai-fallback',
      });
      return res.status(429).json({ error: 'AI özelliği şu an yoğun, lütfen biraz sonra tekrar dene.' });
    }

    next();
  }
};
