'use strict';

/**
 * Günlük AI öneri kotası için ATOMİK rezervasyon.
 *
 * Sorun: kota sayacı `AiRecommendationLog` satırlarını sayıyor, ama o satır LLM
 * çağrısından SONRA fire-and-forget yazılıyor (`recommendationService`). Yani uçuştaki
 * istekler birbirini görmüyor: aynı anda gelen N istek de `used=0` okuyup geçiyor ve
 * N× Claude faturası çıkıyor. DB sayımı "tamamlananları", buradaki sayaç ise
 * "başlatılanları" sayar — yarışı kapatan bu ikincisidir.
 *
 * Redis INCR atomiktir; eşzamanlı isteklere 1,2,3… döner, yalnızca ilk N tanesi geçer.
 * Anahtar İstanbul gününe göre (diğer günlük sayaçlarla aynı pencere) ve ertesi gece
 * yarısında biraz sonra expire olur.
 *
 * Redis erişilemezse FAIL-OPEN: mevcut DB kontrolü zaten çalıştığı için davranış
 * bugünküne döner (daha kötü değil). Dakikalık `aiRateLimit` freni de ayrıca duruyor.
 */

const { getRedis } = require('../services/redis');
const { getIstanbulMidnightUtc } = require('./starGuards');

/** İstanbul gününe göre YYYY-MM-DD (gece yarısı penceresiyle aynı). */
function istanbulDayKey(now = new Date()) {
  return getIstanbulMidnightUtc(now).toISOString().slice(0, 10);
}

function keyFor(userId, now) {
  return `ai-used:${userId}:${istanbulDayKey(now)}`;
}

/** Ertesi İstanbul gece yarısına kalan saniye (+1s pay). */
function secondsUntilNextIstanbulMidnight(now = new Date()) {
  const next = getIstanbulMidnightUtc(now).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000) + 1);
}

/**
 * Günlük kotadan bir slot ayırır (atomik).
 * @param {string} userId
 * @param {number|null} limit null = sınırsız (rezervasyon yapılmaz)
 * @returns {Promise<{allowed:boolean, used:number|null, degraded:boolean}>}
 *   degraded=true → Redis yok, karar DB kontrolüne bırakıldı.
 */
async function reserveDailySlot(userId, limit, now = new Date()) {
  if (limit === null || limit === undefined) return { allowed: true, used: null, degraded: false };

  try {
    const redis = getRedis();
    const key = keyFor(userId, now);
    const used = await redis.incr(key);

    // INCR sayı dönmediyse (bozuk/uyumsuz istemci) kotayı BLOKLAMA — aksi halde Redis'in
    // beklenmedik bir davranışı tüm kullanıcıları AI'dan kilitler. Günlük kota için
    // fail-open doğrusu; maliyet freni olarak dakikalık aiRateLimit zaten fail-closed.
    if (typeof used !== 'number' || !Number.isFinite(used)) {
      return { allowed: true, used: null, degraded: true };
    }

    // İlk artışta TTL kur — anahtar sonsuza kadar kalmasın.
    if (used === 1) await redis.expire(key, secondsUntilNextIstanbulMidnight(now));
    return { allowed: used <= limit, used, degraded: false };
  } catch {
    // Redis erişilemez → mevcut DB kontrolüne güven (fail-open).
    return { allowed: true, used: null, degraded: true };
  }
}

/**
 * Ayrılan slotu geri verir. LLM çağrısı BAŞARISIZ olduğunda çağrılır; kullanıcı
 * hakkını yanmamış olsun (fatura da çıkmadı). Best-effort — hatası yutulur.
 */
async function releaseDailySlot(userId, now = new Date()) {
  try {
    await getRedis().decr(keyFor(userId, now));
  } catch {
    // Sayaç ertesi gün zaten sıfırlanır; geri alamamak kullanıcıyı bir hak eksiltir,
    // akışı bozmaz.
  }
}

module.exports = { reserveDailySlot, releaseDailySlot, istanbulDayKey, secondsUntilNextIstanbulMidnight };
