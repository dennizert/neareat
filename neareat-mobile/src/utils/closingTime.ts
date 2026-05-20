import type { OpeningHoursPeriod } from '../types';

/**
 * Bir restoranın kapanış durumu hakkında bilgi taşıyan arayüz.
 * Restoran kartlarında ve detay ekranında kapanış uyarısı göstermek için kullanılır.
 */
export interface ClosingInfo {
  /** Restoran şu an açık mı */
  isOpen: boolean;
  /** Kapanmaya 60 dakika veya daha az kaldı mı (sarı uyarı gösterilir) */
  closingSoon: boolean;
  /** Kapanmaya 30 dakika veya daha az kaldı mı (kırmızı uyarı gösterilir) */
  closingVerySoon: boolean;
  /** Kapanmaya kaç dakika kaldığı (null ise hesaplanamadı) */
  minutesUntilClose: number | null;
  /** Kapanış saati string formatında (ör. "22:00") */
  closingTimeStr: string | null;
}

/**
 * Restoranın Google Places'tan gelen çalışma saatleri verisini analiz ederek
 * kapanış durumu bilgisini hesaplar.
 *
 * Neden bu fonksiyon yazıldı:
 * Kullanıcılar restorana gitmeden önce kapanış saatini görmeli ve
 * kapanmaya yakın restoranlar için uyarı almalıdır. Bu fonksiyon
 * restoran kartlarında "🕐 45 dk" veya "⚠️ 15 dk" gibi uyarı
 * badge'lerini göstermek için gerekli hesaplamayı yapar.
 * Gece yarısını geçen çalışma saatlerini de doğru hesaplar
 * (ör. 22:00 – 02:00 arası açık restoran).
 *
 * @param openingHours - Google Places API'den dönen çalışma saatleri verisi
 * @returns Restoranın kapanış durumu bilgisi
 */
export function getClosingInfo(openingHours: {
  open_now?: boolean;
  periods?: OpeningHoursPeriod[];
} | null | undefined): ClosingInfo {
  /** Varsayılan boş sonuç — veri yoksa veya hesaplanamazsa bu döner */
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

  /**
   * Bugün açık olan periyodu bul.
   * Gece yarısını geçen periyotlar da dahil edilir — örneğin
   * cumartesi 22:00'de açılıp pazar 02:00'de kapanan restoran.
   */
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

  /** Kapanış saatini dakika cinsine çevir (HHMM formatından) */
  const closeHour = parseInt(todayPeriod.close.time.substring(0, 2), 10);
  const closeMin = parseInt(todayPeriod.close.time.substring(2, 4), 10);
  let closeMinutes = closeHour * 60 + closeMin;

  /**
   * Gece yarısını geçen kapanış saati düzeltmesi.
   * Örneğin kapanış 01:00 ise ve kapanış günü yarınsa,
   * 01:00 → 25:00 (1500 dakika) olarak hesaplanır.
   */
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
