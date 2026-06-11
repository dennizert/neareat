'use strict';

/**
 * Sprint-5 Task #3 — sendCampaign controller unit testleri.
 * Controller doğrudan çağrılır (req/res mock); prisma + servisler mock'lu.
 */

const mockPrisma = {
  restaurantProfile: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
  favorite: { findMany: jest.fn().mockResolvedValue([]) },
  reservation: { findMany: jest.fn().mockResolvedValue([]) },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

// Premium kontrolü mock'lu — kampanya artık premium gerektiriyor (varsayılan: premium).
const mockIsPremiumUser = jest.fn();
jest.mock('../../../src/utils/premiumCheck', () => ({
  isPremiumUser: (...args) => mockIsPremiumUser(...args),
}));

const mockCreateForUsers = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/services/notificationService', () => ({
  createNotificationsForUsers: mockCreateForUsers,
  createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../src/services/logService', () => ({ logRequest: jest.fn().mockResolvedValue({}) }));
jest.mock('../../../src/utils/jwt', () => ({ signToken: jest.fn() }));

const { sendCampaign } = require('../../../src/controllers/restaurantAccountController');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function approvedProfile(overrides = {}) {
  return {
    id: 'rp1', placeId: 'place-1', placeName: 'Test Restoran',
    businessName: 'Test Ltd', status: 'APPROVED', lastCampaignAt: null,
    ...overrides,
  };
}

const OWNER = { id: 'owner1', role: 'RESTAURANT' };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.restaurantProfile.update.mockResolvedValue({});
  mockPrisma.favorite.findMany.mockResolvedValue([]);
  mockPrisma.reservation.findMany.mockResolvedValue([]);
  mockCreateForUsers.mockResolvedValue(undefined);
  mockIsPremiumUser.mockResolvedValue(true); // varsayılan: premium restoran
});

describe('sendCampaign', () => {
  it('premium olmayan restoran → 403 PREMIUM_REQUIRED', async () => {
    mockIsPremiumUser.mockResolvedValue(false);
    const res = mockRes();
    await sendCampaign({ user: OWNER, body: { message: 'Bugün %20 indirim!' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PREMIUM_REQUIRED' }));
    expect(mockPrisma.restaurantProfile.findUnique).not.toHaveBeenCalled();
  });

  it('kısa mesaj → 400', async () => {
    const res = mockRes();
    await sendCampaign({ user: OWNER, body: { message: 'hi' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.restaurantProfile.findUnique).not.toHaveBeenCalled();
  });

  it('geçersiz audience → 400', async () => {
    const res = mockRes();
    await sendCampaign({ user: OWNER, body: { message: 'Bugün %20 indirim!', audience: 'xxx' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('onaylanmamış restoran → 403', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(approvedProfile({ status: 'PENDING' }));
    const res = mockRes();
    await sendCampaign({ user: OWNER, body: { message: 'Bugün %20 indirim!' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('placeId yoksa → 400', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(approvedProfile({ placeId: null }));
    const res = mockRes();
    await sendCampaign({ user: OWNER, body: { message: 'Bugün %20 indirim!' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('bugün zaten kampanya gönderilmişse → 429, bildirim yok', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(approvedProfile({ lastCampaignAt: new Date() }));
    const res = mockRes();
    await sendCampaign({ user: OWNER, body: { message: 'Bugün %20 indirim!' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(mockCreateForUsers).not.toHaveBeenCalled();
    expect(mockPrisma.restaurantProfile.update).not.toHaveBeenCalled();
  });

  it('favorites: favori kullanıcılarına gönderir (owner hariç), damgalar', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(approvedProfile());
    mockPrisma.favorite.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'owner1' }]);
    const res = mockRes();

    await sendCampaign({ user: OWNER, body: { message: 'Bugün %20 indirim!', audience: 'favorites' } }, res, jest.fn());

    expect(mockCreateForUsers).toHaveBeenCalledTimes(1);
    const [userIds, type] = mockCreateForUsers.mock.calls[0];
    expect(userIds.sort()).toEqual(['u1', 'u2']); // owner çıkarıldı
    expect(type).toBe('INSTANT_DISCOUNT');
    expect(mockPrisma.reservation.findMany).not.toHaveBeenCalled(); // sadece favorites
    expect(mockPrisma.restaurantProfile.update).toHaveBeenCalledWith({
      where: { userId: 'owner1' },
      data: { lastCampaignAt: expect.any(Date) },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ sent: 2, audience: 'favorites' });
  });

  it('reservations: rezervasyon yapan kullanıcılar distinct sorgulanır', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(approvedProfile());
    mockPrisma.reservation.findMany.mockResolvedValue([{ userId: 'u3' }]);
    const res = mockRes();

    await sendCampaign({ user: OWNER, body: { message: 'Masalar boş, gelin!', audience: 'reservations' } }, res, jest.fn());

    const arg = mockPrisma.reservation.findMany.mock.calls[0][0];
    expect(arg.where.restaurantId).toBe('rp1');
    expect(arg.distinct).toEqual(['userId']);
    expect(mockPrisma.favorite.findMany).not.toHaveBeenCalled();
    expect(mockCreateForUsers.mock.calls[0][0]).toEqual(['u3']);
  });

  it('all: favori + rezervasyon birleşik ve dedupe', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(approvedProfile());
    mockPrisma.favorite.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);
    mockPrisma.reservation.findMany.mockResolvedValue([{ userId: 'u2' }, { userId: 'u3' }]);
    const res = mockRes();

    await sendCampaign({ user: OWNER, body: { message: 'Bugün %20 indirim!', audience: 'all' } }, res, jest.fn());

    expect(mockCreateForUsers.mock.calls[0][0].sort()).toEqual(['u1', 'u2', 'u3']);
    expect(res.json).toHaveBeenCalledWith({ sent: 3, audience: 'all' });
  });

  it('hedef kitle boşsa bildirim göndermez ama yine de damgalar (sent: 0)', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(approvedProfile());
    const res = mockRes();

    await sendCampaign({ user: OWNER, body: { message: 'Bugün %20 indirim!', audience: 'all' } }, res, jest.fn());

    expect(mockCreateForUsers).not.toHaveBeenCalled();
    expect(mockPrisma.restaurantProfile.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ sent: 0, audience: 'all' });
  });
});
