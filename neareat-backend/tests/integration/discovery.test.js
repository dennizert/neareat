'use strict';

/**
 * Sprint-17 #366 — kişiselleştirilmiş keşif endpoint'leri integration testleri.
 * prisma + googlePlaces mock'lanır; route + controller + personalizationService
 * uçtan uca doğrulanır (recordView upsert, recently-viewed, personalized re-rank).
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const userId = '11111111-1111-1111-1111-111111111111';
const testUser = { id: userId, email: 'u@test.com', role: 'USER', starCount: 0, isSuspended: false, favoriteCuisines: [] };

const mockPrisma = {
  user: { findUnique: jest.fn().mockResolvedValue(testUser) },
  subscription: { findUnique: jest.fn().mockResolvedValue(null) },
  restaurantProfile: { findMany: jest.fn().mockResolvedValue([]) },
  favorite: { findMany: jest.fn().mockResolvedValue([]) },
  review: { findMany: jest.fn().mockResolvedValue([]) },
  reservation: { findMany: jest.fn().mockResolvedValue([]) },
  checkIn: { findMany: jest.fn().mockResolvedValue([]) },
  diaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
  recommendation: { findMany: jest.fn().mockResolvedValue([]) },
  feedbackPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  placeView: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
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

const mockGetNearby = jest.fn().mockResolvedValue([]);
jest.mock('../../src/services/googlePlaces', () => {
  const actual = jest.requireActual('../../src/services/googlePlaces');
  return {
    ...actual,
    getNearbyRestaurants: (...args) => mockGetNearby(...args),
    getNearbyRestaurantsFast: jest.fn().mockResolvedValue([]),
    getPhotoUrl: jest.fn().mockReturnValue('https://example.com/photo.jpg'),
  };
});

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');
const token = createTestToken({ id: userId, email: 'u@test.com', role: 'USER' });

// Kullanıcı konumuna yakın, kalite filtresinden geçen Google Places sonucu.
const place = (id, name) => ({
  place_id: id,
  name,
  rating: 4.6,
  user_ratings_total: 120,
  types: ['restaurant', 'food'],
  geometry: { location: { lat: 41.001, lng: 29.001 } },
  opening_hours: { open_now: true },
  photos: [{ photo_reference: 'ref' }],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue(testUser);
  mockPrisma.subscription.findUnique.mockResolvedValue(null);
  mockPrisma.restaurantProfile.findMany.mockResolvedValue([]);
  for (const m of ['favorite', 'review', 'reservation', 'checkIn', 'diaryEntry', 'recommendation']) {
    mockPrisma[m].findMany.mockResolvedValue([]);
  }
  mockPrisma.feedbackPreference.findUnique.mockResolvedValue(null);
  mockPrisma.placeView.findMany.mockResolvedValue([]);
  mockPrisma.placeView.upsert.mockResolvedValue({});
  mockGetNearby.mockResolvedValue([]);
});

describe('POST /api/places/view', () => {
  it('placeId/placeName ile görüntülemeyi upsert eder', async () => {
    const res = await request(app)
      .post('/api/places/view')
      .set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'Test Yeri', placeTypes: ['restaurant'] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockPrisma.placeView.upsert).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.placeView.upsert.mock.calls[0][0];
    expect(arg.where.userId_placeId).toEqual({ userId, placeId: 'p1' });
  });

  it('placeName eksikse 400 döner', async () => {
    const res = await request(app)
      .post('/api/places/view')
      .set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1' });
    expect(res.status).toBe(400);
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post('/api/places/view').send({ placeId: 'p1', placeName: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/places/recently-viewed', () => {
  it('son baktıkları viewedAt desc döner', async () => {
    mockPrisma.placeView.findMany.mockResolvedValue([
      { placeId: 'p1', placeName: 'A', placeAddress: null, placePhotoUrl: null, placeRating: 4.5, placeTypes: ['restaurant'], viewedAt: new Date() },
    ]);
    const res = await request(app).get('/api/places/recently-viewed').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.recentlyViewed).toHaveLength(1);
    expect(res.body.recentlyViewed[0]).toMatchObject({ placeId: 'p1', name: 'A', rating: 4.5 });
  });
});

describe('GET /api/places/personalized', () => {
  it('sinyalsiz + nearby boş → 200 ve boş section\'lar', async () => {
    const res = await request(app).get('/api/places/personalized?lat=41&lng=29').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.forYou).toEqual([]);
    expect(res.body.recentlyViewed).toEqual([]);
    expect(res.body.revisit).toEqual([]);
    expect(res.body.tasteProfile.topCuisines).toEqual([]);
  });

  it('lat/lng yoksa 400', async () => {
    const res = await request(app).get('/api/places/personalized').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('favori mutfağa göre forYou yeniden sıralanır + neden rozeti taşır', async () => {
    mockGetNearby.mockResolvedValue([place('piz', 'Pizza Place'), place('keb', 'Şehir Kebap')]);
    mockPrisma.favorite.findMany.mockResolvedValue([{ placeId: 'k0', placeName: 'Eski Kebapçı' }]);
    const res = await request(app).get('/api/places/personalized?lat=41&lng=29').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.forYou.length).toBeGreaterThanOrEqual(2);
    expect(res.body.forYou[0].placeId).toBe('keb');
    expect(res.body.forYou[0].reasons).toContain('Sevdiğin mutfak: Kebap');
  });
});
