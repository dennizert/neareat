'use strict';

/**
 * Sprint-4 Task #4 — logService.logActivity unit tests.
 * Prisma mock'lu; fire-and-forget davranışı + erken çıkış + hata yutma.
 */

const mockPrisma = {
  userLog: { create: jest.fn().mockResolvedValue({}) },
  activityEvent: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const { logActivity, ACTIVITY_TYPES } = require('../../../src/services/logService');

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.activityEvent.create.mockResolvedValue({ id: 'ev-1' });
});

describe('ACTIVITY_TYPES', () => {
  it('tüm olay türlerini içerir (S7-2 ile CHECKIN eklendi)', () => {
    expect(ACTIVITY_TYPES).toEqual({
      REVIEW: 'REVIEW',
      FAVORITE: 'FAVORITE',
      RESERVATION: 'RESERVATION',
      RECOMMENDATION: 'RECOMMENDATION',
      CHECKIN: 'CHECKIN',
    });
  });
});

describe('logActivity', () => {
  it('geçerli girdide doğru data ile event yazar', async () => {
    await logActivity({
      userId: 'u1',
      type: ACTIVITY_TYPES.REVIEW,
      placeId: 'p1',
      metadata: { placeName: 'X', rating: 5 },
    });

    expect(mockPrisma.activityEvent.create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'REVIEW', placeId: 'p1', metadata: { placeName: 'X', rating: 5 } },
    });
  });

  it('placeId/metadata verilmezse null placeId + metadata undefined', async () => {
    await logActivity({ userId: 'u1', type: ACTIVITY_TYPES.RECOMMENDATION });

    expect(mockPrisma.activityEvent.create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'RECOMMENDATION', placeId: null, metadata: undefined },
    });
  });

  it('userId yoksa hiçbir şey yazmaz', async () => {
    await logActivity({ type: ACTIVITY_TYPES.FAVORITE, placeId: 'p1' });
    expect(mockPrisma.activityEvent.create).not.toHaveBeenCalled();
  });

  it('type yoksa hiçbir şey yazmaz', async () => {
    await logActivity({ userId: 'u1', placeId: 'p1' });
    expect(mockPrisma.activityEvent.create).not.toHaveBeenCalled();
  });

  it('DB hatasını yutar (fire-and-forget, throw etmez)', async () => {
    mockPrisma.activityEvent.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      logActivity({ userId: 'u1', type: ACTIVITY_TYPES.RESERVATION, placeId: 'p1' }),
    ).resolves.toBeUndefined();
  });
});
