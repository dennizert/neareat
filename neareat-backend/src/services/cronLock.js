'use strict';

/**
 * Cron leader-lock (S16-6) — çok-replikada cron'ların yalnızca BİR replikada çalışması.
 *
 * Neden: tüm cron'lar in-process `node-cron` ile zamanlanıyor. Backend 2+ replikaya
 * çıkınca (S16-8 yatay ölçekleme) her replika aynı tetiklemede aynı işi çalıştırır →
 * mükerrer bildirim/escalation/aggregation + yarış. Bu modül, her tetikleme öncesi
 * Redis'te kısa-ömürlü bir kilit (`SET key val NX PX ttl`) alır; kilidi alan çalışır,
 * alamayan o tetiklemeyi atlar. Kilit serbest BIRAKILMAZ; TTL ile dolar → bir sonraki
 * (saatlik/günlük) tetiklemeye kadar başka replika aynı işi tekrar etmez. Her job zaten
 * idempotent olduğundan (damga/kontrol) bu ikinci savunma hattıyla birlikte en-fazla-bir
 * etkisi sağlanır.
 *
 * Redis erişilemezse FAIL-OPEN: tek-instance varsayımıyla iş çalıştırılır (mevcut
 * davranış korunur). Çok-replika + Redis-yok aynı anda olursa idempotency devreye girer.
 *
 * Admin manuel tetikleme bu sarmalayıcıyı KULLANMAZ (run fonksiyonunu doğrudan çağırır)
 * → kasıtlı manuel çalıştırma kilide takılmaz.
 */

const crypto = require('crypto');
const { getRedis } = require('./redis');

// Bu süreç (replika) için benzersiz kimlik — kilit sahipliğini ayırt etmek/loglamak için.
const INSTANCE_ID = crypto.randomUUID();

// Varsayılan kilit TTL'i: en kısa cron aralığından (saatlik = 60dk) küçük, ama job
// süresi + replikaların aynı tetiklemeyi yakalama penceresinden büyük. 30dk güvenli.
const DEFAULT_TTL_MS = parseInt(process.env.CRON_LOCK_TTL_MS || `${30 * 60 * 1000}`, 10);

/**
 * Bir cron işini leader-lock altında çalıştırır.
 * @param {string} jobName  Kilit anahtarı için kısa, sabit ad.
 * @param {() => Promise<any>} fn  İş fonksiyonu.
 * @param {{ ttlMs?: number }} [opts]
 * @returns {Promise<{ skipped: true } | any>}  Atlandıysa { skipped:true }, aksi halde fn sonucu.
 */
async function withCronLock(jobName, fn, opts = {}) {
  const ttlMs = opts.ttlMs || DEFAULT_TTL_MS;
  const key = `cron-lock:${jobName}`;

  let acquired = false;
  let redisOk = true;
  try {
    // ioredis: SET key val PX <ttl> NX → 'OK' (alındı) | null (zaten var)
    const res = await getRedis().set(key, INSTANCE_ID, 'PX', ttlMs, 'NX');
    acquired = res === 'OK';
  } catch {
    redisOk = false; // Redis yok → fail-open
  }

  if (!redisOk) {
    // Tek-instance varsayımı: çalıştır (mevcut davranış). Çok-replikada idempotency korur.
    return fn();
  }
  if (!acquired) {
    console.log(`[cron] ${jobName} atlandı — kilit başka replikada`);
    return { skipped: true };
  }
  console.log(`[cron] ${jobName} kilidi alındı (instance=${INSTANCE_ID.slice(0, 8)})`);
  return fn();
}

module.exports = { withCronLock, INSTANCE_ID, DEFAULT_TTL_MS };
