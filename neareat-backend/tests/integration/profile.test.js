/**
 * Profile Integration Tests
 *
 * Kapsam (api.test.js'te eksik olanlar):
 *  - PUT /api/profile/me  (profil güncelleme)
 *  - GET /api/profile/:userId  (başka kullanıcının profili: public, private, non-existent)
 */

const request = require('supertest');
const { createTestToken, createTestUser } = require('../helpers');

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  subscription: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  favorite: { findMany: jest.fn(), count: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  review: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() },
  friendRequest: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  recommendation: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  starEvent: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  reward: { findMany: jest.fn() },
  userReward: { findMany: jest.fn(), create: jest.fn() },
  notification: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), count: jest.fn() },
  message: { findMany: jest.fn(), create: jest.fn(), count: jest.fn(), updateMany: jest.fn(), groupBy: jest.fn() },
  collectionItem: { findMany: jest.fn() },
  restaurantProfile: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

jest.mock('../../src/utils/prisma', () => mockPrisma);

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid', email: 'test@test.com', name: 'Test' }),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  }),
  getMessaging: () => ({ send: jest.fn().mockResolvedValue('message-id') }),
}));

jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/googlePlaces', () => ({
  getNearbyRestaurants: jest.fn().mockResolvedValue([]),
  getPlaceDetails: jest.fn().mockResolvedValue(null),
  getPhotoUrl: jest.fn().mockReturnValue(null),
}));

jest.mock('../../src/jobs/reservationReminders', () => ({
  scheduleReservationReminders: jest.fn(),
}));

// ─── App ─────────────────────────────────────────────────────────────────────

const app = require('../../src/app');

// ─── Test users ──────────────────────────────────────────────────────────────

let user1, token1, user2;

beforeEach(() => {
  jest.clearAllMocks();

  user1 = createTestUser({ id: 'profile-user-1', displayName: 'Alice', bio: null, city: null });
  token1 = createTestToken(user1.id);
  user2 = createTestUser({ id: 'profile-user-2', displayName: 'Bob', isPublic: true });

  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === user1.id) return Promise.resolve(user1);
    if (where.id === user2.id) return Promise.resolve(user2);
    return Promise.resolve(null);
  });

  mockPrisma.subscription.findUnique.mockResolvedValue(null);
});

// ─── PUT /api/profile/me ─────────────────────────────────────────────────────

describe('PUT /api/profile/me', () => {
  it('updates displayName and returns updated profile', async () => {
    const updated = { ...user1, displayName: 'Alice Updated' };
    mockPrisma.user.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token1}`)
      .send({ displayName: 'Alice Updated' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Alice Updated');
  });

  it('updates bio and trims/slices to 200 chars', async () => {
    const longBio = 'X'.repeat(250);
    const updated = { ...user1, bio: 'X'.repeat(200) };
    mockPrisma.user.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token1}`)
      .send({ bio: longBio });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bio: 'X'.repeat(200) }),
      }),
    );
  });

  it('updates shareWithFriendsRecommender to true', async () => {
    const updated = { ...user1, shareWithFriendsRecommender: true };
    mockPrisma.user.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token1}`)
      .send({ shareWithFriendsRecommender: true });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ shareWithFriendsRecommender: true }),
      }),
    );
  });

  it('updates isPublic to false', async () => {
    const updated = { ...user1, isPublic: false };
    mockPrisma.user.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token1}`)
      .send({ isPublic: false });

    expect(res.status).toBe(200);
    expect(res.body.isPublic).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/profile/me').send({ displayName: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/profile/:userId ─────────────────────────────────────────────────

describe('GET /api/profile/:userId', () => {
  it('returns public profile of another user', async () => {
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === user1.id) return Promise.resolve(user1);
      if (where.id === user2.id) return Promise.resolve(user2);
      return Promise.resolve(null);
    });

    const res = await request(app)
      .get(`/api/profile/${user2.id}`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user2.id);
    expect(res.body.displayName).toBe('Bob');
  });

  it('returns hidden:true for private profile of non-friend', async () => {
    const privateUser = createTestUser({ id: 'private-user', displayName: 'Private', isPublic: false });
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === user1.id) return Promise.resolve(user1);
      if (where.id === 'private-user') return Promise.resolve(privateUser);
      return Promise.resolve(null);
    });
    // Not friends
    mockPrisma.friendRequest.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/profile/private-user')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.hidden).toBe(true);
  });

  it('returns full profile for private user who is a friend', async () => {
    const privateUser = createTestUser({ id: 'private-friend', displayName: 'Secret Bob', isPublic: false });
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === user1.id) return Promise.resolve(user1);
      if (where.id === 'private-friend') return Promise.resolve(privateUser);
      return Promise.resolve(null);
    });
    // ARE friends
    mockPrisma.friendRequest.findFirst.mockResolvedValue({
      id: 'fr-1', fromUserId: user1.id, toUserId: 'private-friend', status: 'ACCEPTED',
    });

    const res = await request(app)
      .get('/api/profile/private-friend')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.hidden).toBeUndefined();
    expect(res.body.displayName).toBe('Secret Bob');
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .get('/api/profile/nobody')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get(`/api/profile/${user2.id}`);
    expect(res.status).toBe(401);
  });
});
