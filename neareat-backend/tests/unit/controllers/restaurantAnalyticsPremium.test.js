'use strict';

/**
 * Restoran analitik/rapor premium gate testleri.
 * getAnalytics + getWeeklyReport yalnızca premium restoranlara açık (403 SUBSCRIPTION_REQUIRED).
 */

const mockPrisma = {
  restaurantProfile: { findUnique: jest.fn() },
  reservation: { findMany: jest.fn().mockResolvedValue([]) },
  review: { findMany: jest.fn().mockResolvedValue([]) },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const mockIsPremiumUser = jest.fn();
jest.mock('../../../src/utils/premiumCheck', () => ({
  isPremiumUser: (...args) => mockIsPremiumUser(...args),
  isRestaurantActive: (...args) => mockIsPremiumUser(...args), // S19-1: restoran gate'i bunu kullanır
}));

jest.mock('../../../src/services/businessReport', () => ({
  generateWeeklyReport: jest.fn().mockResolvedValue({ report: 'özet', fallback: false }),
}));
jest.mock('../../../src/services/logService', () => ({ logRequest: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/utils/jwt', () => ({ signToken: jest.fn() }));

const { getAnalytics, getWeeklyReport } = require('../../../src/controllers/restaurantAccountController');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const OWNER = { id: 'owner1', role: 'RESTAURANT' };

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPremiumUser.mockResolvedValue(true);
  mockPrisma.reservation.findMany.mockResolvedValue([]);
  mockPrisma.review.findMany.mockResolvedValue([]);
  mockPrisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'rp1', placeId: 'p1' });
});

describe('getAnalytics premium gate', () => {
  it('premium olmayan → 403 SUBSCRIPTION_REQUIRED, profil sorgulanmaz', async () => {
    mockIsPremiumUser.mockResolvedValue(false);
    const res = mockRes();
    await getAnalytics({ user: OWNER }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUBSCRIPTION_REQUIRED' }));
    expect(mockPrisma.restaurantProfile.findUnique).not.toHaveBeenCalled();
  });

  it('premium → gate geçer (profil sorgulanır, 403 dönmez)', async () => {
    const res = mockRes();
    await getAnalytics({ user: OWNER }, res, jest.fn());
    expect(mockPrisma.restaurantProfile.findUnique).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});

describe('getWeeklyReport premium gate', () => {
  it('premium olmayan → 403 SUBSCRIPTION_REQUIRED, profil sorgulanmaz', async () => {
    mockIsPremiumUser.mockResolvedValue(false);
    const res = mockRes();
    await getWeeklyReport({ user: OWNER }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUBSCRIPTION_REQUIRED' }));
    expect(mockPrisma.restaurantProfile.findUnique).not.toHaveBeenCalled();
  });

  it('premium → gate geçer (profil sorgulanır, 403 dönmez)', async () => {
    const res = mockRes();
    await getWeeklyReport({ user: OWNER }, res, jest.fn());
    expect(mockPrisma.restaurantProfile.findUnique).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});
