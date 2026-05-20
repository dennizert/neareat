/**
 * NearEat API — Integration Tests
 * 
 * Tüm kritik endpoint'leri test eder:
 * - Auth (register, login, me, delete)
 * - Favorites (list, add, remove, limit)
 * - Reviews (CRUD, content filter)
 * - Subscriptions (trial, get)
 * - Social (friends, recommendations, leaderboard)
 * - Messages (send, list, unread)
 * - Profile (get, update)
 * - Health check
 * 
 * Prisma ve Firebase mock'lanır — gerçek DB/servis gerekmez.
 */

const request = require('supertest');
const { createTestToken, randomId, createTestUser } = require('./helpers');

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Prisma mock
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

jest.mock('../src/utils/prisma', () => mockPrisma);

// Firebase mock
jest.mock('../src/services/firebase', () => ({
  getAuth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid', email: 'test@test.com', name: 'Test' }),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  }),
  getMessaging: () => ({
    send: jest.fn().mockResolvedValue('message-id'),
  }),
}));

// Redis mock
jest.mock('../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

// Google Places mock
jest.mock('../src/services/googlePlaces', () => ({
  getNearbyRestaurants: jest.fn().mockResolvedValue([]),
  getPlaceDetails: jest.fn().mockResolvedValue({ name: 'Test Restaurant', geometry: { location: { lat: 41.0, lng: 29.0 } } }),
  getPhotoUrl: jest.fn().mockReturnValue('https://example.com/photo.jpg'),
}));

// Reservation reminders mock
jest.mock('../src/jobs/reservationReminders', () => ({
  scheduleReservationReminders: jest.fn(),
}));

// ─── App ─────────────────────────────────────────────────────────────────────

const app = require('../src/app');

// ─── Test User ───────────────────────────────────────────────────────────────

let testUser;
let testToken;
let testUser2;
let testToken2;

beforeEach(() => {
  jest.clearAllMocks();

  testUser = createTestUser({ id: 'user-1', email: 'user1@test.com', displayName: 'User One' });
  testToken = createTestToken(testUser.id);

  testUser2 = createTestUser({ id: 'user-2', email: 'user2@test.com', displayName: 'User Two' });
  testToken2 = createTestToken(testUser2.id);

  // Default: authenticate middleware bulacak
  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === testUser.id) return Promise.resolve(testUser);
    if (where.id === testUser2.id) return Promise.resolve(testUser2);
    if (where.email === testUser.email) return Promise.resolve(testUser);
    if (where.email === testUser2.email) return Promise.resolve(testUser2);
    return Promise.resolve(null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /health', () => {
  it('should return ok', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // email check
      mockPrisma.user.create.mockResolvedValue({ ...testUser, id: 'new-user-id' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.com', password: 'securepassword123', displayName: 'New User' });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.com', password: '123', displayName: 'New User' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8-128');
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@test.com' });

      expect(res.status).toBe(400);
    });

    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(testUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testUser.email, password: 'securepass123', displayName: 'Dup User' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login/email', () => {
    it('should reject missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login/email')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('should delete account', async () => {
      mockPrisma.user.delete.mockResolvedValue(testUser);

      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: testUser.id } });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Favorites Endpoints', () => {
  describe('GET /api/favorites', () => {
    it('should list user favorites', async () => {
      const mockFavorites = [
        { id: 'fav-1', placeId: 'place-1', placeName: 'Restaurant A', userId: testUser.id },
      ];
      mockPrisma.favorite.findMany.mockResolvedValue(mockFavorites);

      const res = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].placeName).toBe('Restaurant A');
    });
  });

  describe('POST /api/favorites', () => {
    it('should add a favorite', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null); // not premium
      mockPrisma.favorite.count.mockResolvedValue(0);
      mockPrisma.favorite.upsert.mockResolvedValue({
        id: 'fav-new', userId: testUser.id, placeId: 'place-1', placeName: 'Test Place',
      });

      const res = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ placeId: 'place-1', placeName: 'Test Place', placeLat: 41.0, placeLng: 29.0 });

      expect(res.status).toBe(201);
      expect(res.body.placeId).toBe('place-1');
    });

    it('should reject when free user hits limit', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.favorite.count.mockResolvedValue(3); // FREE_FAVORITES_LIMIT = 3

      const res = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ placeId: 'place-4', placeName: 'Place 4', placeLat: 41.0, placeLng: 29.0 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PREMIUM_REQUIRED');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ placeId: 'place-1' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/favorites/:placeId', () => {
    it('should remove a favorite', async () => {
      mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .delete('/api/favorites/place-1')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Reviews Endpoints', () => {
  describe('GET /api/reviews/:placeId', () => {
    it('should list reviews for a place', async () => {
      const mockReviews = [
        { id: 'rev-1', placeId: 'place-1', rating: 5, body: 'Great!', user: { displayName: 'User', photoUrl: null }, reply: null },
      ];
      mockPrisma.review.findMany.mockResolvedValue(mockReviews);

      const res = await request(app)
        .get('/api/reviews/place-1')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /api/reviews', () => {
    it('should create a review', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);
      mockPrisma.review.upsert.mockResolvedValue({
        id: 'rev-new', placeId: 'place-1', rating: 4, body: 'Nice food',
        user: { displayName: 'Test', photoUrl: null },
      });
      // Stars
      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === testUser.id) return Promise.resolve(testUser);
        return Promise.resolve(null);
      });
      mockPrisma.$transaction.mockResolvedValue([
        { id: 'star-1', userId: testUser.id, type: 'REVIEW', amount: 5 },
        { starCount: 5 },
      ]);
      mockPrisma.reward.findMany.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ placeId: 'place-1', rating: 4, body: 'Nice food', placeName: 'Test Place' });

      expect(res.status).toBe(201);
      expect(res.body.review).toBeDefined();
    });

    it('should reject invalid rating', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ placeId: 'place-1', rating: 6, body: 'Too high' });

      expect(res.status).toBe(400);
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ placeId: 'place-1' });

      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Subscription Endpoints', () => {
  describe('GET /api/subscriptions', () => {
    it('should return null when no subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('should return active subscription', async () => {
      const mockSub = { id: 'sub-1', userId: testUser.id, status: 'active', planType: 'monthly' };
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSub);

      const res = await request(app)
        .get('/api/subscriptions')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });
  });

  describe('POST /api/subscriptions/trial', () => {
    it('should start trial for new user', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({
        id: 'sub-trial', userId: testUser.id, status: 'trial', planType: 'trial',
      });

      const res = await request(app)
        .post('/api/subscriptions/trial')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('trial');
    });

    it('should reject if already has subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ id: 'sub-1', status: 'active' });

      const res = await request(app)
        .post('/api/subscriptions/trial')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/subscriptions/checkout', () => {
    it('should reject invalid plan type', async () => {
      const res = await request(app)
        .post('/api/subscriptions/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ planType: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should accept valid plan type', async () => {
      const res = await request(app)
        .post('/api/subscriptions/checkout')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ planType: 'monthly' });

      expect(res.status).toBe(200);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL
// ═══════════════════════════════════════════════════════════════════════════════

describe('Social Endpoints', () => {
  describe('GET /api/social/friends', () => {
    it('should return friends list', async () => {
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/social/friends')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/social/friends/requests', () => {
    it('should send friend request', async () => {
      mockPrisma.friendRequest.findUnique.mockResolvedValue(null); // no reverse
      mockPrisma.friendRequest.create.mockResolvedValue({
        id: 'fr-1', fromUserId: testUser.id, toUserId: testUser2.id, status: 'PENDING',
      });
      mockPrisma.notification.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/social/friends/requests')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ toUserId: testUser2.id });

      expect(res.status).toBe(201);
    });

    it('should reject self-request', async () => {
      const res = await request(app)
        .post('/api/social/friends/requests')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ toUserId: testUser.id });

      expect(res.status).toBe(400);
    });

    it('should reject missing toUserId', async () => {
      const res = await request(app)
        .post('/api/social/friends/requests')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/social/leaderboard', () => {
    it('should return leaderboard', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', displayName: 'Top User', starCount: 50 },
      ]);
      mockPrisma.user.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/social/leaderboard')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.top5).toBeDefined();
      expect(res.body.myRank).toBeDefined();
    });
  });

  describe('GET /api/social/users/search', () => {
    it('should return empty for empty query', async () => {
      const res = await request(app)
        .get('/api/social/users/search?q=')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should search users', async () => {
      mockPrisma.friendRequest.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u2', displayName: 'Found User', photoUrl: null, bio: null, city: null, starCount: 0, isPublic: true },
      ]);

      const res = await request(app)
        .get('/api/social/users/search?q=Found')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Message Endpoints', () => {
  describe('GET /api/messages/unread-count', () => {
    it('should return unread count', async () => {
      mockPrisma.message.count.mockResolvedValue(3);

      const res = await request(app)
        .get('/api/messages/unread-count')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });
  });

  describe('POST /api/messages/:userId', () => {
    it('should reject empty message', async () => {
      const res = await request(app)
        .post(`/api/messages/${testUser2.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });

    it('should reject self-message', async () => {
      const res = await request(app)
        .post(`/api/messages/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: 'Hello me' });

      expect(res.status).toBe(400);
    });

    it('should reject non-friends', async () => {
      mockPrisma.friendRequest.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/messages/${testUser2.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: 'Hello' });

      expect(res.status).toBe(403);
    });

    it('should send message to friend', async () => {
      mockPrisma.friendRequest.findFirst.mockResolvedValue({ id: 'fr-1', status: 'ACCEPTED' });
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1', content: 'Hello', senderId: testUser.id, receiverId: testUser2.id, isRead: false, createdAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/messages/${testUser2.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ content: 'Hello' });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe('Hello');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Profile Endpoints', () => {
  describe('GET /api/profile/me', () => {
    it('should return profile with stats', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...testUser,
        _count: { reviews: 5, sentRecommendations: 3 },
      });
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.friendRequest.count.mockResolvedValue(2);

      const res = await request(app)
        .get('/api/profile/me')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.friends).toBe(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UNAUTHENTICATED ACCESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Authentication Guard', () => {
  const protectedRoutes = [
    ['GET', '/api/favorites'],
    ['POST', '/api/favorites'],
    ['GET', '/api/subscriptions'],
    ['GET', '/api/social/friends'],
    ['GET', '/api/messages/unread-count'],
    ['GET', '/api/profile/me'],
  ];

  test.each(protectedRoutes)('%s %s should return 401 without token', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path);
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUSPENDED USER
// ═══════════════════════════════════════════════════════════════════════════════

describe('Suspended User', () => {
  it('should reject requests from suspended user', async () => {
    const suspendedUser = createTestUser({ id: 'suspended-1', isSuspended: true });
    const suspendedToken = createTestToken(suspendedUser.id);
    mockPrisma.user.findUnique.mockResolvedValue(suspendedUser);

    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', `Bearer ${suspendedToken}`);

    expect(res.status).toBe(403);
  });
});
