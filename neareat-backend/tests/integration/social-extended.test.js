/**
 * Social Extended Integration Tests
 *
 * Kapsam (api.test.js'te eksik olanlar):
 *  - GET  /api/social/friends/requests        (bekleyen istek listesi)
 *  - POST /api/social/friends/requests/:id/accept (kabul et)
 *  - POST /api/social/friends/requests/:id/reject (reddet)
 *  - DELETE /api/social/friends/:id           (arkadaşlıktan çıkar)
 *  - POST /api/social/recommendations         (öneri gönder)
 *  - GET  /api/social/recommendations/mine    (gönderilen öneriler)
 *  - GET  /api/social/recommendations/received (gelen öneriler)
 */

const request = require('supertest');
const { createTestToken, randomId, createTestUser } = require('../helpers');

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  subscription: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  favorite: { findMany: jest.fn(), count: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  review: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() },
  friendRequest: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  recommendation: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  activityEvent: { findMany: jest.fn() },
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

let user1, token1, user2, token2;

beforeEach(() => {
  jest.clearAllMocks();

  user1 = createTestUser({ id: 'social-user-1', displayName: 'Alice' });
  token1 = createTestToken(user1.id);
  user2 = createTestUser({ id: 'social-user-2', displayName: 'Bob' });
  token2 = createTestToken(user2.id);

  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === user1.id) return Promise.resolve(user1);
    if (where.id === user2.id) return Promise.resolve(user2);
    return Promise.resolve(null);
  });

  // awardStars kullanımı için mock'lar
  // prisma.$transaction([starEvent.create, user.update]) → [event, updatedUser] array döndürmeli
  mockPrisma.$transaction.mockImplementation((ops) => {
    if (Array.isArray(ops)) {
      return Promise.resolve([
        { id: 'se-1', type: 'FRIEND_ADDED', stars: 1 },
        { starCount: 1 },
      ]);
    }
    return Promise.resolve(ops);
  });
  mockPrisma.reward.findMany.mockResolvedValue([]);
  mockPrisma.userReward.findMany.mockResolvedValue([]);
  mockPrisma.userReward.create.mockResolvedValue({});
  mockPrisma.subscription.findUnique.mockResolvedValue(null);
  mockPrisma.recommendation.count.mockResolvedValue(0);
});

// ─── GET /api/social/friends/requests ────────────────────────────────────────

describe('GET /api/social/friends/requests', () => {
  it('returns pending requests for the authenticated user', async () => {
    const pendingReq = {
      id: 'req-1',
      fromUserId: user2.id,
      toUserId: user1.id,
      status: 'PENDING',
      note: 'Merhaba!',
      createdAt: new Date(),
      fromUser: { id: user2.id, displayName: 'Bob', photoUrl: null, bio: null, city: null, starCount: 0 },
    };
    mockPrisma.friendRequest.findMany.mockResolvedValue([pendingReq]);

    const res = await request(app)
      .get('/api/social/friends/requests')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe('req-1');
    expect(res.body[0].fromUserId).toBe(user2.id);
    expect(res.body[0].note).toBe('Merhaba!');
  });

  it('returns empty array when no pending requests', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/social/friends/requests')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/social/friends/requests');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/social/friends/requests/:id/accept ────────────────────────────

describe('POST /api/social/friends/requests/:id/accept', () => {
  it('returns 200 and updated friend when request belongs to user', async () => {
    const pendingReq = {
      id: 'req-1',
      fromUserId: user2.id,
      toUserId: user1.id,
      status: 'PENDING',
      fromUser: { id: user2.id, displayName: 'Bob', photoUrl: null, bio: null, city: null, starCount: 0 },
    };
    mockPrisma.friendRequest.findUnique.mockResolvedValue(pendingReq);
    mockPrisma.friendRequest.update.mockResolvedValue({
      ...pendingReq,
      status: 'ACCEPTED',
      fromUser: { id: user2.id, displayName: 'Bob', photoUrl: null, bio: null, city: null, starCount: 0 },
    });
    // awardStars: user.findUnique for current starCount
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === user1.id) return Promise.resolve(user1);
      if (where.id === user2.id) return Promise.resolve(user2);
      return Promise.resolve(null);
    });

    const res = await request(app)
      .post('/api/social/friends/requests/req-1/accept')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.friend).toBeDefined();
  });

  it('returns 403 when request belongs to another user', async () => {
    const pendingReq = {
      id: 'req-1',
      fromUserId: user1.id,
      toUserId: 'some-other-user',
      status: 'PENDING',
    };
    mockPrisma.friendRequest.findUnique.mockResolvedValue(pendingReq);

    const res = await request(app)
      .post('/api/social/friends/requests/req-1/accept')
      .set('Authorization', `Bearer ${token1}`); // user1 is fromUser, not toUser

    expect(res.status).toBe(403);
  });

  it('returns 404 when request does not exist', async () => {
    mockPrisma.friendRequest.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/social/friends/requests/nonexistent/accept')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 when request is already processed', async () => {
    const acceptedReq = {
      id: 'req-1',
      fromUserId: user2.id,
      toUserId: user1.id,
      status: 'ACCEPTED',
    };
    mockPrisma.friendRequest.findUnique.mockResolvedValue(acceptedReq);

    const res = await request(app)
      .post('/api/social/friends/requests/req-1/accept')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/social/friends/requests/req-1/accept');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/social/friends/requests/:id/reject ────────────────────────────

describe('POST /api/social/friends/requests/:id/reject', () => {
  it('returns 200 when request owner rejects', async () => {
    const pendingReq = {
      id: 'req-2',
      fromUserId: user2.id,
      toUserId: user1.id,
      status: 'PENDING',
    };
    mockPrisma.friendRequest.findUnique.mockResolvedValue(pendingReq);
    mockPrisma.friendRequest.update.mockResolvedValue({ ...pendingReq, status: 'REJECTED' });

    const res = await request(app)
      .post('/api/social/friends/requests/req-2/reject')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('returns 403 when not the request recipient', async () => {
    mockPrisma.friendRequest.findUnique.mockResolvedValue({
      id: 'req-2',
      fromUserId: user1.id,
      toUserId: 'other-user',
      status: 'PENDING',
    });

    const res = await request(app)
      .post('/api/social/friends/requests/req-2/reject')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when request does not exist', async () => {
    mockPrisma.friendRequest.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/social/friends/requests/nonexistent/reject')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/social/friends/requests/req-2/reject');
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/social/friends/:id ──────────────────────────────────────────

describe('DELETE /api/social/friends/:id', () => {
  it('returns 200 when friendship belongs to user (as fromUser)', async () => {
    const friendship = {
      id: 'fr-1',
      fromUserId: user1.id,
      toUserId: user2.id,
      status: 'ACCEPTED',
    };
    mockPrisma.friendRequest.findUnique.mockResolvedValue(friendship);
    mockPrisma.friendRequest.delete.mockResolvedValue(friendship);

    const res = await request(app)
      .delete('/api/social/friends/fr-1')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('returns 200 when friendship belongs to user (as toUser)', async () => {
    const friendship = {
      id: 'fr-2',
      fromUserId: user2.id,
      toUserId: user1.id,
      status: 'ACCEPTED',
    };
    mockPrisma.friendRequest.findUnique.mockResolvedValue(friendship);
    mockPrisma.friendRequest.delete.mockResolvedValue(friendship);

    const res = await request(app)
      .delete('/api/social/friends/fr-2')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
  });

  it('returns 403 when friendship does not involve the user', async () => {
    mockPrisma.friendRequest.findUnique.mockResolvedValue({
      id: 'fr-3',
      fromUserId: 'stranger-1',
      toUserId: 'stranger-2',
      status: 'ACCEPTED',
    });

    const res = await request(app)
      .delete('/api/social/friends/fr-3')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when friendship record does not exist', async () => {
    mockPrisma.friendRequest.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/social/friends/nonexistent')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/social/friends/fr-1');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/social/recommendations ────────────────────────────────────────

describe('POST /api/social/recommendations', () => {
  it('returns 201 when sending a recommendation', async () => {
    const created = {
      id: 'rec-1',
      fromUserId: user1.id,
      toUserId: null,
      placeId: 'place-abc',
      placeName: 'Harika Restoran',
      placeTypes: ['restaurant'],
      createdAt: new Date(),
    };
    mockPrisma.recommendation.create.mockResolvedValue(created);
    // awardStars needs user starCount
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === user1.id) return Promise.resolve(user1);
      if (where.id === user2.id) return Promise.resolve(user2);
      return Promise.resolve(null);
    });

    const res = await request(app)
      .post('/api/social/recommendations')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'place-abc', placeName: 'Harika Restoran', toUserIds: [] });

    expect(res.status).toBe(201);
    expect(res.body.recommendations).toBeDefined();
    expect(res.body.recommendations[0].placeId).toBe('place-abc');
  });

  it('returns 400 when placeId is missing', async () => {
    const res = await request(app)
      .post('/api/social/recommendations')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeName: 'Test Restaurant' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when placeName is missing', async () => {
    const res = await request(app)
      .post('/api/social/recommendations')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'place-abc' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/social/recommendations').send({});
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/social/recommendations/mine ────────────────────────────────────

describe('GET /api/social/recommendations/mine', () => {
  it('returns sent recommendations for user', async () => {
    const recs = [
      { id: 'r1', fromUserId: user1.id, placeId: 'p1', placeName: 'A', createdAt: new Date() },
      { id: 'r2', fromUserId: user1.id, placeId: 'p2', placeName: 'B', createdAt: new Date() },
    ];
    mockPrisma.recommendation.findMany.mockResolvedValue(recs);

    const res = await request(app)
      .get('/api/social/recommendations/mine')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('returns empty array when no recommendations sent', async () => {
    mockPrisma.recommendation.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/social/recommendations/mine')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/social/recommendations/mine');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/social/recommendations/received ────────────────────────────────

describe('GET /api/social/recommendations/received', () => {
  it('returns received recommendations with fromProfile', async () => {
    const recs = [
      {
        id: 'r3',
        fromUserId: user2.id,
        toUserId: user1.id,
        placeId: 'p1',
        placeName: 'Place A',
        createdAt: new Date(),
        fromUser: { id: user2.id, displayName: 'Bob', photoUrl: null, starCount: 5 },
      },
    ];
    mockPrisma.recommendation.findMany.mockResolvedValue(recs);

    const res = await request(app)
      .get('/api/social/recommendations/received')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body[0].fromProfile).toBeDefined();
    expect(res.body[0].fromProfile.displayName).toBe('Bob');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/social/recommendations/received');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/social/feed (S4-5) ──────────────────────────────────────────────

describe('GET /api/social/feed', () => {
  function friendship() {
    // user1 ↔ user2 arkadaş
    mockPrisma.friendRequest.findMany.mockResolvedValue([
      { fromUserId: user1.id, toUserId: user2.id },
    ]);
  }

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/social/feed');
    expect(res.status).toBe(401);
  });

  it('arkadasi olmayan kullaniciya bos feed doner, event sorgusu atilmaz', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ events: [], nextCursor: null });
    expect(mockPrisma.activityEvent.findMany).not.toHaveBeenCalled();
  });

  it('arkadaslarin son 7 gun event\'lerini kullanici profiliyle birlikte doner', async () => {
    friendship();
    mockPrisma.activityEvent.findMany.mockResolvedValue([
      { id: 'e1', userId: user2.id, type: 'REVIEW', placeId: 'p1', metadata: { placeName: 'X', rating: 5 }, createdAt: new Date('2026-05-28T10:00:00Z') },
      { id: 'e2', userId: user2.id, type: 'FAVORITE', placeId: 'p2', metadata: { placeName: 'Y' }, createdAt: new Date('2026-05-27T10:00:00Z') },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: user2.id, displayName: 'Bob', photoUrl: null },
    ]);

    const res = await request(app)
      .get('/api/social/feed')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toMatchObject({ id: 'e1', type: 'REVIEW', placeId: 'p1', user: { id: user2.id, displayName: 'Bob' } });
    expect(res.body.nextCursor).toBeNull();

    // Event sorgusu: arkadas id'leri IN + 7 gun penceresi + tek findMany
    expect(mockPrisma.activityEvent.findMany).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.activityEvent.findMany.mock.calls[0][0];
    expect(arg.where.userId.in).toEqual([user2.id]);
    expect(arg.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it('limit+1 sonuc gelince nextCursor doner ve sayfa limitle kirpilir', async () => {
    friendship();
    // limit=2 istenince controller take=3 yapar; 3 donersek hasMore=true
    const rows = [
      { id: 'e1', userId: user2.id, type: 'REVIEW', placeId: 'p1', metadata: null, createdAt: new Date('2026-05-28T10:00:00Z') },
      { id: 'e2', userId: user2.id, type: 'FAVORITE', placeId: 'p2', metadata: null, createdAt: new Date('2026-05-27T10:00:00Z') },
      { id: 'e3', userId: user2.id, type: 'RESERVATION', placeId: 'p3', metadata: null, createdAt: new Date('2026-05-26T10:00:00Z') },
    ];
    mockPrisma.activityEvent.findMany.mockResolvedValue(rows);
    mockPrisma.user.findMany.mockResolvedValue([{ id: user2.id, displayName: 'Bob', photoUrl: null }]);

    const res = await request(app)
      .get('/api/social/feed?limit=2')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.nextCursor).toBe('e2'); // sayfadaki son event
    expect(mockPrisma.activityEvent.findMany.mock.calls[0][0].take).toBe(3);
  });

  it('cursor verilince cursor + skip:1 uygulanir', async () => {
    friendship();
    mockPrisma.activityEvent.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await request(app)
      .get('/api/social/feed?cursor=e2')
      .set('Authorization', `Bearer ${token1}`);

    const arg = mockPrisma.activityEvent.findMany.mock.calls[0][0];
    expect(arg.cursor).toEqual({ id: 'e2' });
    expect(arg.skip).toBe(1);
  });
});
