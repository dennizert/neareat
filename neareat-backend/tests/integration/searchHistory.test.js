'use strict';

/**
 * Sprint-6 #87 — SearchHistory endpoint'leri ve fire-and-forget kayıt.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  subscription: { findUnique: jest.fn() },
  restaurantProfile: { findMany: jest.fn().mockResolvedValue([]) },
  searchHistory: {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));

jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

const mockSearchPlacesByText = jest.fn();
jest.mock('../../src/services/googlePlaces', () => {
  const actual = jest.requireActual('../../src/services/googlePlaces');
  return {
    ...actual,
    getNearbyRestaurants: jest.fn().mockResolvedValue([]),
    getNearbyRestaurantsFast: jest.fn().mockResolvedValue([]),
    searchPlacesByText: (...args) => mockSearchPlacesByText(...args),
    getPlaceDetails: jest.fn(),
    getPhotoUrl: jest.fn().mockReturnValue(null),
  };
});

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const userId = 'u-1';
const token = createTestToken({ id: userId, email: 'u@test.com', role: 'USER' });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'U', starCount: 0, isSuspended: false,
  });
  mockPrisma.searchHistory.findMany.mockResolvedValue([]);
  mockPrisma.searchHistory.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.searchHistory.create.mockResolvedValue({});
});

// Fire-and-forget kayıtların oluşmasını bekleyen helper
function flushMicrotasks() {
  return new Promise((r) => setImmediate(r));
}

describe('SearchHistory — fire-and-forget kayıt', () => {
  it('arama yapan giriş yapmış kullanıcı için kayıt oluşur', async () => {
    mockSearchPlacesByText.mockResolvedValue([]);
    await request(app).get('/api/places/search?q=kebap').set('Authorization', `Bearer ${token}`);
    await flushMicrotasks();
    expect(mockPrisma.searchHistory.create).toHaveBeenCalledWith({
      data: { userId, query: 'kebap', type: 'free_text' },
    });
  });

  it('cuisineTag varsa type cuisine_tag', async () => {
    mockSearchPlacesByText.mockResolvedValue([]);
    await request(app).get('/api/places/search?q=yemek&cuisineTag=Kebap').set('Authorization', `Bearer ${token}`);
    await flushMicrotasks();
    expect(mockPrisma.searchHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'cuisine_tag' }),
    }));
  });

  it('anonim arama → kayıt yok', async () => {
    mockSearchPlacesByText.mockResolvedValue([]);
    await request(app).get('/api/places/search?q=kebap');
    await flushMicrotasks();
    expect(mockPrisma.searchHistory.create).not.toHaveBeenCalled();
  });

  it('prisma hatası arama akışını bozmaz (yutulur)', async () => {
    mockSearchPlacesByText.mockResolvedValue([]);
    mockPrisma.searchHistory.create.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/places/search?q=kebap').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/search-history', () => {
  it('kullanıcının son aramalarını döner', async () => {
    mockPrisma.searchHistory.findMany.mockResolvedValue([
      { id: 'h1', query: 'kebap', type: 'free_text', createdAt: new Date('2026-05-30T10:00:00Z') },
      { id: 'h2', query: 'sushi', type: 'free_text', createdAt: new Date('2026-05-30T09:00:00Z') },
    ]);
    const res = await request(app).get('/api/search-history').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].query).toBe('kebap');
    expect(mockPrisma.searchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId }, take: 30 })
    );
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).get('/api/search-history');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/search-history (KVKK)', () => {
  it('tüm geçmişi siler ve count döner', async () => {
    mockPrisma.searchHistory.deleteMany.mockResolvedValue({ count: 5 });
    const res = await request(app).delete('/api/search-history').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 5 });
    expect(mockPrisma.searchHistory.deleteMany).toHaveBeenCalledWith({ where: { userId } });
  });
});

describe('DELETE /api/search-history/:id', () => {
  it('sahip olduğu kaydı siler → 204', async () => {
    mockPrisma.searchHistory.deleteMany.mockResolvedValue({ count: 1 });
    const res = await request(app).delete('/api/search-history/h1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
    expect(mockPrisma.searchHistory.deleteMany).toHaveBeenCalledWith({
      where: { id: 'h1', userId },
    });
  });

  it('başkasına ait kayıt → 404', async () => {
    mockPrisma.searchHistory.deleteMany.mockResolvedValue({ count: 0 });
    const res = await request(app).delete('/api/search-history/h-other').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
