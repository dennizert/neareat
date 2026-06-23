'use strict';

// S18-4 — sezon sıfırlama job karar mantığı (bootstrap / not-due / due / force) + idempotency.

const mockPrisma = {
  user: { findFirst: jest.fn(), updateMany: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);
jest.mock('../../../src/services/cronLock', () => ({ withCronLock: jest.fn() }));
const mockLogSecurityEvent = jest.fn();
jest.mock('../../../src/middleware/securityLogger', () => ({ logSecurityEvent: mockLogSecurityEvent, EVENTS: {} }));

const { runSeasonResetJob, SEASON_DURATION_MS, BELOW_TARGET, ABOVE_TARGET, L5_FLOOR } = require('../../../src/jobs/seasonReset');

beforeEach(() => jest.clearAllMocks());

describe('runSeasonResetJob', () => {
  it('hedef değerler ve sınır doğru (L5 eşiği 250 → 100, altı → 50)', () => {
    expect(L5_FLOOR).toBe(250);
    expect(BELOW_TARGET).toBe(50);
    expect(ABOVE_TARGET).toBe(100);
  });

  it('bootstrap: çapa yoksa baseline kurar, sıfırlama yapmaz', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null); // çapa yok
    mockPrisma.user.updateMany.mockResolvedValue({ count: 42 });

    const res = await runSeasonResetJob({ now: new Date('2026-06-23T04:00:00Z') });

    expect(res.action).toBe('bootstrap');
    expect(res.baselined).toBe(42);
    // yalnızca seasonStartAt=null güncellemesi; starCount sıfırlaması yok
    expect(mockPrisma.user.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seasonStartAt: null } }),
    );
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  it('not_due: 6 ay dolmadıysa no-op', async () => {
    const now = new Date('2026-06-23T04:00:00Z');
    const anchor = new Date(now.getTime() - (SEASON_DURATION_MS - 1000)); // 1sn eksik
    mockPrisma.user.findFirst.mockResolvedValue({ seasonStartAt: anchor });

    const res = await runSeasonResetJob({ now });

    expect(res.action).toBe('skipped');
    expect(res.reason).toBe('not_due');
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('due: 6 ay dolduysa iki updateMany ile sıfırlar (önce alt, sonra üst) + sistem olayı', async () => {
    const now = new Date('2026-12-23T04:00:00Z');
    const anchor = new Date(now.getTime() - SEASON_DURATION_MS - 1000);
    mockPrisma.user.findFirst.mockResolvedValue({ seasonStartAt: anchor });
    mockPrisma.user.updateMany
      .mockResolvedValueOnce({ count: 90 })  // < 250 → 50
      .mockResolvedValueOnce({ count: 10 }); // >= 250 → 100

    const res = await runSeasonResetJob({ now });

    expect(res.action).toBe('reset');
    expect(res.demotedToL2).toBe(90);
    expect(res.demotedToL3).toBe(10);
    // İlk çağrı alt bucket (lt 250 → 50), ikinci üst bucket (gte 250 → 100)
    const calls = mockPrisma.user.updateMany.mock.calls;
    expect(calls[0][0].where.starCount).toEqual({ lt: 250 });
    expect(calls[0][0].data).toMatchObject({ starCount: 50 });
    expect(calls[1][0].where.starCount).toEqual({ gte: 250 });
    expect(calls[1][0].data).toMatchObject({ starCount: 100 });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith('SEASON_RESET', expect.objectContaining({ demotedToL2: 90, demotedToL3: 10 }));
  });

  it('force: süre dolmasa bile sıfırlar (admin manuel)', async () => {
    const now = new Date('2026-06-23T04:00:00Z');
    mockPrisma.user.findFirst.mockResolvedValue({ seasonStartAt: now }); // henüz dolmadı
    mockPrisma.user.updateMany.mockResolvedValue({ count: 5 });

    const res = await runSeasonResetJob({ now, force: true });

    expect(res.action).toBe('reset');
    expect(mockPrisma.user.updateMany).toHaveBeenCalledTimes(2);
  });
});
