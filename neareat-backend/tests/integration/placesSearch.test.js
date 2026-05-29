'use strict';

/**
 * Sprint-6 #82 — GET /api/places/search integration testleri.
 *
 * googlePlaces.searchPlacesByText mock'lanır; controller'ın filtre + shape
 * davranışı uçtan uca doğrulanır.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  subscription: { findUnique: jest.fn() },
  restaurantProfile: { findMany: jest.fn().mockResolvedValue([]) },
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
jest.mock('../../src/services/googlePlaces', () => ({
  getNearbyRestaurants: jest.fn().mockResolvedValue([]),
  getNearbyRestaurantsFast: jest.fn().mockResolvedValue([]),
  searchPlacesByText: (...args) => mockSearchPlacesByText(...args),
  getPlaceDetails: jest.fn(),
  getPhotoUrl: jest.fn().mockReturnValue('https://example.com/photo.jpg'),
  passesQualityFilter: jest.requireActual('../../src/services/googlePlaces').passesQualityFilter,
}));

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const userId = '11111111-1111-1111-1111-111111111111';
const token = createTestToken({ id: userId, email: 'u@test.com', role: 'USER' });

const goodPlace = (over = {}) => ({
  place_id: 'p1',
  name: 'Tarihi Pizza',
  rating: 4.6,
  user_ratings_total: 120,
  types: ['restaurant', 'food'],
  geometry: { location: { lat: 41.012, lng: 28.974 } },
  opening_hours: { open_now: true },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'U', starCount: 0, isSuspended: false,
  });
  mockPrisma.restaurantProfile.findMany.mockResolvedValue([]);
});

describe('GET /api/places/search', () => {
  it('q parametresi yoksa 400', async () => {
    const res = await request(app).get('/api/places/search').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/q/);
  });

  it('q çok kısaysa 400', async () => {
    const res = await request(app).get('/api/places/search?q=a').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('lat/lng verilirse searchPlacesByText konum bias ile çağrılır', async () => {
    mockSearchPlacesByText.mockResolvedValue([goodPlace()]);
    const res = await request(app)
      .get('/api/places/search?q=pizza&lat=41.012&lng=28.974')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockSearchPlacesByText).toHaveBeenCalledWith('pizza', 41.012, 28.974);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].placeId).toBe('p1');
    expect(res.body.results[0].distanceKm).toBeGreaterThanOrEqual(0);
    expect(res.body.query).toBe('pizza');
  });

  it('lat/lng yoksa searchPlacesByText konum biası olmadan çağrılır', async () => {
    mockSearchPlacesByText.mockResolvedValue([goodPlace()]);
    const res = await request(app)
      .get('/api/places/search?q=pizza')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockSearchPlacesByText).toHaveBeenCalledWith('pizza', undefined, undefined);
    expect(res.body.results[0].distanceKm).toBeNull();
  });

  it('düşük rating sonucu elenir (passesQualityFilter)', async () => {
    mockSearchPlacesByText.mockResolvedValue([
      goodPlace(),
      goodPlace({ place_id: 'p2', name: 'Kötü Pizza', rating: 1.2, user_ratings_total: 50 }),
    ]);
    const res = await request(app)
      .get('/api/places/search?q=pizza&lat=41&lng=29')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].placeId).toBe('p1');
  });

  it('istenmeyen isim (örn. Fırın) elenir', async () => {
    mockSearchPlacesByText.mockResolvedValue([
      goodPlace(),
      goodPlace({ place_id: 'p2', name: 'Halk Ekmek Fırını', rating: 4.8, user_ratings_total: 200 }),
    ]);
    const res = await request(app)
      .get('/api/places/search?q=ekmek&lat=41&lng=29')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.results.map((r) => r.placeId)).toEqual(['p1']);
  });

  it('oturum açmamış kullanıcı da arayabilir (optionalAuthenticate)', async () => {
    mockSearchPlacesByText.mockResolvedValue([goodPlace()]);
    const res = await request(app).get('/api/places/search?q=pizza');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
  });

  it('boş sonuç → boş results dizisi', async () => {
    mockSearchPlacesByText.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/places/search?q=cokokendiriverarama')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });
});
