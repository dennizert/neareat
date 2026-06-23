'use strict';

// S19-1 — restoran trial başlatma + bitiş hesabı.

const mockPrisma = {
  subscription: { findUnique: jest.fn(), create: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const { trialExpiry, startTrialForRestaurant, RESTAURANT_TRIAL_DAYS } = require('../../../src/services/restaurantSubscription');

beforeEach(() => jest.clearAllMocks());

describe('trialExpiry (pure)', () => {
  it('now + 15 gün döndürür', () => {
    const now = new Date('2026-06-23T00:00:00Z');
    const exp = trialExpiry(now);
    const days = (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(RESTAURANT_TRIAL_DAYS);
    expect(RESTAURANT_TRIAL_DAYS).toBe(15);
  });
});

describe('startTrialForRestaurant', () => {
  it('aboneliği yoksa 15 günlük trial oluşturur', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.subscription.create.mockResolvedValue({ id: 's1' });
    const now = new Date('2026-06-23T00:00:00Z');

    const res = await startTrialForRestaurant('u1', now);

    expect(res.created).toBe(true);
    expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1', status: 'trial', planType: 'monthly', startedAt: now }),
      }),
    );
  });

  it('mevcut aboneliği EZMEZ (idempotent) — create çağrılmaz', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ id: 's-existing', status: 'active' });
    const res = await startTrialForRestaurant('u1');
    expect(res.created).toBe(false);
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
  });

  it('hata yutulur (best-effort)', async () => {
    mockPrisma.subscription.findUnique.mockRejectedValue(new Error('db down'));
    const res = await startTrialForRestaurant('u1');
    expect(res.created).toBe(false);
    expect(res.error).toBeDefined();
  });
});
