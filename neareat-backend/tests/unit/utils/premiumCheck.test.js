'use strict';

const mockPrisma = {
  subscription: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const {
  isActivePremium,
  isAlwaysPremiumEmail,
  isPremiumUser,
  PREMIUM_STATUSES,
} = require('../../../src/utils/premiumCheck');

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isActivePremium', () => {
  it('returns false for null subscription', () => {
    expect(isActivePremium(null)).toBe(false);
  });

  it('returns false for undefined subscription', () => {
    expect(isActivePremium(undefined)).toBe(false);
  });

  it('returns true for active status with a future expiry date', () => {
    expect(isActivePremium({ status: 'active', expiresAt: futureDate })).toBe(true);
  });

  it('returns true for trial status with a future expiry date', () => {
    expect(isActivePremium({ status: 'trial', expiresAt: futureDate })).toBe(true);
  });

  it('returns false for active status with a past expiry date', () => {
    expect(isActivePremium({ status: 'active', expiresAt: pastDate })).toBe(false);
  });

  it('returns false for trial status with a past expiry date', () => {
    expect(isActivePremium({ status: 'trial', expiresAt: pastDate })).toBe(false);
  });

  it('returns false for cancelled status even with a future expiry date', () => {
    expect(isActivePremium({ status: 'cancelled', expiresAt: futureDate })).toBe(false);
  });

  it('returns false for expired status even with a future expiry date', () => {
    expect(isActivePremium({ status: 'expired', expiresAt: futureDate })).toBe(false);
  });

  it('returns false when expiresAt is exactly now (not strictly greater)', () => {
    expect(isActivePremium({ status: 'active', expiresAt: new Date() })).toBe(false);
  });
});

describe('isAlwaysPremiumEmail', () => {
  it('denniz.ertekin@gmail.com için true (varsayılan allowlist)', () => {
    expect(isAlwaysPremiumEmail('denniz.ertekin@gmail.com')).toBe(true);
  });

  it('büyük/küçük harf + boşluk duyarsız', () => {
    expect(isAlwaysPremiumEmail('  Denniz.Ertekin@Gmail.com ')).toBe(true);
  });

  it('başka e-posta için false', () => {
    expect(isAlwaysPremiumEmail('someone@else.com')).toBe(false);
  });

  it('boş/null için false', () => {
    expect(isAlwaysPremiumEmail('')).toBe(false);
    expect(isAlwaysPremiumEmail(null)).toBe(false);
  });
});

describe('isPremiumUser', () => {
  it('aktif aboneliği olan kullanıcı → true (e-posta sorgusu yapılmaz)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active', expiresAt: futureDate });

    const result = await isPremiumUser('u1');

    expect(result).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('aktif abonelik yok + allowlist e-posta → true', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'denniz.ertekin@gmail.com' });

    expect(await isPremiumUser('u1')).toBe(true);
  });

  it('aktif abonelik yok + allowlist DIŞI e-posta → false', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'free@user.com' });

    expect(await isPremiumUser('u1')).toBe(false);
  });

  it('süresi dolmuş abonelik + allowlist e-posta → yine true (override)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active', expiresAt: pastDate });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'denniz.ertekin@gmail.com' });

    expect(await isPremiumUser('u1')).toBe(true);
  });
});

describe('PREMIUM_STATUSES', () => {
  it('includes "active"', () => {
    expect(PREMIUM_STATUSES).toContain('active');
  });

  it('includes "trial"', () => {
    expect(PREMIUM_STATUSES).toContain('trial');
  });

  it('has exactly 2 elements', () => {
    expect(PREMIUM_STATUSES).toHaveLength(2);
  });
});
