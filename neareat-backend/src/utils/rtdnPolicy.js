'use strict';

// NEW-B01 — Google Play RTDN bildirimlerinin sıra/tazelik politikası. SAF çekirdek:
// DB, ağ ve zamandan bağımsız, doğrudan birim testi yazılabilir.
//
// NEDEN: `handleGooglePlayRTDN` gelen bildirimi koşulsuz uyguluyordu. Pub/Sub
// EN-AZ-BİR-KEZ teslim garantisi verir — tekrar teslim ve sırasız teslim istisna
// değil, beklenen davranıştır. Aylar önceki bir EXPIRED tekrar teslim edildiğinde
// yenilenmiş, ödenmiş bir abonelik sessizce düşüyordu; restoran panelini ve
// rezervasyon kabulünü kaybediyordu (isRestaurantActive → 403).

// Google Play bildirim tipleri (yalnızca burada kararı etkileyenler).
const NOTIFICATION = {
  RENEWED: 2,
  CANCELED: 3,
  PURCHASED: 4,
  REVOKED: 12,
  EXPIRED: 13,
};

/**
 * `eventTimeMillis` string olarak gelir. Sayıya çevrilemeyen / makul olmayan
 * değerler `null` döner → çağıran sıralama denetimini ATLAR.
 *
 * Bilerek fail-open: zamanı okuyamadığımız için bir yenilemeyi bloklamak,
 * müşteriyi erişimsiz bırakmak demekti. Sıralama denetimi bir iyileştirmedir,
 * işlemenin ön koşulu değil.
 */
function parseEventTime(raw) {
  const ms = Number(raw);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

/**
 * Olay, bilinen son işlenmiş olaydan yeni mi?
 * Eşitlik STALE sayılır — aynı `eventTimeMillis` ile gelen ikinci teslim bir
 * tekrardır, yeni bir olay değil.
 */
function isStaleEvent(eventTimeMs, lastEventAt) {
  if (eventTimeMs == null || !lastEventAt) return false;
  return eventTimeMs <= new Date(lastEventAt).getTime();
}

/**
 * Bildirim, aboneliğin BİLDİĞİMİZ durumuyla çelişiyor mu?
 *
 * Yalnızca EXPIRED (13) için geçerli: "süresi doldu" diyen bir olay, bitişi hâlâ
 * GELECEKTE olan bir abonelik için kendi içinde çelişkilidir → büyük olasılıkla
 * bayat. Bu durumda olaya güvenmek yerine Play'e sorulur.
 *
 * REVOKED (12) KASITLI OLARAK MUAF: iade/iptal doğası gereği bitiş tarihinden
 * ÖNCE gelir, yani gelecekteki bir `expiresAt` orada beklenen durumdur. Çelişki
 * sayıp yok saymak gerçek bir iadeyi kaçırmak olurdu.
 */
function contradictsKnownExpiry(notificationType, expiresAt, now) {
  if (notificationType !== NOTIFICATION.EXPIRED) return false;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > now;
}

/**
 * RTDN bildirimi için karar. Saf.
 *
 * @returns {{action: 'skip'|'verify'|'apply', reason: string}}
 *   - `skip`   → hiçbir yazma yapma (bayat veya tekrar teslim)
 *   - `verify` → olaya güvenme, Play'den güncel durumu çek
 *   - `apply`  → bildirimi bugünkü gibi işle
 */
function decideRtdnAction({ notificationType, eventTimeMs, lastEventAt, expiresAt, now = Date.now() }) {
  // Sıralama denetimi ÖNCE: bayat bir EXPIRED için Play'e sormaya bile gerek yok
  // (gereksiz kota harcaması). Test T9 bu sırayı sabitliyor.
  if (isStaleEvent(eventTimeMs, lastEventAt)) {
    return { action: 'skip', reason: 'stale_or_duplicate' };
  }
  if (contradictsKnownExpiry(notificationType, expiresAt, now)) {
    return { action: 'verify', reason: 'expired_contradicts_future_expiry' };
  }
  return { action: 'apply', reason: 'ok' };
}

module.exports = {
  NOTIFICATION,
  parseEventTime,
  isStaleEvent,
  contradictsKnownExpiry,
  decideRtdnAction,
};
