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

// S13-4: sabit fallback kaldırıldı; allowlist artık yalnızca env'den okunur (lazy).
const ORIG_ALLOWLIST = process.env.ALWAYS_PREMIUM_EMAILS;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.ALWAYS_PREMIUM_EMAILS = 'denniz.ertekin@gmail.com';
});
afterAll(() => {
  if (ORIG_ALLOWLIST === undefined) delete process.env.ALWAYS_PREMIUM_EMAILS;
  else process.env.ALWAYS_PREMIUM_EMAILS = ORIG_ALLOWLIST;
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
  it('env\'deki e-posta için true', () => {
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

  it('S13-4: env boşsa sabit fallback YOK → false', () => {
    delete process.env.ALWAYS_PREMIUM_EMAILS;
    expect(isAlwaysPremiumEmail('denniz.ertekin@gmail.com')).toBe(false);
  });
});

describe('isPremiumUser', () => {
  it('aktif aboneliği olan kullanıcı → true (e-posta sorgusu yapılmaz)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active', expiresAt: futureDate });

    const result = await isPremiumUser('u1');

    expect(result).toBe(true);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('aktif abonelik yok + allowlist e-posta + doğrulanmış → true', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'denniz.ertekin@gmail.com', emailVerified: true });

    expect(await isPremiumUser('u1')).toBe(true);
  });

  it('S13-4: allowlist e-posta ama emailVerified=false → false', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'denniz.ertekin@gmail.com', emailVerified: false });

    expect(await isPremiumUser('u1')).toBe(false);
  });

  it('aktif abonelik yok + allowlist DIŞI e-posta → false', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'free@user.com', emailVerified: true });

    expect(await isPremiumUser('u1')).toBe(false);
  });

  it('süresi dolmuş abonelik + allowlist e-posta + doğrulanmış → yine true (override)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active', expiresAt: pastDate });
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'denniz.ertekin@gmail.com', emailVerified: true });

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
