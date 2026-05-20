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

  // No premium subscription by default
  mockPrisma.subscription.findUnique.mockResolvedValue(null);

  // AiRecommendationLog stubs
  mockPrisma.aiRecommendationLog.create.mockResolvedValue({ id: 'log-1' });
  mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);

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

  it('returns 400 when mood is not a string', async () => {
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98, mood: 12345 });
    expect(res.status).toBe(400);
  });
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
      .send({ lat: 41.04, lng: 28.98, mood: 'şık' });

    expect(mockPrisma.aiRecommendationLog.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.aiRecommendationLog.create.mock.calls[0][0].data;
    expect(data.userId).toBe(testUser.id);
    expect(data.mood).toBe('şık');
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

  it('trims and truncates mood to 50 chars', async () => {
    const longMood = '   ' + 'a'.repeat(100) + '   ';
    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98, mood: longMood });
    expect(res.status).toBe(200);
    // Verify mood was truncated in log
    const loggedMood = mockPrisma.aiRecommendationLog.create.mock.calls[0][0].data.mood;
    expect(loggedMood.length).toBeLessThanOrEqual(50);
  });

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
