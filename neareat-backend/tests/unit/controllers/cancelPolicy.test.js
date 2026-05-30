'use strict';

// prisma ve diğer modüller yüklenmeden önce mock'la
jest.mock('../../../src/utils/prisma', () => ({
  reservation: {}, notification: {}, starEvent: {}, user: {},
}));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../../src/services/notificationService', () => ({ createNotification: jest.fn() }));
jest.mock('../../../src/services/logService', () => ({
  logRequest: jest.fn(), logActivity: jest.fn(),
  ACTIVITY_TYPES: { RESERVATION: 'RESERVATION' },
}));
jest.mock('../../../src/utils/stars', () => ({
  awardStars: jest.fn(), deductStars: jest.fn(),
  RESERVATION_NO_SHOW_PENALTY: 10,
}));

const { computeCancelPolicy } = require('../../../src/controllers/reservationController');

// Sabit şimdi: 2026-06-01 12:00 UTC
const NOW = new Date('2026-06-01T12:00:00.000Z');

// Türkiye UTC+3: 2026-06-01 saat X → UTC = X-3
// Rezervasyon saati olarak girildiğinde date/time Türkiye yerel veridir.

describe('computeCancelPolicy', () => {
  it('24+ saat önce → ücretsiz iptal (penalty=0)', () => {
    // Rezervasyon: 2026-06-02 15:00 Türkiye = 2026-06-02 12:00 UTC → 24h sonra
    const p = computeCancelPolicy('2026-06-02', '15:00', NOW);
    expect(p.allowed).toBe(true);
    expect(p.penalty).toBe(0);
    expect(p.hoursUntil).toBeCloseTo(24, 0);
  });

  it('2-24 saat arası → cezalı iptal (penalty=5)', () => {
    // Rezervasyon: 2026-06-01 17:00 Türkiye = 2026-06-01 14:00 UTC → 2h sonra
    const p = computeCancelPolicy('2026-06-01', '17:00', NOW);
    expect(p.allowed).toBe(true);
    expect(p.penalty).toBe(5);
    expect(p.hoursUntil).toBeCloseTo(2, 0);
  });

  it('<2 saat kala → iptal yasak (allowed=false)', () => {
    // Rezervasyon: 2026-06-01 13:30 Türkiye = 2026-06-01 10:30 UTC → 1.5h önceydi (geçti)
    const p = computeCancelPolicy('2026-06-01', '13:00', NOW);
    expect(p.allowed).toBe(false);
    expect(p.hoursUntil).toBeLessThan(2);
  });

  it('geçmiş rezervasyon → iptal yasak', () => {
    const p = computeCancelPolicy('2026-05-30', '10:00', NOW);
    expect(p.allowed).toBe(false);
    expect(p.hoursUntil).toBeLessThan(0);
  });

  it('tam 24 saat → ücretsiz sınırda', () => {
    // NOW = 12:00 UTC. Rezervasyon 2026-06-02 15:00 Türkiye = 12:00 UTC
    const p = computeCancelPolicy('2026-06-02', '15:00', NOW);
    expect(p.allowed).toBe(true);
    expect(p.penalty).toBe(0);
  });
});
