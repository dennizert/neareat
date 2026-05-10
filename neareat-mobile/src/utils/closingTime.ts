import type { OpeningHoursPeriod } from '../types';

export interface ClosingInfo {
  isOpen: boolean;
  closingSoon: boolean;      // kapanmaya 60 dk kaldı
  closingVerySoon: boolean;  // kapanmaya 30 dk kaldı
  minutesUntilClose: number | null;
  closingTimeStr: string | null; // "22:00"
}

export function getClosingInfo(openingHours: {
  open_now?: boolean;
  periods?: OpeningHoursPeriod[];
} | null | undefined): ClosingInfo {
  const empty: ClosingInfo = {
    isOpen: openingHours?.open_now ?? false,
    closingSoon: false,
    closingVerySoon: false,
    minutesUntilClose: null,
    closingTimeStr: null,
  };

  if (!openingHours?.periods?.length) return empty;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Pazar
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Bugün açık olan periyodu bul (gece yarısını geçen periyot da dahil)
  const todayPeriod = openingHours.periods.find(p => {
    if (!p.close) return false;
    const openDay = p.open.day;
    const closeDay = p.close.day;
    // Normal gün: açılış günü bugün
    if (openDay === dayOfWeek) return true;
    // Gece geçen periyot: dünün açılışı bugün kapanıyor
    if (closeDay === dayOfWeek && openDay === (dayOfWeek - 1 + 7) % 7) return true;
    return false;
  });

  if (!todayPeriod?.close) return empty;

  const closeHour = parseInt(todayPeriod.close.time.substring(0, 2), 10);
  const closeMin = parseInt(todayPeriod.close.time.substring(2, 4), 10);
  let closeMinutes = closeHour * 60 + closeMin;

  // Gece geçen kapanış (örn. 01:00 → 25:00 olarak hesapla)
  if (todayPeriod.close.day !== dayOfWeek) {
    closeMinutes += 24 * 60;
  }

  const diff = closeMinutes - currentMinutes;

  return {
    isOpen: openingHours.open_now ?? diff > 0,
    closingSoon: diff > 0 && diff <= 60,
    closingVerySoon: diff > 0 && diff <= 30,
    minutesUntilClose: diff > 0 ? diff : null,
    closingTimeStr: `${String(closeHour).padStart(2, '0')}:${String(closeMin).padStart(2, '0')}`,
  };
}
