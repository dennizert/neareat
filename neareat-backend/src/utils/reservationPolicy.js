'use strict';

/**
 * Rezervasyon politika çekirdeği — saf, DB/ağ yok (S23-1).
 *
 * Bu üç kural (ay sınırı çapası, girdi doğrulaması, iptal politikası) zamana bağlıdır ve
 * kenar durumları (geçmiş saat, ay dönümü, iptal eşikleri) HTTP akışı ayağa kaldırılmadan
 * doğrudan test edilebilmelidir.
 */

// Mobil tarafın gönderdiği sabit liste ile uyumlu (MakeReservationScreen / EditReservationScreen)
const VALID_OCCASIONS = Object.freeze([
  'Doğum Günü', 'Yıl Dönümü', 'İş Yemeği', 'Arkadaş Buluşması', 'Aile Yemeği', 'Diğer',
]);
const MAX_SPECIAL_REQUESTS = 500;

// İptal politikası eşikleri (saat cinsinden)
const CANCEL_FREE_HOURS = parseInt(process.env.CANCEL_FREE_HOURS || '24', 10);
const CANCEL_PENALTY_HOURS = parseInt(process.env.CANCEL_PENALTY_HOURS || '2', 10);
const CANCEL_PENALTY_STARS = 5;

/**
 * S19-3 overbooking uyarı metni. Karar metniyle BİREBİR aynı olmalı — mobil (S19-6)
 * bu mesajı ve `warning` alanını bekliyor, değişirse kullanıcıya yanlış bilgi gider.
 */
const OVERBOOKING_WARNING = Object.freeze({
  warning: 'OVERBOOKING',
  message: 'Restoranda talebinize uygun yer kalmamıştır. Talebiniz oluşturulmuştur, restoran planlama yapabilirse onaylanacaktır. Aksi halde reddedilecektir.',
});

/**
 * S18-2: İçinde bulunulan takvim ayının başlangıcı (İstanbul UTC+3, DST yok) → UTC.
 * L2 kullanıcının "ayda 1 rezervasyon" kotasını saymak için.
 */
function getIstanbulMonthStartUtc() {
  const ist = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const monthStartIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(monthStartIst - 3 * 60 * 60 * 1000);
}

/**
 * Rezervasyon iş kuralı doğrulaması (format kontrolleri ayrıca yapılır).
 * Geçmiş tarih/saat, occasion whitelist ve specialRequests uzunluğunu denetler.
 * @returns {string|null} Hata mesajı veya geçerliyse null.
 */
function validateReservationInput({ date, time, occasion, specialRequests }) {
  // Türkiye saati (UTC+3, DST yok) olarak yorumla ve şu ana göre kıyasla
  const slot = new Date(`${date}T${time}:00+03:00`);
  if (isNaN(slot.getTime())) return 'Geçersiz tarih veya saat.';
  if (slot.getTime() < Date.now()) return 'Geçmiş bir tarih veya saate rezervasyon yapılamaz.';

  if (occasion && !VALID_OCCASIONS.includes(occasion)) {
    return 'Geçersiz özel gün seçimi.';
  }
  if (specialRequests && String(specialRequests).length > MAX_SPECIAL_REQUESTS) {
    return `Özel istekler en fazla ${MAX_SPECIAL_REQUESTS} karakter olabilir.`;
  }
  return null;
}

/**
 * Rezervasyon için iptal politikasını hesaplar.
 * @param {string} date  "YYYY-MM-DD" (Türkiye yerel tarihi)
 * @param {string} time  "HH:MM"      (Türkiye yerel saati)
 * @param {Date}   [now] Test için override edilebilir
 * @returns {{ allowed: boolean, penalty: number, hoursUntil: number }}
 */
function computeCancelPolicy(date, time, now = new Date()) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  // Turkey = UTC+3; UTC ms = local – 3h
  const reservationUtcMs = Date.UTC(year, month - 1, day, hour - 3, minute);
  const hoursUntil = (reservationUtcMs - now.getTime()) / (60 * 60 * 1000);

  if (hoursUntil < CANCEL_PENALTY_HOURS) return { allowed: false, penalty: 0, hoursUntil };
  if (hoursUntil < CANCEL_FREE_HOURS) return { allowed: true, penalty: CANCEL_PENALTY_STARS, hoursUntil };
  return { allowed: true, penalty: 0, hoursUntil };
}

module.exports = {
  getIstanbulMonthStartUtc,
  validateReservationInput,
  computeCancelPolicy,
  VALID_OCCASIONS,
  MAX_SPECIAL_REQUESTS,
  CANCEL_FREE_HOURS,
  CANCEL_PENALTY_HOURS,
  CANCEL_PENALTY_STARS,
  OVERBOOKING_WARNING,
};
