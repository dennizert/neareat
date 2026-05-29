'use strict';

/**
 * Sprint-5 Task #5 — restaurantAnalytics saf hesaplama testleri.
 */

const {
  lastNDates,
  computeReservationAnalytics,
  computeReviewAnalytics,
} = require('../../../src/utils/restaurantAnalytics');

// Sabit referans an — TR tarihi 2026-05-29
const NOW = new Date('2026-05-29T10:00:00Z');

describe('lastNDates', () => {
  it('bugünden geriye n TR tarihi (eski→yeni) döner', () => {
    const dates = lastNDates(NOW, 7);
    expect(dates).toHaveLength(7);
    expect(dates[6]).toBe('2026-05-29'); // bugün
    expect(dates[0]).toBe('2026-05-23'); // 6 gün önce
  });
});

describe('computeReservationAnalytics', () => {
  it('boş girdide sıfır trend + boş busiest + null attendanceRate', () => {
    const a = computeReservationAnalytics([], NOW);
    expect(a.totalReservations).toBe(0);
    expect(a.trend).toHaveLength(7);
    expect(a.trend.every((t) => t.count === 0)).toBe(true);
    expect(a.busiestHours).toEqual([]);
    expect(a.attendanceRate).toBeNull();
    expect(a.statusBreakdown.PENDING).toBe(0);
  });

  it('7 günlük pencerede aktif rezervasyonları güne göre sayar', () => {
    const a = computeReservationAnalytics([
      { date: '2026-05-29', time: '19:00', status: 'CONFIRMED', attended: null },
      { date: '2026-05-29', time: '20:00', status: 'PENDING', attended: null },
      { date: '2026-05-23', time: '12:00', status: 'COMPLETED', attended: true },
      { date: '2026-05-01', time: '12:00', status: 'CONFIRMED', attended: null }, // pencere dışı
    ], NOW);

    const today = a.trend.find((t) => t.date === '2026-05-29');
    expect(today.count).toBe(2);
    expect(a.trend.find((t) => t.date === '2026-05-23').count).toBe(1);
    expect(a.totalReservations).toBe(4);
  });

  it('CANCELLED/REJECTED trend+busiest dışında ama statusBreakdown içinde', () => {
    const a = computeReservationAnalytics([
      { date: '2026-05-29', time: '19:00', status: 'CANCELLED', attended: null },
      { date: '2026-05-29', time: '19:00', status: 'REJECTED', attended: null },
      { date: '2026-05-29', time: '19:00', status: 'CONFIRMED', attended: null },
    ], NOW);

    expect(a.trend.find((t) => t.date === '2026-05-29').count).toBe(1); // sadece CONFIRMED
    expect(a.busiestHours).toEqual([{ hour: '19', count: 1 }]);
    expect(a.statusBreakdown.CANCELLED).toBe(1);
    expect(a.statusBreakdown.REJECTED).toBe(1);
  });

  it('en yoğun saatler sayıya göre sıralı (top 5)', () => {
    const reservations = [
      { date: '2026-05-29', time: '19:30', status: 'CONFIRMED', attended: null },
      { date: '2026-05-29', time: '19:00', status: 'CONFIRMED', attended: null },
      { date: '2026-05-29', time: '12:00', status: 'CONFIRMED', attended: null },
    ];
    const a = computeReservationAnalytics(reservations, NOW);
    expect(a.busiestHours[0]).toEqual({ hour: '19', count: 2 });
    expect(a.busiestHours[1]).toEqual({ hour: '12', count: 1 });
  });

  it('attendanceRate = attended / (attended + noShow)', () => {
    const a = computeReservationAnalytics([
      { date: '2026-05-29', time: '19:00', status: 'COMPLETED', attended: true },
      { date: '2026-05-29', time: '19:00', status: 'COMPLETED', attended: true },
      { date: '2026-05-29', time: '19:00', status: 'COMPLETED', attended: false },
    ], NOW);
    expect(a.attendanceRate).toBe(0.67); // 2/3
  });
});

describe('computeReviewAnalytics', () => {
  it('count, avg, distribution hesaplar', () => {
    const r = computeReviewAnalytics([5, 4, 5]);
    expect(r.reviewCount).toBe(3);
    expect(r.avgRating).toBe(4.7);
    expect(r.distribution[5]).toBe(2);
    expect(r.distribution[4]).toBe(1);
  });

  it('boş yorumda count 0, avg null', () => {
    const r = computeReviewAnalytics([]);
    expect(r.reviewCount).toBe(0);
    expect(r.avgRating).toBeNull();
  });
});
