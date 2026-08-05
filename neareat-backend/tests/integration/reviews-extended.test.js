/**
 * Reviews Extended Integration Tests
 *
 * Kapsam (api.test.js'te eksik olanlar):
 *  - PUT  /api/reviews/:reviewId  (güncelleme: owner, non-owner, offensive body)
 *  - DELETE /api/reviews/:reviewId (silme: owner, non-owner)
 *  - POST /api/reviews — content filter (küfür içeren body → 400)
 *  - POST /api/messages/:userId — 2000-char limit + content filter
 */

const request = require('supertest');
const { createTestToken, createTestUser } = require('../helpers');

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  subscription: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  favorite: { findMany: jest.fn(), count: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
  review: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), upsert: jest.fn() },
  // S18-3: starGuards.hasVerifiedVisit (doğrulanmış ziyaret) için
  checkIn: { findFirst: jest.fn() },
  reservation: { findFirst: jest.fn(), count: jest.fn() },
  friendRequest: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  recommendation: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  starEvent: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
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

  user1 = createTestUser({ id: 'review-user-1', displayName: 'Alice' });
  token1 = createTestToken(user1.id);
  user2 = createTestUser({ id: 'review-user-2', displayName: 'Bob' });

  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === user1.id) return Promise.resolve(user1);
    if (where.id === user2.id) return Promise.resolve(user2);
    return Promise.resolve(null);
  });

  mockPrisma.subscription.findUnique.mockResolvedValue(null);
  // awardStars: $transaction([starEvent.create, user.update]) → array
  mockPrisma.$transaction.mockImplementation((ops) => {
    if (Array.isArray(ops)) {
      return Promise.resolve([
        { id: 'se-x', type: 'REVIEW', stars: 5 },
        { starCount: 5 },
      ]);
    }
    return Promise.resolve(ops);
  });
  mockPrisma.reward.findMany.mockResolvedValue([]);
  mockPrisma.userReward.create.mockResolvedValue({});
});

// ─── S13-3: e-posta doğrulaması şartı (ENFORCE_EMAIL_VERIFICATION) ─────────────

describe('POST /api/reviews — e-posta doğrulaması şartı', () => {
  afterEach(() => { delete process.env.ENFORCE_EMAIL_VERIFICATION; });

  it('flag açık + doğrulanmamış kullanıcı → 403 EMAIL_NOT_VERIFIED', async () => {
    process.env.ENFORCE_EMAIL_VERIFICATION = 'true';
    // user1 default emailVerified=false
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', rating: 5, body: 'Harika yer' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(mockPrisma.review.upsert).not.toHaveBeenCalled();
  });

  it('flag açık + doğrulanmış kullanıcı → 201', async () => {
    process.env.ENFORCE_EMAIL_VERIFICATION = 'true';
    const verified = createTestUser({ id: 'verified-user', emailVerified: true });
    const vToken = createTestToken(verified.id);
    mockPrisma.user.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.id === verified.id ? verified : null));
    mockPrisma.review.findUnique.mockResolvedValue(null);
    mockPrisma.review.upsert.mockResolvedValue({ id: 'rv-new', userId: verified.id, placeId: 'p1', rating: 5, body: 'Harika yer' });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${vToken}`)
      .send({ placeId: 'p1', rating: 5, body: 'Harika yer' });

    expect(res.status).toBe(201);
    expect(mockPrisma.review.upsert).toHaveBeenCalled();
  });

  it('flag kapalı (default) + doğrulanmamış kullanıcı → 201 (no-op)', async () => {
    mockPrisma.review.findUnique.mockResolvedValue(null);
    mockPrisma.review.upsert.mockResolvedValue({ id: 'rv-x', userId: user1.id, placeId: 'p1', rating: 4, body: 'Güzel' });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', rating: 4, body: 'Güzel' });

    expect(res.status).toBe(201);
  });
});

// ─── PUT /api/reviews/:reviewId ───────────────────────────────────────────────

describe('PUT /api/reviews/:reviewId', () => {
  it('returns 200 when owner updates their review', async () => {
    const existingReview = { id: 'rv-1', userId: user1.id, placeId: 'p1', rating: 3, body: 'Orta' };
    mockPrisma.review.findUnique.mockResolvedValue(existingReview);
    mockPrisma.review.update.mockResolvedValue({ ...existingReview, rating: 5, body: 'Harika!' });

    const res = await request(app)
      .put('/api/reviews/rv-1')
      .set('Authorization', `Bearer ${token1}`)
      .send({ rating: 5, body: 'Harika!' });

    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(5);
    expect(res.body.body).toBe('Harika!');
  });

  it('returns 404 when review does not belong to the user', async () => {
    const otherReview = { id: 'rv-2', userId: user2.id, placeId: 'p1', rating: 4, body: 'İyi' };
    mockPrisma.review.findUnique.mockResolvedValue(otherReview);

    const res = await request(app)
      .put('/api/reviews/rv-2')
      .set('Authorization', `Bearer ${token1}`) // user1 tries to update user2's review
      .send({ rating: 1, body: 'Kötü' });

    expect(res.status).toBe(404);
  });

  it('returns 404 when review does not exist', async () => {
    mockPrisma.review.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/reviews/nonexistent')
      .set('Authorization', `Bearer ${token1}`)
      .send({ rating: 3, body: 'Test' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when updated body contains offensive content', async () => {
    const existingReview = { id: 'rv-3', userId: user1.id, placeId: 'p1', rating: 3, body: 'Normal' };
    mockPrisma.review.findUnique.mockResolvedValue(existingReview);

    const res = await request(app)
      .put('/api/reviews/rv-3')
      .set('Authorization', `Bearer ${token1}`)
      .send({ body: 'Bu yer siktir et yahu' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uygunsuz/i);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).put('/api/reviews/rv-1').send({ rating: 4, body: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/reviews/:reviewId ───────────────────────────────────────────

describe('DELETE /api/reviews/:reviewId', () => {
  it('returns 200 when owner deletes their review', async () => {
    const review = { id: 'rv-10', userId: user1.id, placeId: 'p2', rating: 4, body: 'Güzel' };
    mockPrisma.review.findUnique.mockResolvedValue(review);
    mockPrisma.review.delete.mockResolvedValue(review);

    const res = await request(app)
      .delete('/api/reviews/rv-10')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('returns 404 when review belongs to another user', async () => {
    const otherReview = { id: 'rv-11', userId: user2.id, placeId: 'p2', rating: 4, body: 'Güzel' };
    mockPrisma.review.findUnique.mockResolvedValue(otherReview);

    const res = await request(app)
      .delete('/api/reviews/rv-11')
      .set('Authorization', `Bearer ${token1}`); // user1 tries to delete user2's review

    expect(res.status).toBe(404);
  });

  it('returns 404 when review does not exist', async () => {
    mockPrisma.review.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/reviews/nonexistent')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/reviews/rv-10');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/reviews — content filter ──────────────────────────────────────

describe('POST /api/reviews — content filter', () => {
  it('returns 400 CONTENT_POLICY when body contains Turkish profanity', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', rating: 1, body: 'Bu yer tam bir siktir yeridir' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uygunsuz/i);
  });

  it('returns 400 when body contains English profanity', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', rating: 1, body: 'This place is fucking terrible' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when body contains uppercase profanity', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', rating: 1, body: 'FUCK this restaurant' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when body contains leetspeak profanity', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', rating: 1, body: 's1kt1r et bu yeri' });

    expect(res.status).toBe(400);
  });

  it('returns 201 when body is clean', async () => {
    mockPrisma.review.findUnique.mockResolvedValue(null); // no existing review
    mockPrisma.review.upsert.mockResolvedValue({
      id: 'rv-new',
      userId: user1.id,
      placeId: 'p1',
      rating: 5,
      body: 'Mükemmel lezzetler!',
      user: { displayName: 'Alice', photoUrl: null },
    });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', placeName: 'Güzel Yer', rating: 5, body: 'Mükemmel lezzetler!' });

    expect(res.status).toBe(201);
  });
});

// ─── POST /api/messages/:userId — content filter + length ────────────────────

describe('POST /api/messages/:userId — extended validation', () => {
  it('returns 400 when message exceeds 2000 characters', async () => {
    const longMessage = 'A'.repeat(2001);

    const res = await request(app)
      .post(`/api/messages/${user2.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ content: longMessage });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2000/);
  });

  it('accepts message of exactly 2000 characters', async () => {
    const maxMessage = 'A'.repeat(2000);
    mockPrisma.friendRequest.findFirst.mockResolvedValue({
      id: 'fr-1', fromUserId: user1.id, toUserId: user2.id, status: 'ACCEPTED',
    });
    mockPrisma.message.create.mockResolvedValue({
      id: 'msg-1',
      fromUserId: user1.id,
      toUserId: user2.id,
      content: maxMessage,
      read: false,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/messages/${user2.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ content: maxMessage });

    expect(res.status).toBe(201);
  });

  it('returns 400 when message contains Turkish profanity', async () => {
    const res = await request(app)
      .post(`/api/messages/${user2.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ content: 'siktir git' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uygunsuz/i);
  });

  it('returns 400 when message contains English profanity', async () => {
    const res = await request(app)
      .post(`/api/messages/${user2.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ content: 'you are a bastard' });

    expect(res.status).toBe(400);
  });
});

// ─── S14-B6: GET /api/reviews/:placeId cursor pagination ──────────────────────

describe('GET /api/reviews/:placeId — sayfalama (S14-B6)', () => {
  function mkReviews(n) {
    return Array.from({ length: n }, (_, i) => ({
      id: `rev-${i}`, placeId: 'p1', rating: 5, body: `yorum ${i}`,
      createdAt: new Date(Date.now() - i * 1000), user: { displayName: 'U', photoUrl: null }, reply: null,
    }));
  }

  it('parametresiz → geriye uyumlu DÜZ DİZİ döner', async () => {
    mockPrisma.review.findMany.mockResolvedValue(mkReviews(2));
    const res = await request(app).get('/api/reviews/p1').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('?limit=2 → { reviews, hasMore, nextCursor } ve hasMore=true', async () => {
    // limit+1=3 satır döndür → hasMore true, son sayfa öğesi rev-1
    mockPrisma.review.findMany.mockResolvedValue(mkReviews(3));
    const res = await request(app).get('/api/reviews/p1?limit=2').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(false);
    expect(res.body.reviews).toHaveLength(2);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBe('rev-1');
  });

  it('?cursor=X → prisma cursor+skip ile çağrılır', async () => {
    mockPrisma.review.findMany.mockResolvedValue(mkReviews(1));
    const res = await request(app).get('/api/reviews/p1?cursor=rev-5&limit=10').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(false);
    expect(mockPrisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'rev-5' }, skip: 1, take: 11 }),
    );
  });
});

// ─── S18-3: yorum yıldızı doğrulanmış ziyaret şartı (farming önleme) ───────────
describe('POST /api/reviews — yıldız ödülü doğrulanmış ziyaret şartı (S18-3)', () => {
  beforeEach(() => {
    mockPrisma.review.findUnique.mockResolvedValue(null); // yeni yorum
    mockPrisma.review.upsert.mockResolvedValue({ id: 'rv-1', userId: user1.id, placeId: 'p1', rating: 5, body: 'Harika yer' });
    mockPrisma.starEvent.count.mockResolvedValue(0); // günlük tavan altında
  });

  it('doğrulanmış ziyaret YOK → yorum 201 ama yıldız verilmez (starEvent null)', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue(null);
    mockPrisma.reservation.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', rating: 5, body: 'Harika yer' });

    expect(res.status).toBe(201);
    expect(res.body.review).toBeDefined();
    expect(res.body.starEvent).toBeNull();
    expect(res.body.newStarCount).toBeNull();
  });

  it('check-in ile doğrulanmış ziyaret VAR → yorum 201 + yıldız verilir', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue({ id: 'c1' });
    mockPrisma.reservation.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token1}`)
      .send({ placeId: 'p1', rating: 5, body: 'Harika yer' });

    expect(res.status).toBe(201);
    expect(res.body.starEvent).not.toBeNull();
    expect(res.body.newStarCount).toBe(5);
  });
});
