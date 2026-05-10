const Redis = require('ioredis');

let client;

function getRedis() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null, // bağlanamazsa retry yapma
    });
    client.on('error', () => {}); // hataları sessizce yut
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
