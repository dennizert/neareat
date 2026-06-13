const Redis = require('ioredis');
const { recordRedis } = require('./metrics'); // S16-2 — cache isabet/ıska metriği

let client;

// Tekil (singleton) ioredis bağlantısını döndürür; ilk çağrıda lazy oluşturur.
// Railway private domain IPv6-only olduğu ve Redis erişilemez olduğunda uygulamanın
// çökmemesi gerektiği için bağlantı ayarları buna göre (family:0, sınırlı retry) yapılır.
function getRedis() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      // Railway private domain (redis.railway.internal) yalnızca IPv6 (AAAA) çözülür;
      // ioredis varsayılanı IPv4 (family:4) olduğundan bağlanamıyordu. family:0 = IPv4+IPv6.
      family: 0,
      lazyConnect: true,
      enableOfflineQueue: false,
      // İlk hatada kalıcı bırakma; sınırlı geri çekilmeyle transient kopmadan kurtul,
      // 10 denemeden sonra vazgeç (gerçekten kapalıysa spam yapma).
      retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 2000)),
      maxRetriesPerRequest: 2,
    });
    client.on('error', (err) => console.warn('[Redis]', err.message)); // hataları logla
  }
  return client;
}

// Cache'ten JSON değer okur. Redis hatası/erişilemezliği uygulamayı bozmamalı:
// her durumda null döner (cache-miss gibi davranır → çağıran kaynağı yeniden hesaplar).
async function cacheGet(key) {
  try {
    const data = await getRedis().get(key);
    const hit = data != null;
    recordRedis(hit); // S16-2 — yalnızca başarılı get'te say (Redis hatası ≠ ıska)
    return hit ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Değeri TTL ile cache'e yazar. Redis yoksa sessizce geçer (fail-open) — cache opsiyoneldir.
async function cacheSet(key, value, ttlSeconds) {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Redis yoksa cache'siz devam et
  }
}

// Cache anahtarını siler (örn. başarılı admin login sonrası fail sayacını sıfırlama).
async function cacheDel(key) {
  try {
    await getRedis().del(key);
  } catch {
    // ignore
  }
}

/**
 * Çok sayıda değeri TEK pipeline ile yazar (S16-5) — toplu işlerde (friendSuggestions
 * cron) viewer başına ayrı round-trip yerine. entries: [{ key, value }]. Redis yoksa
 * fail-open (sessizce geç). 10k sıralı SET → tek pipeline'a indirir.
 */
async function cacheSetMany(entries, ttlSeconds) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  try {
    const pipeline = getRedis().pipeline();
    for (const { key, value } of entries) {
      pipeline.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }
    await pipeline.exec();
  } catch {
    // Redis yoksa cache'siz devam et
  }
}

module.exports = { getRedis, cacheGet, cacheSet, cacheSetMany, cacheDel };
