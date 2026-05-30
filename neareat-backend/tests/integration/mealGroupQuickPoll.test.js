'use strict';

/**
 * Sprint-7 #96 — POST /api/meal-groups/:id/quick-poll integration testleri.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  mealGroupMember: { findUnique: jest.fn(), findMany: jest.fn() },
  mealGroup: { findUnique: jest.fn() },
  restaurantPoll: { updateMany: jest.fn(), create: jest.fn() },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));

jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(undefined),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

const mockGetNearby = jest.fn();
jest.mock('../../src/services/googlePlaces', () => ({
  getNearbyRestaurantsFast: (...args) => mockGetNearby(...args),
  getPhotoUrl: (ref) => `https://photo/${ref}`,
  passesQualityFilter: jest.fn((p) => p._passes !== false),
  getNearbyRestaurants: jest.fn(),
  searchPlacesByText: jest.fn(),
  getRouteWaypoints: jest.fn(),
  getPlaceDetails: jest.fn(),
  isOpenAtTime: jest.fn(),
  isExcludedByName: jest.fn().mockReturnValue(false),
  normalizeName: jest.fn((n) => n),
}));

jest.mock('../../src/services/notificationService', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const userId = 'u-1';
const groupId = 'g-1';
const token = createTestToken({ id: userId, email: 'u@test.com', role: 'USER' });

const NEARBY_PLACES = [
  { place_id: 'p1', name: 'Köşk Restoran', vicinity: 'Beyoğlu', rating: 4.5, user_ratings_total: 200, photos: [{ photo_reference: 'ref1' }] },
  { place_id: 'p2', name: 'Çınaraltı', vicinity: 'Fatih', rating: 4.2, user_ratings_total: 150, photos: [] },
  { place_id: 'p3', name: 'Meze Evi', vicinity: 'Karaköy', rating: 4.7, user_ratings_total: 300, photos: [{ photo_reference: 'ref3' }] },
];

const CREATED_POLL = {
  id: 'poll-1',
  groupId,
  creatorId: userId,
  question: 'Şu an nereye gidelim?',
  status: 'OPEN',
  creator: { id: userId, displayName: 'User' },
  options: NEARBY_PLACES.map((p, i) => ({
    id: `opt-${i}`,
    placeId: p.place_id,
    placeName: p.name,
    votes: [],
  })),
  createdAt: new Date().toISOString(),
  closedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'User', starCount: 0, isSuspended: false,
  });
  mockPrisma.mealGroupMember.findUnique.mockResolvedValue({
    groupId, userId, status: 'ACCEPTED',
  });
  mockPrisma.mealGroupMember.findMany.mockResolvedValue([{ userId: 'u-2' }]);
  mockPrisma.mealGroup.findUnique.mockResolvedValue({ id: groupId, name: 'Test Grubu', creatorId: userId });
  mockPrisma.restaurantPoll.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.restaurantPoll.create.mockResolvedValue(CREATED_POLL);
  mockGetNearby.mockResolvedValue(NEARBY_PLACES);
});

const PATH = `/api/meal-groups/${groupId}/quick-poll`;

describe('POST /api/meal-groups/:id/quick-poll', () => {
  it('lat/lng yoksa 400', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lat ve lng/);
  });

  it('geçersiz koordinat 400', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ lat: 999, lng: 200 });
    expect(res.status).toBe(400);
  });

  it('üye değilse 403', async () => {
    mockPrisma.mealGroupMember.findUnique.mockResolvedValue(null);
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ lat: 41.01, lng: 28.97 });
    expect(res.status).toBe(403);
  });

  it('yakında yeterli restoran yoksa 422', async () => {
    mockGetNearby.mockResolvedValue([]);
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ lat: 41.01, lng: 28.97 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/yeterli restoran/);
  });

  it('başarılı hızlı anket oluşturur', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ lat: 41.01, lng: 28.97 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('poll-1');
    expect(res.body.question).toBe('Şu an nereye gidelim?');
    expect(mockGetNearby).toHaveBeenCalledWith(41.01, 28.97);
    expect(mockPrisma.restaurantPoll.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { groupId, status: 'OPEN' } }),
    );
  });

  it('özel soru ile anket oluşturur', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ lat: 41.01, lng: 28.97, question: 'Akşam yemeği nerede?' });
    expect(res.status).toBe(201);
    expect(mockPrisma.restaurantPoll.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ question: 'Akşam yemeği nerede?' }),
      }),
    );
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post(PATH).send({ lat: 41.01, lng: 28.97 });
    expect(res.status).toBe(401);
  });

  it('INVITED üye anket oluşturamaz', async () => {
    mockPrisma.mealGroupMember.findUnique.mockResolvedValue({ groupId, userId, status: 'INVITED' });
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ lat: 41.01, lng: 28.97 });
    expect(res.status).toBe(403);
  });
});
