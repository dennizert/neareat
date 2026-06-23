'use strict';

// S19-2: Restoran KOLTUK + ZAMAN-DİLİMİ bazlı doluluk çekirdeği (saf, test edilebilir).
// Bir rezervasyon `time`'da başlar ve ~TURN_DURATION_MIN (masa çevrim süresi) boyunca
// koltukları işgal eder: [time, time+turn). Yalnızca CONFIRMED rezervasyonlar koltuk düşer
// (PENDING/iptal/no-show düşmez — bunlar çağıran tarafından filtrelenir). Kullanıcıya ham
// yüzde DEĞİL, bant (Müsait/Az yer kaldı/Dolu) gösterilir.

const TURN_DURATION_MIN = parseInt(process.env.RESERVATION_TURN_MINUTES || '120', 10);
// Bant eşiği (yüzde): bunun ALTI "müsait", arası "az yer kaldı", 100+ "dolu".
const OCCUPANCY_LIMITED_PCT = parseInt(process.env.OCCUPANCY_LIMITED_PCT || '70', 10);

/** "HH:MM" → gün-içi dakika. Geçersizse NaN. Saf. */
function toMinutes(hhmm) {
  if (typeof hhmm !== 'string') return NaN;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return NaN;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

/** Bir rezervasyon, verilen an'ı (slotMin) işgal ediyor mu? [start, start+turn). Saf. */
function occupiesSlot(reservationTime, slotMin, turn = TURN_DURATION_MIN) {
  const start = toMinutes(reservationTime);
  if (Number.isNaN(start) || Number.isNaN(slotMin)) return false;
  return slotMin >= start && slotMin < start + turn;
}

/** Bir rezervasyonun işgal ettiği koltuk: reservedSeats (yoksa guestCount). Saf. */
function seatsOf(reservation) {
  const r = reservation.reservedSeats;
  return (typeof r === 'number' && r >= 0) ? r : (reservation.guestCount || 0);
}

/**
 * Belirli bir an (slotMin = "HH:MM" dakikası) için doluluk. `reservations` çağıran
 * tarafından o güne + CONFIRMED'e filtrelenmiş olmalı. seatCapacity null → "bilinmiyor".
 * @returns {{ reserved, capacity, free:number|null, percent:number|null }}
 */
function computeOccupancy(reservations, seatCapacity, slotMin, turn = TURN_DURATION_MIN) {
  let reserved = 0;
  for (const r of reservations || []) {
    if (occupiesSlot(r.time, slotMin, turn)) reserved += seatsOf(r);
  }
  if (seatCapacity == null) {
    return { reserved, capacity: null, free: null, percent: null };
  }
  const free = Math.max(0, seatCapacity - reserved);
  const percent = seatCapacity > 0 ? Math.min(100, Math.round((reserved / seatCapacity) * 100)) : 100;
  return { reserved, capacity: seatCapacity, free, percent };
}

/** Yüzdeyi banta çevirir. null → 'unknown'. Saf. */
function occupancyBand(percent) {
  if (percent == null) return 'unknown';
  if (percent >= 100) return 'full';
  if (percent >= OCCUPANCY_LIMITED_PCT) return 'limited';
  return 'available';
}

/**
 * Bir TALEP (belirli time + guestCount) için yeterli boş koltuk var mı?
 * Talep başlangıç anındaki mevcut CONFIRMED doluluğa bakar. seatCapacity null → bilinmiyor
 * (kapasite kontrolü uygulanmaz → enough:true).
 * @returns {{ known:boolean, reserved:number, free:number|null, enough:boolean, band:string }}
 */
function availabilityForRequest(reservations, seatCapacity, time, guestCount, turn = TURN_DURATION_MIN) {
  const slotMin = toMinutes(time);
  const occ = computeOccupancy(reservations, seatCapacity, slotMin, turn);
  if (seatCapacity == null) {
    return { known: false, reserved: occ.reserved, free: null, enough: true, band: 'unknown' };
  }
  const enough = occ.reserved + (guestCount || 0) <= seatCapacity;
  return { known: true, reserved: occ.reserved, free: occ.free, enough, band: occupancyBand(occ.percent) };
}

/**
 * Gün içi saatlik dilimler için doluluk tablosu (restoran paneli). [startHour, endHour)
 * saat başı dilimler. Saf.
 * @returns {Array<{ time, reserved, free, percent, band }>}
 */
function dailyOccupancySlots(reservations, seatCapacity, startHour = 10, endHour = 24, turn = TURN_DURATION_MIN) {
  const slots = [];
  for (let h = startHour; h < endHour; h++) {
    const slotMin = h * 60;
    const occ = computeOccupancy(reservations, seatCapacity, slotMin, turn);
    slots.push({
      time: `${String(h).padStart(2, '0')}:00`,
      reserved: occ.reserved,
      free: occ.free,
      percent: occ.percent,
      band: occupancyBand(occ.percent),
    });
  }
  return slots;
}

module.exports = {
  TURN_DURATION_MIN,
  OCCUPANCY_LIMITED_PCT,
  toMinutes,
  occupiesSlot,
  seatsOf,
  computeOccupancy,
  occupancyBand,
  availabilityForRequest,
  dailyOccupancySlots,
};
