const Redis = require('ioredis');

let client;

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

async function cacheGet(key) {
  try {
    const data = await getRedis().get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds) {
  try {
    await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Redis yoksa cache'siz devam et
  }
}

async function cacheDel(key) {
  try {
    await getRedis().del(key);
  } catch {
    // ignore
  }
}

module.exports = { getRedis, cacheGet, cacheSet, cacheDel };
