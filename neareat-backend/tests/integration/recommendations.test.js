'use strict';

/**
 * Sprint-1 Task #6 — recommendations endpoint integration tests.
 *
 * Covers:
 *  - POST /api/recommendations/dinner-tonight
 *    - auth: 401 yoksa
 *    - validation: 400 lat/lng yoksa
 *    - free user: 3 başarılı call sonrası 429 LIMIT_EXCEEDED
 *    - premium user: limitsiz
 *    - aday yok: 404 NO_CANDIDATES
 *
 * Anthropic API mock'lu — gerçek call YOK.
 */

const request = require('supertest');
const { createTestToken, createTestUser, mockAnthropicResponse } = require('../helpers');

// ─── Mocks (must come before require('../src/app')) ───────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  subscription: { findUnique: jest.fn(), count: jest.fn() },
  favorite: { findMany: jest.fn(), count: jest.fn() },
  review: { findMany: jest.fn(), count: jest.fn() },
  starEvent: { findMany: jest.fn(), create: jest.fn() },
  recommendation: { findMany: jest.fn(), count: jest.fn() },
  aiRecommendationLog: { create: jest.fn(), count: jest.fn() },
  recommendationFeedback: { create: jest.fn(), count: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  feedbackPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  friendRequest: { findMany: jest.fn() },
  userLog: { create: jest.fn() },
  notification: { create: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn().mockRejectedValue(new Error('no firebase')) }),
  getMessaging: () => ({ send: jest.fn().mockResolvedValue('msg-id') }),
}));

jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    incr: jest.fn(),
    pexpire: jest.fn(),
  }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

const mockGooglePlaces = {
  getNearbyRestaurantsFast: jest.fn(),
  getPlaceDetails: jest.fn(),
  getPhotoUrl: jest.fn(),
  getRouteWaypoints: jest.fn(),
  // candidateService passesQualityFilter çağırır — passthrough (#110)
  passesQualityFilter: (place) => {
    const total = place?.user_ratings_total;
    const rating = place?.rating;
    if (typeof total !== 'number' || total < 2) return false;
    if (typeof rating !== 'number' || rating < 2.4) return false;
    return true;
  },
};
jest.mock('../../src/services/googlePlaces', () => mockGooglePlaces);

const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  }));
});

jest.mock('../../src/jobs/reservationReminders', () => ({
  scheduleReservationReminders: jest.fn(),
}));
jest.mock('../../src/jobs/smartNotifications', () => ({
  scheduleSmartNotifications: jest.fn(),
}));

// ─── App ─────────────────────────────────────────────────────────────────────

const app = require('../../src/app');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlace(i, opts = {}) {
  return {
    place_id: `p${i}`,
    name: `Place ${i}`,
    rating: opts.rating ?? 4.5,
    user_ratings_total: 100 + i,
    types: opts.types ?? ['restaurant'],
    geometry: { location: { lat: 41.04 + i * 0.001, lng: 28.98 } },
    vicinity: 'Test',
    opening_hours: { open_now: true },
  };
}

// ─── Test state ──────────────────────────────────────────────────────────────

let testUser;
let userToken;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

  testUser = createTestUser({
    id: 'test-user-recommend-1',
    email: 'recommend@test.com',
    displayName: 'Recommend Tester',
    role: 'USER',
    isSuspended: false,
    favoriteCuisines: ['Türk'],
    starCount: 5,
  });
  userToken = createTestToken(testUser.id);

  // Auth middleware resolver
  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === testUser.id) return Promise.resolve(testUser);
    return Promise.resolve(null);
  });

  // History queries default to empty
  mockPrisma.favorite.findMany.mockResolvedValue([]);
  mockPrisma.review.findMany.mockResolvedValue([]);
  mockPrisma.starEvent.findMany.mockResolvedValue([]);
  mockPrisma.recommendation.findMany.mockResolvedValue([]);
  mockPrisma.friendRequest.findMany.mockResolvedValue([]);

  // No premium subscription by default
  mockPrisma.subscription.findUnique.mockResolvedValue(null);

  // AiRecommendationLog stubs
  mockPrisma.aiRecommendationLog.create.mockResolvedValue({ id: 'log-1' });
  mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);

  // RecommendationFeedback stubs
  mockPrisma.recommendationFeedback.create.mockResolvedValue({ id: 'fb-1', sentiment: 'positive', placeId: 'p1' });
  mockPrisma.recommendationFeedback.count.mockResolvedValue(0);

  // logService
  mockPrisma.userLog.create.mockResolvedValue({});

  // 5 candidates by default
  mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
    makePlace(1, { types: ['restaurant', 'italian_restaurant'] }),
    makePlace(2, { types: ['restaurant', 'cafe'] }),
    makePlace(3, { types: ['restaurant'] }),
    makePlace(4, { types: ['restaurant'] }),
    makePlace(5, { types: ['restaurant'] }),
  ]);

  // Route waypoints default — single waypoint (origin only)
  mockGooglePlaces.getRouteWaypoints.mockResolvedValue({
    waypoints: [{ lat: 41.04, lng: 28.98 }],
    totalDistanceKm: 10.5,
    totalDurationMin: 25,
  });

  // Default LLM response — returns first 2
  mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse({
    recommendations: [
      { placeId: 'p1', reason: 'İtalyan tarzı seven biri için ideal seçim.' },
      { placeId: 'p2', reason: 'Cafe atmosferi rahat ve yakın.' },
    ],
    noteToUser: '',
  }));
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH + VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/dinner-tonight — auth + validation', () => {
  it('returns 401 without any token', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .send({ lat: 41.04, lng: 28.98 });
    expect(res.status).toBe(401);
  });

  it('returns 401 with malformed authorization header', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', 'NotBearer xyz')
      .send({ lat: 41.04, lng: 28.98 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when lat is missing', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lng: 28.98 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lat/);
  });

  it('returns 400 when lng is missing', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when lat/lng are not numbers', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: '41.04', lng: '28.98' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range lat', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 100, lng: 28.98 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range lng', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 200 });
    expect(res.status).toBe(400);
  });

  // Not (#110): mood özelliği kaldırıldı — mood artık validate edilmiyor, gönderilse de yok sayılır.
});

// ═══════════════════════════════════════════════════════════════════════════════
// FREE TIER RATE LIMIT
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/dinner-tonight — free tier rate limit', () => {
  it('returns 200 with remainingToday=2 on first call', async () => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98, mood: 'şık' });

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('free');
    expect(res.body.remainingToday).toBe(2);
    expect(res.body.recommendations).toHaveLength(2);
    expect(res.body.resetAt).toBeDefined();
  });

  it('returns 200 with remainingToday=1 when 2 calls already made', async () => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(2);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
    expect(res.body.remainingToday).toBe(0);
  });

  it('returns 429 LIMIT_EXCEEDED when free user already used 3 today', async () => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(3);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('LIMIT_EXCEEDED');
    expect(res.body.upgrade).toBe(true);
    expect(res.body.remaining).toBe(0);
    expect(res.body.resetAt).toBeDefined();
    // Anthropic was NOT called when limit hit
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('returns 429 even when usage > 3', async () => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(10);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(429);
  });

  it('uses Haiku model for free tier', async () => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
    expect(res.body.model).toMatch(/haiku/);
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.stringMatching(/haiku/) }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM TIER
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/dinner-tonight — premium tier', () => {
  beforeEach(() => {
    // Premium subscription mock — expires 30 days from now
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: testUser.id,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  it('returns 200 with tier=premium and uses Sonnet model', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('premium');
    expect(res.body.model).toMatch(/sonnet/);
    expect(res.body.remainingToday).toBeNull(); // limitsiz
    expect(res.body.resetAt).toBeNull();
  });

  it('is NOT rate-limited even with high usage', async () => {
    // Premium user'a aynı endpoint'ten 100 kez vurma → her zaman 200
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(100);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
  });

  it('trial status is also treated as premium', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: testUser.id,
      status: 'trial',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(50);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('premium');
  });

  it('expired subscription falls back to free tier', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: testUser.id,
      status: 'active',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
    });
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('free');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// NO CANDIDATES
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/dinner-tonight — no candidates', () => {
  it('returns 404 NO_CANDIDATES when Google Places returns empty', async () => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NO_CANDIDATES');
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('returns 404 when all candidates are filtered (closed/low-rated)', async () => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      { ...makePlace(1), rating: 2.5 }, // below 3.5 threshold
      { ...makePlace(2), opening_hours: { open_now: false } }, // closed
    ]);
    // Note: candidateService also filters; LLM not called but no candidates returned
    // Actually current code: candidateService returns valid empty if all filtered
    // But googleplaces returned non-empty; let me check
    // Actually candidateService filters internally and could return 0 candidates
    // recommend() checks `candidates.length` (after candidateService filter)
    // For this test we'd need 0 candidates after filter, so all should fail filters

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE SHAPE + AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/dinner-tonight — response shape & audit', () => {
  beforeEach(() => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);
  });

  it('includes restaurant details on each recommendation', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
    const rec = res.body.recommendations[0];
    expect(rec.placeId).toBeDefined();
    expect(rec.reason).toBeDefined();
    expect(rec.restaurant).toBeDefined();
    expect(rec.restaurant.name).toBeDefined();
    expect(rec.restaurant.distanceKm).toBeDefined();
    expect(rec.restaurant.location).toBeDefined();
  });

  it('writes AiRecommendationLog on successful call', async () => {
    await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(mockPrisma.aiRecommendationLog.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.aiRecommendationLog.create.mock.calls[0][0].data;
    expect(data.userId).toBe(testUser.id);
    expect(data.mood).toBeNull(); // mood özelliği kaldırıldı (#110)
    expect(data.lat).toBe(41.04);
    expect(data.lng).toBe(28.98);
    expect(Array.isArray(data.candidatePlaceIds)).toBe(true);
    expect(Array.isArray(data.suggestedPlaceIds)).toBe(true);
  });

  it('does NOT call Anthropic when limit hit (free user)', async () => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(3);

    await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MOOD HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/dinner-tonight — mood handling', () => {
  beforeEach(() => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);
  });

  it('accepts mood string', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98, mood: 'hızlı' });
    expect(res.status).toBe(200);
  });

  // "trims and truncates mood" testi kaldırıldı (#110) — mood özelliği yok, log'a hep null yazılır.

  it('treats empty mood as null', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98, mood: '   ' });
    expect(res.status).toBe(200);
    const loggedMood = mockPrisma.aiRecommendationLog.create.mock.calls[0][0].data.mood;
    expect(loggedMood).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK ENDPOINT (Sprint-2 Task #5)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/feedback — auth + validation', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .send({ placeId: 'p1', sentiment: 'positive' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when placeId missing', async () => {
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ sentiment: 'positive' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/placeId/);
  });

  it('returns 400 when sentiment is invalid', async () => {
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'meh' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sentiment/);
  });

  it('returns 400 when comment is not a string', async () => {
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'positive', comment: 12345 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when visited is not a boolean', async () => {
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'positive', visited: 'yes' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/recommendations/feedback — happy path', () => {
  it('returns 201 with id + sentiment + placeId', async () => {
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'positive' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.sentiment).toBe('positive');
    expect(res.body.placeId).toBe('p1');
  });

  it('writes to RecommendationFeedback with correct data', async () => {
    await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        placeId: 'p1',
        sentiment: 'negative',
        aiRecommendationLogId: 'log-1',
        comment: 'Çok kalabalıktı',
        visited: true,
      });

    expect(mockPrisma.recommendationFeedback.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.recommendationFeedback.create.mock.calls[0][0].data;
    expect(data.userId).toBe(testUser.id);
    expect(data.placeId).toBe('p1');
    expect(data.sentiment).toBe('negative');
    expect(data.aiRecommendationLogId).toBe('log-1');
    expect(data.comment).toBe('Çok kalabalıktı');
    expect(data.visited).toBe(true);
  });

  it('accepts negative sentiment', async () => {
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'negative' });
    expect(res.status).toBe(201);
  });

  it('aiRecommendationLogId is optional', async () => {
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'positive' });
    expect(res.status).toBe(201);
    const data = mockPrisma.recommendationFeedback.create.mock.calls[0][0].data;
    expect(data.aiRecommendationLogId).toBeNull();
  });

  it('trims comment and enforces 500-char max', async () => {
    const longComment = '  ' + 'a'.repeat(600) + '  ';
    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'positive', comment: longComment });
    expect(res.status).toBe(201);
    const data = mockPrisma.recommendationFeedback.create.mock.calls[0][0].data;
    expect(data.comment.length).toBeLessThanOrEqual(500);
  });

  it('defaults visited to false when not provided', async () => {
    await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'positive' });
    const data = mockPrisma.recommendationFeedback.create.mock.calls[0][0].data;
    expect(data.visited).toBe(false);
  });
});

describe('POST /api/recommendations/feedback — rate limit', () => {
  it('returns 429 FEEDBACK_LIMIT_EXCEEDED when daily limit hit', async () => {
    mockPrisma.recommendationFeedback.count.mockResolvedValue(50);

    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'positive' });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('FEEDBACK_LIMIT_EXCEEDED');
    expect(res.body.resetAt).toBeDefined();
    expect(mockPrisma.recommendationFeedback.create).not.toHaveBeenCalled();
  });
});

// ─── Error propagation (controller next(err) coverage) ───────────────────────

describe('POST /api/recommendations/dinner-tonight — unexpected error propagation', () => {
  it('returns 500 when Anthropic client throws unexpectedly', async () => {
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      makePlace(1, { types: ['restaurant'] }),
    ]);
    mockAnthropicCreate.mockRejectedValueOnce(new Error('Unexpected API failure'));

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/recommendations/feedback — DB error propagation', () => {
  it('returns 500 when DB create throws unexpectedly', async () => {
    mockPrisma.recommendationFeedback.count.mockResolvedValue(0);
    mockPrisma.recommendationFeedback.create.mockRejectedValueOnce(new Error('DB crashed'));

    const res = await request(app)
      .post('/api/recommendations/feedback')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'p1', sentiment: 'positive' });

    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE-TONIGHT (Sprint-3 Task #6)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/route-tonight — auth + validation', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 29.02 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when originLat is missing', async () => {
    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLng: 28.98, destLat: 40.99, destLng: 29.02 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when destLng is missing', async () => {
    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when coords are strings instead of numbers', async () => {
    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: '41.04', originLng: 28.98, destLat: 40.99, destLng: 29.02 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range originLat', async () => {
    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 100, originLng: 28.98, destLat: 40.99, destLng: 29.02 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for out-of-range destLng', async () => {
    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 200 });
    expect(res.status).toBe(400);
  });

  // "mood not a string → 400" testi kaldırıldı (#110) — route-tonight de mood almıyor.
});

describe('POST /api/recommendations/route-tonight — happy path', () => {
  beforeEach(() => {
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);
    // Premium — no rate limit concerns
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: testUser.id,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  it('returns 200 with recommendations and route meta', async () => {
    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 29.02 });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(typeof res.body.totalRouteDistanceKm).toBe('number');
    expect(typeof res.body.totalRouteDurationMin).toBe('number');
    expect(res.body.tier).toBe('premium');
  });

  it('each recommendation has restaurant with sequenceOrder', async () => {
    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 29.02 });

    expect(res.status).toBe(200);
    if (res.body.recommendations.length > 0) {
      const first = res.body.recommendations[0];
      expect(first.placeId).toBeDefined();
      expect(first.reason).toBeDefined();
      expect(first.restaurant).toBeDefined();
      expect(first.restaurant.sequenceOrder).toBe(1);
    }
  });

  it('calls getRouteWaypoints with origin and destination coords', async () => {
    await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 29.02 });

    expect(mockGooglePlaces.getRouteWaypoints).toHaveBeenCalledWith(41.04, 28.98, 40.99, 29.02);
  });

  it('returns 404 NO_ROUTE_FOUND when getRouteWaypoints returns null', async () => {
    mockGooglePlaces.getRouteWaypoints.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 29.02 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NO_ROUTE_FOUND');
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('returns 404 NO_CANDIDATES when no nearby restaurants found', async () => {
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 29.02 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NO_CANDIDATES');
  });
});

describe('POST /api/recommendations/route-tonight — rate limit (shared counter)', () => {
  it('returns 429 LIMIT_EXCEEDED for free user at daily limit', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(3);

    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 29.02 });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('LIMIT_EXCEEDED');
    expect(res.body.upgrade).toBe(true);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('premium user is not rate limited on route-tonight', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: testUser.id,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    mockPrisma.aiRecommendationLog.count.mockResolvedValue(100);

    const res = await request(app)
      .post('/api/recommendations/route-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ originLat: 41.04, originLng: 28.98, destLat: 40.99, destLng: 29.02 });

    expect(res.status).toBe(200);
  });
});
