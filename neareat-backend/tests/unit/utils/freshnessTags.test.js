'use strict';

/**
 * Sprint-6 #86 — tazelik etiketi hesaplama (saf fonksiyon).
 */

const {
  deriveFreshness,
  minutesUntilCloseFromOverride,
  minutesUntilCloseFromPeriods,
  turkeyDayAndMinutes,
  CLOSING_SOON_THRESHOLD_MIN,
} = require('../../../src/utils/freshnessTags');

// 2026-05-30 (Cumartesi) saat 23:30 UTC = 02:30 TR Pazar — gece yarısı geçişi testi için
const SAT_NIGHT_UTC = new Date('2026-05-30T23:30:00Z');
// 2026-05-30 Cumartesi 17:00 UTC = 20:00 TR
const SAT_EVENING_UTC = new Date('2026-05-30T17:00:00Z');

describe('turkeyDayAndMinutes', () => {
  it('UTC+3 ofsetiyle TR günü/dakikası', () => {
    const r = turkeyDayAndMinutes(SAT_EVENING_UTC);
    expect(r.dayIndex).toBe(6); // Cumartesi
    expect(r.currentMinutes).toBe(20 * 60); // 20:00
  });
  it('gece yarısı geçtiğinde Pazar', () => {
    const r = turkeyDayAndMinutes(SAT_NIGHT_UTC);
    expect(r.dayIndex).toBe(0); // Pazar
    expect(r.currentMinutes).toBe(2 * 60 + 30);
  });
});

describe('minutesUntilCloseFromOverride', () => {
  const override = {
    monday: { open: '09:00', close: '22:00' },
    saturday: { open: '18:00', close: '02:00' },  // gece yarısını aşıyor
    sunday: { closed: true },
  };

  it('aynı gün aralığında doğru dakika', () => {
    // Pazartesi 20:00 → kapanışa 120 dk
    expect(minutesUntilCloseFromOverride(override, 1, 20 * 60)).toBe(120);
  });
  it('aralık dışında null', () => {
    expect(minutesUntilCloseFromOverride(override, 1, 8 * 60)).toBeNull(); // 08:00 henüz açık değil
    expect(minutesUntilCloseFromOverride(override, 1, 22 * 60 + 1)).toBeNull(); // kapanış sonrası
  });
  it('gece yarısı aşan aralık — açılıştan sonra', () => {
    // Cumartesi 20:00 → kapanış Pazar 02:00, kalan = (24*60 - 1200) + 120 = 360
    expect(minutesUntilCloseFromOverride(override, 6, 20 * 60)).toBe(360);
  });
  it('gece yarısı aşan aralık — Pazar 01:30 (önceki gün açtı)', () => {
    // Pazar 01:30 — Pazar günü override "closed" → null (override day-based)
    expect(minutesUntilCloseFromOverride(override, 0, 90)).toBeNull();
  });
  it('o gün kapalıysa null', () => {
    expect(minutesUntilCloseFromOverride(override, 0, 14 * 60)).toBeNull();
  });
  it('eksik override için null', () => {
    expect(minutesUntilCloseFromOverride({}, 1, 12 * 60)).toBeNull();
    expect(minutesUntilCloseFromOverride(null, 1, 12 * 60)).toBeNull();
  });
});

describe('minutesUntilCloseFromPeriods', () => {
  const sameDay = [{ open: { day: 1, time: '0900' }, close: { day: 1, time: '2200' } }];
  const crossMidnight = [{ open: { day: 6, time: '1800' }, close: { day: 0, time: '0200' } }];

  it('aynı gün period — kalan dakika', () => {
    expect(minutesUntilCloseFromPeriods(sameDay, 1, 21 * 60)).toBe(60);
  });
  it('aralık dışında null', () => {
    expect(minutesUntilCloseFromPeriods(sameDay, 1, 8 * 60)).toBeNull();
  });
  it('gece yarısı geçen period — açılışından sonra', () => {
    // Cumartesi 23:00 → kapanış Pazar 02:00
    expect(minutesUntilCloseFromPeriods(crossMidnight, 6, 23 * 60)).toBe(180);
  });
  it('gece yarısı geçen period — sabah erken (önceki gün açtı)', () => {
    // Pazar 01:30 — period dün (Cum) açıldı, bugün (Paz) 02:00'de kapanır
    expect(minutesUntilCloseFromPeriods(crossMidnight, 0, 90)).toBe(30);
  });
  it('24/7 ya da geçersiz periods → null', () => {
    expect(minutesUntilCloseFromPeriods([{ open: { day: 0, time: '0000' } }], 0, 600)).toBeNull();
    expect(minutesUntilCloseFromPeriods(null, 0, 0)).toBeNull();
  });
});

describe('deriveFreshness', () => {
  const baseOpen = {
    name: 'Test',
    rating: 4.5,
    user_ratings_total: 50,
    opening_hours: {
      periods: [{ open: { day: 6, time: '1800' }, close: { day: 6, time: '2030' } }],
    },
  };

  it('override yoksa Google periods\'ı kullanır', () => {
    // Cumartesi 20:00 → 30 dk kala
    const r = deriveFreshness(baseOpen, null, SAT_EVENING_UTC);
    expect(r.minutesUntilClose).toBe(30);
    expect(r.isNewlyOpened).toBe(false);
  });

  it('override varsa override öncelikli', () => {
    const override = {
      saturday: { open: '18:00', close: '23:00' }, // override 23:00, periods 20:30
      sunday: { open: '12:00', close: '20:00' },
      monday: { open: '12:00', close: '20:00' },
      tuesday: { open: '12:00', close: '20:00' },
      wednesday: { open: '12:00', close: '20:00' },
      thursday: { open: '12:00', close: '20:00' },
      friday: { open: '12:00', close: '20:00' },
    };
    // Cumartesi 20:00 → 3 saat = 180 dk
    const r = deriveFreshness(baseOpen, override, SAT_EVENING_UTC);
    expect(r.minutesUntilClose).toBe(180);
  });

  it('az yorumlu + makul puanlı → isNewlyOpened', () => {
    const r = deriveFreshness({ rating: 4.2, user_ratings_total: 8 }, null);
    expect(r.isNewlyOpened).toBe(true);
  });
  it('düşük puanlı az yorumlu → isNewlyOpened false (kötü değil yeni saymıyoruz)', () => {
    const r = deriveFreshness({ rating: 2.5, user_ratings_total: 3 }, null);
    expect(r.isNewlyOpened).toBe(false);
  });
  it('çok yorumlu mekan → isNewlyOpened false', () => {
    const r = deriveFreshness({ rating: 4.5, user_ratings_total: 500 }, null);
    expect(r.isNewlyOpened).toBe(false);
  });
});

describe('eşik sabitleri', () => {
  it('CLOSING_SOON eşiği 60 dk', () => {
    expect(CLOSING_SOON_THRESHOLD_MIN).toBe(60);
  });
});
