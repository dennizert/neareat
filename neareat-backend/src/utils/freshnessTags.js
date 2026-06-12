/**
 * Tazelik / FOMO etiketleri (Sprint-6 #86).
 *
 * - `minutesUntilClose`: bir mekan şu an açıksa kapanışa kalan dakika (yoksa null).
 *   Önce RestaurantProfile override saatlerinden, yoksa Google `periods` alanından
 *   hesaplanır. Override Türkiye yerel saatinde girilir, periods Google standardıyla.
 * - `isNewlyOpened`: `user_ratings_total < 15 AND rating ≥ 3` heuristic'i.
 *   Google "açılış tarihi" alanı vermediği için yorum sayısı proxy.
 *
 * Hepsi saf fonksiyon — DB/ağ yok, doğrudan test edilebilir.
 */

const CLOSING_SOON_THRESHOLD_MIN = 60;
const CLOSING_VERY_SOON_THRESHOLD_MIN = 30;
const NEW_PLACE_REVIEW_THRESHOLD = 15;
const NEW_PLACE_MIN_RATING = 3.0;

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// "HH:MM" biçimini gün-içi dakikaya çevirir (override saatleri bu formatta girilir).
function parseClock(s) {
  if (typeof s !== 'string') return null;
  const [h, m] = s.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Google `periods` formatındaki "HHMM" (örn. "0930") değerini gün-içi dakikaya çevirir.
function parseHHMM(s) {
  if (typeof s !== 'string' || s.length < 4) return null;
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(2, 4));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Restoran sahibinin girdiği override saatlerden (RestaurantProfile.openingHours)
 * şu anki Türkiye saatine göre kapanışa kalan dakikayı döner. Açık değilse null.
 */
function minutesUntilCloseFromOverride(override, dayIndex, currentMinutes) {
  const day = override?.[DAY_NAMES[dayIndex]];
  if (!day || day.closed) return null;
  const open = parseClock(day.open);
  const close = parseClock(day.close);
  if (open === null || close === null) return null;

  if (close > open) {
    // Aynı gün açılış-kapanış
    if (currentMinutes >= open && currentMinutes < close) return close - currentMinutes;
    return null;
  }
  // Gece yarısını aşan period (örn. 18:00 → 02:00)
  if (currentMinutes >= open) return (24 * 60 - currentMinutes) + close;
  if (currentMinutes < close) return close - currentMinutes;
  return null;
}

/**
 * Google Places `opening_hours.periods` dizisinden şu anki açılış period'ı bul ve
 * kapanışa kalan dakikayı döner. 24/7 ya da kapalıysa null.
 */
function minutesUntilCloseFromPeriods(periods, dayIndex, currentMinutes) {
  if (!Array.isArray(periods)) return null;
  const nextDay = (dayIndex + 1) % 7;
  const prevDay = (dayIndex + 6) % 7;
  for (const p of periods) {
    if (!p?.open || !p?.close) continue; // 24/7 close yok
    const openMin = parseHHMM(p.open.time);
    const closeMin = parseHHMM(p.close.time);
    if (openMin === null || closeMin === null) continue;

    // Aynı gün
    if (p.open.day === dayIndex && p.close.day === dayIndex
        && currentMinutes >= openMin && currentMinutes < closeMin) {
      return closeMin - currentMinutes;
    }
    // Bugün açıldı, yarın kapanır
    if (p.open.day === dayIndex && p.close.day === nextDay && currentMinutes >= openMin) {
      return (24 * 60 - currentMinutes) + closeMin;
    }
    // Dün açıldı, bugün erken saatte kapanır
    if (p.open.day === prevDay && p.close.day === dayIndex && currentMinutes < closeMin) {
      return closeMin - currentMinutes;
    }
  }
  return null;
}

/**
 * Şu anki Türkiye yerel saatinden (dayIndex, currentMinutes) çıkarır.
 * Railway UTC'de çalışıyor → saat farkı +3.
 */
function turkeyDayAndMinutes(now = new Date()) {
  const turkey = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return {
    dayIndex: turkey.getUTCDay(),
    currentMinutes: turkey.getUTCHours() * 60 + turkey.getUTCMinutes(),
  };
}

/**
 * Bir Google Places sonucu + opsiyonel restoran override için tazelik metriklerini hesaplar.
 *
 * @param {object} place  Google Places ham sonucu (name, rating, user_ratings_total,
 *                        opening_hours, ...)
 * @param {object|null} override  RestaurantProfile.openingHours (varsa)
 * @param {Date} [now]    Şu an (test için injectable)
 * @returns {{ minutesUntilClose: number|null, isNewlyOpened: boolean }}
 */
function deriveFreshness(place, override, now = new Date()) {
  const { dayIndex, currentMinutes } = turkeyDayAndMinutes(now);

  let minutesUntilClose = null;
  if (override) {
    minutesUntilClose = minutesUntilCloseFromOverride(override, dayIndex, currentMinutes);
  }
  if (minutesUntilClose === null && place?.opening_hours?.periods) {
    minutesUntilClose = minutesUntilCloseFromPeriods(place.opening_hours.periods, dayIndex, currentMinutes);
  }

  const total = place?.user_ratings_total;
  const rating = place?.rating;
  const isNewlyOpened = typeof total === 'number' && total < NEW_PLACE_REVIEW_THRESHOLD
    && typeof rating === 'number' && rating >= NEW_PLACE_MIN_RATING;

  return { minutesUntilClose, isNewlyOpened };
}

module.exports = {
  deriveFreshness,
  minutesUntilCloseFromOverride,
  minutesUntilCloseFromPeriods,
  turkeyDayAndMinutes,
  CLOSING_SOON_THRESHOLD_MIN,
  CLOSING_VERY_SOON_THRESHOLD_MIN,
  NEW_PLACE_REVIEW_THRESHOLD,
  NEW_PLACE_MIN_RATING,
};
