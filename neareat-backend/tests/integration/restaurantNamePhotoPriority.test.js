'use strict';

/**
 * S10-4 — Kullanıcı tarafı isim & foto önceliği.
 * nearby/search: name = profile.displayName || google; photoUrl = profil RESTAURANT ilk foto || google.
 * detail: photos = profil RESTAURANT fotoları + google; productPhotos = profil PRODUCT fotoları.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  subscription: { findUnique: jest.fn() },
  restaurantProfile: { findMany: jest.fn(), findFirst: jest.fn() },
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

const mockGetNearby = jest.fn();
const mockGetDetails = jest.fn();
jest.mock('../../src/services/googlePlaces', () => {
  const actual = jest.requireActual('../../src/services/googlePlaces');
  return {
    ...actual,
    getNearbyRestaurants: (...args) => mockGetNearby(...args),
    getNearbyRestaurantsFast: jest.fn().mockResolvedValue([]),
    searchPlacesByText: jest.fn().mockResolvedValue([]),
    getPlaceDetails: (...args) => mockGetDetails(...args),
    getPhotoUrl: jest.fn((ref) => `https://google.example/${ref}`),
  };
});

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');
// Mock'lanmış getPhotoUrl referansı — S15-P3 boyut argümanı doğrulaması için
const { getPhotoUrl: mockGetPhotoUrl } = require('../../src/services/googlePlaces');

const userId = '11111111-1111-1111-1111-111111111111';
const token = createTestToken({ id: userId, email: 'u@test.com', role: 'USER' });

const googlePlace = (over = {}) => ({
  place_id: 'p1',
  name: 'Mavera Gıda',
  rating: 4.6,
  user_ratings_total: 120,
  types: ['restaurant', 'food'],
  geometry: { location: { lat: 41.012, lng: 28.974 } },
  opening_hours: { open_now: true },
  photos: [{ photo_reference: 'gref1' }, { photo_reference: 'gref2' }],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'U', starCount: 0, isSuspended: false,
  });
  mockPrisma.subscription.findUnique.mockResolvedValue(null);
  mockGetNearby.mockResolvedValue([]);
});

describe('GET /api/restaurants/nearby — isim & foto önceliği (S10-4)', () => {
  it('displayName dolu + RESTAURANT galeri fotosu → name=displayName, photoUrl=sahibin fotosu', async () => {
    mockGetNearby.mockResolvedValueOnce([googlePlace()]);
    mockPrisma.restaurantProfile.findMany.mockResolvedValue([
      { placeId: 'p1', displayName: 'Mavera Restaurant', photos: [{ url: 'https://cdn.example/owner1.jpg' }] },
    ]);

    const res = await request(app)
      .get('/api/restaurants/nearby?lat=41.012&lng=28.974&type=restaurant')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const row = res.body.results.find((r) => r.placeId === 'p1');
    expect(row.name).toBe('Mavera Restaurant');
    expect(row.photoUrl).toBe('https://cdn.example/owner1.jpg');
  });

  it('profil yok → name=Google adı, photoUrl=Google fotosu (regresyon yok)', async () => {
    mockGetNearby.mockResolvedValueOnce([googlePlace()]);
    mockPrisma.restaurantProfile.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/restaurants/nearby?lat=41.012&lng=28.974&type=restaurant')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const row = res.body.results.find((r) => r.placeId === 'p1');
    expect(row.name).toBe('Mavera Gıda');
    expect(row.photoUrl).toBe('https://google.example/gref1');
    // S15-P3 — liste kartı küçük thumbnail (200px) ister
    expect(mockGetPhotoUrl).toHaveBeenCalledWith('gref1', 200);
  });

  it('displayName boş ama profil var → name=Google adı, photoUrl=Google (galeri boş)', async () => {
    mockGetNearby.mockResolvedValueOnce([googlePlace()]);
    mockPrisma.restaurantProfile.findMany.mockResolvedValue([
      { placeId: 'p1', displayName: null, photos: [] },
    ]);

    const res = await request(app)
      .get('/api/restaurants/nearby?lat=41.012&lng=28.974&type=restaurant')
      .set('Authorization', `Bearer ${token}`);

    const row = res.body.results.find((r) => r.placeId === 'p1');
    expect(row.name).toBe('Mavera Gıda');
    expect(row.photoUrl).toBe('https://google.example/gref1');
  });

  it('S16-4 — type=all yalnızca 3 tip çeker (eski 5 yerine), dedup eder', async () => {
    mockGetNearby.mockResolvedValue([]); // her tip boş
    mockPrisma.restaurantProfile.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/restaurants/nearby?lat=41.012&lng=28.974&type=all')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // S16-4 — varsayılan NEARBY_ALL_TYPES = restaurant,cafe,meal_takeaway (3 çağrı)
    expect(mockGetNearby).toHaveBeenCalledTimes(3);
    const types = mockGetNearby.mock.calls.map((c) => c[3]);
    expect(types).toEqual(['restaurant', 'cafe', 'meal_takeaway']);
  });
});

describe('GET /api/restaurants/:placeId — detay isim & foto sırası (S10-4)', () => {
  const detailPlace = {
    name: 'Mavera Gıda',
    rating: 4.6,
    user_ratings_total: 120,
    types: ['restaurant'],
    formatted_address: 'İstanbul',
    geometry: { location: { lat: 41.012, lng: 28.974 } },
    photos: [{ photo_reference: 'gref1' }, { photo_reference: 'gref2' }],
    reviews: [],
  };

  it('sahibin RESTAURANT fotoları önce, Google sonra; productPhotos döner (premium); name=displayName', async () => {
    // productPhotos yalnızca premium kullanıcılara döner
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'sub-1', userId, status: 'active', expiresAt: new Date('2030-01-01'),
    });
    mockGetDetails.mockResolvedValue(detailPlace);
    mockPrisma.restaurantProfile.findFirst.mockResolvedValue({
      id: 'r-1', displayName: 'Mavera Restaurant', status: 'APPROVED', menuItems: [],
      photos: [
        { kind: 'RESTAURANT', url: 'https://cdn.example/r1.jpg', sortOrder: 0 },
        { kind: 'RESTAURANT', url: 'https://cdn.example/r2.jpg', sortOrder: 1 },
        { kind: 'PRODUCT', url: 'https://cdn.example/p1.jpg', sortOrder: 0 },
      ],
    });

    const res = await request(app)
      .get('/api/restaurants/p1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Mavera Restaurant');
    expect(res.body.photos).toEqual([
      'https://cdn.example/r1.jpg',
      'https://cdn.example/r2.jpg',
      'https://google.example/gref1',
      'https://google.example/gref2',
    ]);
    expect(res.body.productPhotos).toEqual(['https://cdn.example/p1.jpg']);
  });

  it('free kullanıcı → productPhotos gizli ([]) ama hasProductPhotos=true', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null); // free
    mockGetDetails.mockResolvedValue(detailPlace);
    mockPrisma.restaurantProfile.findFirst.mockResolvedValue({
      id: 'r-1', displayName: 'Mavera Restaurant', status: 'APPROVED', menuItems: [],
      photos: [
        { kind: 'RESTAURANT', url: 'https://cdn.example/r1.jpg', sortOrder: 0 },
        { kind: 'PRODUCT', url: 'https://cdn.example/p1.jpg', sortOrder: 0 },
      ],
    });

    const res = await request(app)
      .get('/api/restaurants/p1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.productPhotos).toEqual([]);
    expect(res.body.hasProductPhotos).toBe(true);
    // Mekan (RESTAURANT) fotoları free'ye de görünür
    expect(res.body.photos).toContain('https://cdn.example/r1.jpg');
  });

  it('profil yok → photos tamamen Google, productPhotos boş, name=Google adı', async () => {
    mockGetDetails.mockResolvedValue(detailPlace);
    mockPrisma.restaurantProfile.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/restaurants/p1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Mavera Gıda');
    expect(res.body.photos).toEqual(['https://google.example/gref1', 'https://google.example/gref2']);
    expect(res.body.productPhotos).toEqual([]);
    // S15-P3 — detay ekranı büyük foto kullanır; thumbnail (200px) İSTEMEZ
    expect(mockGetPhotoUrl).toHaveBeenCalledWith('gref1');
    expect(mockGetPhotoUrl).not.toHaveBeenCalledWith('gref1', 200);
  });

  it('B6 — foto sıralaması sortOrder + createdAt tie-breaker ile sorgulanır', async () => {
    mockGetDetails.mockResolvedValue(detailPlace);
    mockPrisma.restaurantProfile.findFirst.mockResolvedValue({
      id: 'r-1', displayName: null, status: 'APPROVED', menuItems: [], photos: [],
    });

    await request(app).get('/api/restaurants/p1').set('Authorization', `Bearer ${token}`);

    const arg = mockPrisma.restaurantProfile.findFirst.mock.calls[0][0];
    expect(arg.include.photos.orderBy).toEqual([{ sortOrder: 'asc' }, { createdAt: 'asc' }]);
  });
});
