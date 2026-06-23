'use strict';

// S18-3 — yıldız farming önleme yardımcıları.

const mockPrisma = {
  checkIn: { findFirst: jest.fn() },
  reservation: { findFirst: jest.fn() },
  starEvent: { count: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const {
  withinDailyCap,
  getIstanbulMidnightUtc,
  hasVerifiedVisit,
  isUnderDailyStarCap,
  canEarnPlaceStars,
} = require('../../../src/utils/starGuards');

beforeEach(() => jest.clearAllMocks());

describe('withinDailyCap (pure)', () => {
  it('cap altında → true, capte/üstünde → false', () => {
    expect(withinDailyCap(0, 3)).toBe(true);
    expect(withinDailyCap(2, 3)).toBe(true);
    expect(withinDailyCap(3, 3)).toBe(false);
    expect(withinDailyCap(5, 3)).toBe(false);
  });
  it('cap 0/undefined → tavan yok (her zaman true)', () => {
    expect(withinDailyCap(100, 0)).toBe(true);
    expect(withinDailyCap(100, undefined)).toBe(true);
  });
});

describe('getIstanbulMidnightUtc (pure)', () => {
  it('İstanbul gece yarısını UTC olarak döndürür (UTC+3 → 21:00 UTC önceki gün)', () => {
    // 2026-06-23 10:00 UTC → İstanbul 13:00 → o günün gece yarısı İst = 2026-06-22 21:00 UTC
    const mid = getIstanbulMidnightUtc(new Date('2026-06-23T10:00:00Z'));
    expect(mid.toISOString()).toBe('2026-06-22T21:00:00.000Z');
  });
});

describe('hasVerifiedVisit', () => {
  it('check-in varsa → true', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue({ id: 'c1' });
    mockPrisma.reservation.findFirst.mockResolvedValue(null);
    expect(await hasVerifiedVisit('u1', 'p1')).toBe(true);
  });
  it('tamamlanmış (attended) rezervasyon varsa → true', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue(null);
    mockPrisma.reservation.findFirst.mockResolvedValue({ id: 'r1' });
    expect(await hasVerifiedVisit('u1', 'p1')).toBe(true);
  });
  it('hiçbiri yoksa → false', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue(null);
    mockPrisma.reservation.findFirst.mockResolvedValue(null);
    expect(await hasVerifiedVisit('u1', 'p1')).toBe(false);
  });
  it('attended rezervasyonu yalnızca attended:true ile sorgular', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue(null);
    mockPrisma.reservation.findFirst.mockResolvedValue(null);
    await hasVerifiedVisit('u1', 'p1');
    expect(mockPrisma.reservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', placeId: 'p1', attended: true }) }),
    );
  });
});

describe('isUnderDailyStarCap', () => {
  it('REVIEW: bugünkü olay < cap → true', async () => {
    mockPrisma.starEvent.count.mockResolvedValue(2); // cap 3 (default)
    expect(await isUnderDailyStarCap('u1', 'REVIEW')).toBe(true);
  });
  it('REVIEW: bugünkü olay = cap → false', async () => {
    mockPrisma.starEvent.count.mockResolvedValue(3);
    expect(await isUnderDailyStarCap('u1', 'REVIEW')).toBe(false);
  });
  it('tavanı olmayan tip → her zaman true, count sorgulanmaz', async () => {
    expect(await isUnderDailyStarCap('u1', 'RESERVATION')).toBe(true);
    expect(mockPrisma.starEvent.count).not.toHaveBeenCalled();
  });
});

describe('canEarnPlaceStars', () => {
  it('ziyaret + tavan altı → allowed true', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue({ id: 'c1' });
    mockPrisma.reservation.findFirst.mockResolvedValue(null);
    mockPrisma.starEvent.count.mockResolvedValue(0);
    const r = await canEarnPlaceStars('u1', 'p1', 'REVIEW');
    expect(r).toEqual({ visited: true, underCap: true, allowed: true });
  });
  it('ziyaret yok → allowed false', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue(null);
    mockPrisma.reservation.findFirst.mockResolvedValue(null);
    mockPrisma.starEvent.count.mockResolvedValue(0);
    const r = await canEarnPlaceStars('u1', 'p1', 'REVIEW');
    expect(r.allowed).toBe(false);
    expect(r.visited).toBe(false);
  });
  it('ziyaret var ama tavan dolu → allowed false', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue({ id: 'c1' });
    mockPrisma.reservation.findFirst.mockResolvedValue(null);
    mockPrisma.starEvent.count.mockResolvedValue(3);
    const r = await canEarnPlaceStars('u1', 'p1', 'REVIEW');
    expect(r.allowed).toBe(false);
    expect(r.underCap).toBe(false);
  });
});
