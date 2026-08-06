'use strict';

/**
 * Sprint-2 Task #2 — AI recommendation endpoint latency benchmark.
 *
 * Hedef: p95 < 5000ms (Sprint-1 retro AC).
 *
 * Bu benchmark mock'larla çalışır — gerçek Anthropic API çağrısı YOK.
 * Anthropic mock'una sentetik gecikme ekleyerek (250ms) prod LLM cevap
 * süresini taklit eder. Google Places ise cache pattern'ı korunduğu için
 * gerçekte de <1sn (issue #25 fast mode); burada da instant döner.
 *
 * Ne ölçtüğümüz:
 *   - app handler + middleware + auth + candidateService + promptBuilder +
 *     LLM round-trip (simüle) + JSON parse + halüsinasyon filter + response
 *   - Audit log artık fire-and-forget olduğu için latency'e EKLENMİYOR
 *     (Task #2'nin ana kazanımı buradan ölçülür)
 *
 * Mock'lu hedefimiz prod hedefinin altında olmalı — çünkü prod'da DB,
 * network ve real LLM gecikmesi var. Bu test sadece kod path'inin
 * kendi gerçek bottleneck olmadığını doğrular.
 */

const request = require('supertest');
const { createTestToken, createTestUser, mockAnthropicResponse } = require('../helpers');

// ─── Mocks ───────────────────────────────────────────────────────────────────

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
  recommendationFeedback: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
  feedbackPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  searchHistory: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), deleteMany: jest.fn() },
  friendRequest: { findMany: jest.fn() },
  collectionItem: { findMany: jest.fn().mockResolvedValue([]) },
  restaurantProfile: { findMany: jest.fn().mockResolvedValue([]) },
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

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

// Simulated LLM latency (Haiku 4.5 prod typical ~200-400ms)
const SIMULATED_LLM_LATENCY_MS = 250;

// ─── Test state ──────────────────────────────────────────────────────────────

let testUser;
let userToken;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

  testUser = createTestUser({
    id: 'perf-user-1',
    email: 'perf@test.com',
    displayName: 'Perf Tester',
    role: 'USER',
    isSuspended: false,
    favoriteCuisines: ['Türk'],
    starCount: 5,
  });
  userToken = createTestToken(testUser.id);

  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === testUser.id) return Promise.resolve(testUser);
    return Promise.resolve(null);
  });

  mockPrisma.favorite.findMany.mockResolvedValue([]);
  mockPrisma.review.findMany.mockResolvedValue([]);
  mockPrisma.starEvent.findMany.mockResolvedValue([]);
  mockPrisma.recommendation.findMany.mockResolvedValue([]);
  mockPrisma.friendRequest.findMany.mockResolvedValue([]);
  mockPrisma.subscription.findUnique.mockResolvedValue(null);
  mockPrisma.aiRecommendationLog.count.mockResolvedValue(0);
  mockPrisma.userLog.create.mockResolvedValue({});

  // Simulated audit log latency — but fire-and-forget so this should
  // NOT affect endpoint latency. If it does, Task #2 has regressed.
  mockPrisma.aiRecommendationLog.create.mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve({ id: 'log-1' }), 300))
  );

  mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
    makePlace(1, { types: ['restaurant', 'italian_restaurant'] }),
    makePlace(2, { types: ['restaurant', 'cafe'] }),
    makePlace(3, { types: ['restaurant'] }),
    makePlace(4, { types: ['restaurant'] }),
    makePlace(5, { types: ['restaurant'] }),
  ]);

  // Anthropic mock with simulated LLM latency
  mockAnthropicCreate.mockImplementation(
    () => new Promise((resolve) =>
      setTimeout(
        () => resolve(mockAnthropicResponse({
          recommendations: [
            { placeId: 'p1', reason: 'İtalyan tarzı seven biri için ideal.' },
            { placeId: 'p2', reason: 'Cafe atmosferi yakın ve rahat.' },
          ],
        })),
        SIMULATED_LLM_LATENCY_MS
      )
    )
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// LATENCY BENCHMARK
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/recommendations/dinner-tonight — latency benchmark', () => {
  // Premium user — daily limit'e takılmadan N defa çağırabilelim
  beforeEach(() => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: testUser.id,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  it('p95 < 5000ms over 10 sequential calls (mocked LLM 250ms)', async () => {
    const N = 10;
    const latencies = [];

    for (let i = 0; i < N; i++) {
      const t0 = Date.now();
      const res = await request(app)
        .post('/api/recommendations/dinner-tonight')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ lat: 41.04, lng: 28.98, mood: 'şık' });
      const elapsed = Date.now() - t0;

      expect(res.status).toBe(200);
      latencies.push(elapsed);
    }

    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const max = Math.max(...latencies);
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

    console.log(
      `[perf] N=${N} avg=${avg}ms p50=${p50}ms p95=${p95}ms max=${max}ms ` +
      `(simulated LLM=${SIMULATED_LLM_LATENCY_MS}ms)`
    );

    expect(p95).toBeLessThan(5000);
  }, 60_000);

  it('audit log is fire-and-forget — endpoint returns before DB write resolves', async () => {
    // Deterministik (duvar-saati eşiği YOK → CPU rekabetinde flake yok): audit yazımı
    // kasıtlı yavaş (3sn) ve resolve olunca işaretlenir. Endpoint audit'i await ETSEYDİ
    // yanıt ancak auditResolved=true iken gelirdi; fire-and-forget ise yanıt audit hâlâ
    // beklemedeyken döner. 3sn marj, baz çizgi (~250ms) yük altında şişse bile güvenli.
    let auditResolved = false;
    let auditTimer;
    mockPrisma.aiRecommendationLog.create.mockImplementation(
      () => new Promise((resolve) => {
        auditTimer = setTimeout(() => { auditResolved = true; resolve({ id: 'slow-log' }); }, 3000);
      })
    );

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
    // Yanıt geldiğinde audit yazımı HENÜZ resolve olmamış olmalı (await edilmedi).
    expect(auditResolved).toBe(false);

    clearTimeout(auditTimer); // açık handle bırakma (resolve olmayan promise zararsız → GC)
  }, 10_000);

  it('audit log write failure does not break the response', async () => {
    mockPrisma.aiRecommendationLog.create.mockRejectedValue(
      new Error('simulated DB outage')
    );

    const res = await request(app)
      .post('/api/recommendations/dinner-tonight')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ lat: 41.04, lng: 28.98 });

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(2);
  });
});
