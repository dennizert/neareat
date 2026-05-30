'use strict';

/**
 * Sprint-1 Task #6 — recommendationService unit tests.
 * AC: parseLlmJson defensive, modelForTier, summarizeUsage, halüsinasyon filtresi.
 *
 * Anthropic API mock'lu — gerçek call yok.
 */

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  favorite: { findMany: jest.fn() },
  review: { findMany: jest.fn() },
  starEvent: { findMany: jest.fn() },
  recommendation: { findMany: jest.fn() },
  friendRequest: { findMany: jest.fn() },
  recommendationFeedback: { findMany: jest.fn().mockResolvedValue([]) },
  feedbackPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  searchHistory: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), deleteMany: jest.fn() },
  aiRecommendationLog: { create: jest.fn(), count: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const mockGooglePlaces = {
  getNearbyRestaurantsFast: jest.fn(),
  // candidateService passesQualityFilter çağırır — mock'ta passthrough
  passesQualityFilter: (place) => {
    const total = place?.user_ratings_total;
    const rating = place?.rating;
    if (typeof total !== 'number' || total < 2) return false;
    if (typeof rating !== 'number' || rating < 2.4) return false;
    return true;
  },
};
jest.mock('../../../src/services/googlePlaces', () => mockGooglePlaces);

// Redis mock — buildFriendSignals (promptBuilder) gerçek ioredis client'ı
// açmasın; aksi halde test bitince "Cannot log after tests are done" uyarısı.
const mockRedis = {
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../../src/services/redis', () => mockRedis);

// Anthropic SDK mock
const mockAnthropicCreate = jest.fn();
const mockAnthropicStream = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate, stream: mockAnthropicStream },
  }));
});

// recommendationSession mock — oturum bağlamını test içinden kontrol et
const mockSession = {
  newSessionId: jest.fn(() => 'new-sid'),
  getSession: jest.fn().mockResolvedValue(null),
  saveSession: jest.fn().mockResolvedValue(undefined),
  clearSession: jest.fn().mockResolvedValue(undefined),
  MAX_REFINEMENTS: 10,
};
jest.mock('../../../src/services/recommendationSession', () => mockSession);

const { mockAnthropicResponse } = require('../../helpers');
const {
  MODELS,
  modelForTier,
  summarizeUsage,
  recommend,
  recommendStream,
  __test: { parseLlmJson, enforceZoneDiversity },
} = require('../../../src/services/recommendationService');

/** messages.stream() dönüşünü simüle eder: finalMessage + abort. */
function mockStreamResolving(response) {
  mockAnthropicStream.mockReturnValue({
    abort: jest.fn(),
    finalMessage: jest.fn().mockResolvedValue(response),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

describe('parseLlmJson', () => {
  it('parses clean JSON', () => {
    const r = parseLlmJson('{"recommendations":[]}');
    expect(r).toEqual({ recommendations: [] });
  });

  it('strips markdown code fence', () => {
    const r = parseLlmJson('```json\n{"recommendations":[{"placeId":"p1"}]}\n```');
    expect(r.recommendations[0].placeId).toBe('p1');
  });

  it('strips plain code fence', () => {
    const r = parseLlmJson('```\n{"x":1}\n```');
    expect(r).toEqual({ x: 1 });
  });

  it('handles preamble before JSON', () => {
    const r = parseLlmJson('Here are the recommendations:\n{"recommendations":[]}');
    expect(r).toEqual({ recommendations: [] });
  });

  it('handles postamble after JSON', () => {
    const r = parseLlmJson('{"recommendations":[]}\nThanks!');
    expect(r).toEqual({ recommendations: [] });
  });

  it('returns null for invalid JSON', () => {
    expect(parseLlmJson('not json at all')).toBeNull();
    expect(parseLlmJson('{ broken json')).toBeNull();
    expect(parseLlmJson('')).toBeNull();
    expect(parseLlmJson(null)).toBeNull();
    expect(parseLlmJson(undefined)).toBeNull();
  });

  it('returns null when no braces found', () => {
    expect(parseLlmJson('just plain text')).toBeNull();
  });

  it('returns null for text with braces but invalid JSON content (catch branch)', () => {
    // Has { and } but content between them isn't valid JSON
    expect(parseLlmJson('{invalid: syntax}')).toBeNull();
    expect(parseLlmJson('{key: value, another: thing}')).toBeNull();
  });
});

describe('modelForTier', () => {
  it('returns Haiku for free', () => {
    expect(modelForTier('free')).toBe(MODELS.free);
  });

  it('returns Sonnet for premium', () => {
    expect(modelForTier('premium')).toBe(MODELS.premium);
  });

  it('falls back to Haiku for unknown tier', () => {
    expect(modelForTier(undefined)).toBe(MODELS.free);
    expect(modelForTier(null)).toBe(MODELS.free);
    expect(modelForTier('enterprise')).toBe(MODELS.free);
  });
});

describe('summarizeUsage', () => {
  it('computes cost for Haiku without cache', () => {
    const s = summarizeUsage(MODELS.free, {
      input_tokens: 1000,
      output_tokens: 500,
    });
    expect(s.inputTokens).toBe(1000);
    expect(s.outputTokens).toBe(500);
    expect(s.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('cache read is cheaper than uncached input (0.1x)', () => {
    const uncached = summarizeUsage(MODELS.free, { input_tokens: 5000, output_tokens: 0 });
    const cached = summarizeUsage(MODELS.free, { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 5000 });
    expect(cached.estimatedCostUsd).toBeLessThan(uncached.estimatedCostUsd);
  });

  it('cache write costs 1.25x', () => {
    const uncached = summarizeUsage(MODELS.free, { input_tokens: 5000, output_tokens: 0 });
    const cacheWrite = summarizeUsage(MODELS.free, { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 5000 });
    expect(cacheWrite.estimatedCostUsd).toBeGreaterThan(uncached.estimatedCostUsd);
  });

  it('handles unknown model with 0 pricing', () => {
    const s = summarizeUsage('unknown-model', { input_tokens: 1000, output_tokens: 500 });
    expect(s.estimatedCostUsd).toBe(0);
  });

  it('handles missing usage fields', () => {
    const s = summarizeUsage(MODELS.free, {});
    expect(s.inputTokens).toBe(0);
    expect(s.outputTokens).toBe(0);
  });
});

describe('recommend (end-to-end with mocks)', () => {
  function setupBasicMocks() {
    mockPrisma.user.findUnique.mockResolvedValue({
      displayName: 'Test User',
      favoriteCuisines: ['Türk'],
      starCount: 5,
      city: 'İstanbul',
      bio: null,
    });
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.starEvent.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);
    mockPrisma.aiRecommendationLog.create.mockResolvedValue({ id: 'log-1' });
  }

  it('returns { noCandidates: true } when getNearbyRestaurants returns empty', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([]);

    const result = await recommend({
      userId: 'u1',
      location: { lat: 41, lng: 28.9 },
      isPremium: false,
    });
    expect(result.noCandidates).toBe(true);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('returns valid recommendations and writes AiRecommendationLog', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1',
        name: 'Test Place 1',
        rating: 4.5,
        user_ratings_total: 100,
        types: ['restaurant', 'italian_restaurant'],
        geometry: { location: { lat: 41.04, lng: 28.98 } },
        vicinity: 'Taksim',
        opening_hours: { open_now: true },
      },
      {
        place_id: 'p2',
        name: 'Test Place 2',
        rating: 4.3,
        user_ratings_total: 80,
        types: ['restaurant', 'cafe'],
        geometry: { location: { lat: 41.041, lng: 28.981 } },
        vicinity: 'Taksim',
        opening_hours: { open_now: true },
      },
    ]);

    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse({
      recommendations: [
        { placeId: 'p1', reason: 'İlk öneri gerekçesi.' },
        { placeId: 'p2', reason: 'İkinci öneri gerekçesi.' },
      ],
    }));

    const result = await recommend({
      userId: 'u1',
      location: { lat: 41.04, lng: 28.98 },
      mood: 'şık',
      isPremium: false,
    });

    expect(result.noCandidates).toBeUndefined();
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].placeId).toBe('p1');
    expect(result.recommendations[0].candidate.name).toBe('Test Place 1');
    expect(result.tier).toBe('free');
    expect(result.model).toBe(MODELS.free);

    // Log yazıldı
    expect(mockPrisma.aiRecommendationLog.create).toHaveBeenCalledTimes(1);
    const callArg = mockPrisma.aiRecommendationLog.create.mock.calls[0][0];
    expect(callArg.data.userId).toBe('u1');
    expect(callArg.data.model).toBe(MODELS.free);
    expect(callArg.data.candidatePlaceIds).toEqual(['p1', 'p2']);
    expect(callArg.data.suggestedPlaceIds).toEqual(['p1', 'p2']);
    expect(callArg.data.mood).toBeNull(); // mood feature kaldırıldı
    expect(callArg.data.lat).toBe(41.04);
    expect(callArg.data.lng).toBe(28.98);
  });

  it('premium tier uses Sonnet model', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1', name: 'X', rating: 4.5, user_ratings_total: 100, types: ['restaurant'],
        geometry: { location: { lat: 41, lng: 28.9 } },
      },
    ]);
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse({
      recommendations: [{ placeId: 'p1', reason: 'r' }],
      model: MODELS.premium,
    }));

    const result = await recommend({
      userId: 'u1',
      location: { lat: 41, lng: 28.9 },
      isPremium: true,
    });

    expect(result.tier).toBe('premium');
    expect(result.model).toBe(MODELS.premium);
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: MODELS.premium }),
    );
  });

  it('filters hallucinated placeIds (LLM returns id not in candidate list)', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'real-id-1',
        name: 'Real',
        rating: 4.5,
        user_ratings_total: 100,
        types: ['restaurant'],
        geometry: { location: { lat: 41, lng: 28.9 } },
      },
    ]);
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse({
      recommendations: [
        { placeId: 'real-id-1', reason: 'OK' },
        { placeId: 'HALLUCINATED-ID', reason: 'Not in list!' }, // should be filtered
      ],
    }));

    const result = await recommend({
      userId: 'u1',
      location: { lat: 41, lng: 28.9 },
      isPremium: false,
    });

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].placeId).toBe('real-id-1');
    // Log should reflect filtered
    expect(mockPrisma.aiRecommendationLog.create.mock.calls[0][0].data.suggestedPlaceIds)
      .toEqual(['real-id-1']);
  });

  it('filters duplicate placeIds returned by LLM', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1', name: 'X', rating: 4.5, user_ratings_total: 100, types: ['restaurant'],
        geometry: { location: { lat: 41, lng: 28.9 } },
      },
    ]);
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse({
      recommendations: [
        { placeId: 'p1', reason: 'first' },
        { placeId: 'p1', reason: 'duplicate' }, // dedupe
      ],
    }));

    const result = await recommend({
      userId: 'u1',
      location: { lat: 41, lng: 28.9 },
      isPremium: false,
    });
    expect(result.recommendations).toHaveLength(1);
  });

  it('survives audit log write failure (does not break recommendation flow)', async () => {
    setupBasicMocks();
    mockPrisma.aiRecommendationLog.create.mockRejectedValueOnce(new Error('DB down'));
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1', name: 'X', rating: 4.5, user_ratings_total: 100, types: ['restaurant'],
        geometry: { location: { lat: 41, lng: 28.9 } },
      },
    ]);
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse({
      recommendations: [{ placeId: 'p1', reason: 'OK' }],
    }));

    // Should not throw
    const result = await recommend({
      userId: 'u1',
      location: { lat: 41, lng: 28.9 },
      isPremium: false,
    });
    expect(result.recommendations).toHaveLength(1);
  });

  it('handles invalid LLM JSON gracefully (returns empty recs, still logs)', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1', name: 'X', rating: 4.5, user_ratings_total: 100, types: ['restaurant'],
        geometry: { location: { lat: 41, lng: 28.9 } },
      },
    ]);
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse({
      rawText: 'this is not json at all',
    }));

    const result = await recommend({
      userId: 'u1',
      location: { lat: 41, lng: 28.9 },
      isPremium: false,
    });
    expect(result.recommendations).toEqual([]);
    expect(mockPrisma.aiRecommendationLog.create).toHaveBeenCalled();
  });

  it('enriches error with context when Anthropic client throws', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1', name: 'X', rating: 4.5, user_ratings_total: 100, types: ['restaurant'],
        geometry: { location: { lat: 41, lng: 28.9 } },
      },
    ]);
    const apiError = new Error('Service unavailable');
    mockAnthropicCreate.mockRejectedValueOnce(apiError);

    await expect(
      recommend({ userId: 'u1', location: { lat: 41, lng: 28.9 }, isPremium: false })
    ).rejects.toThrow('Service unavailable');

    // Error should be enriched with context (userId, model, latencyMs)
    expect(apiError.context).toBeDefined();
    expect(apiError.context.userId).toBe('u1');
    expect(typeof apiError.context.latencyMs).toBe('number');
  });

  it('passes through cache_control markers to Anthropic API', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1', name: 'X', rating: 4.5, user_ratings_total: 100, types: ['restaurant'],
        geometry: { location: { lat: 41, lng: 28.9 } },
      },
    ]);
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse({
      recommendations: [{ placeId: 'p1', reason: 'r' }],
    }));

    await recommend({
      userId: 'u1',
      location: { lat: 41, lng: 28.9 },
      isPremium: false,
    });

    const callArgs = mockAnthropicCreate.mock.calls[0][0];
    expect(callArgs.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(callArgs.messages[0].content[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});

// ─── enforceZoneDiversity (uzun rota zone enforcement) ───────────────────────
describe('enforceZoneDiversity', () => {
  // xKm = 50 (yani 400 km'lik rota). 0.45x haversine eşiği = 22.5 km.
  const X = 50;

  function makeCand({ id, zone, score = 1, lat = 41.0, lng = 28.0, waypointIndex = 0 }) {
    return {
      placeId: id,
      name: `R-${id}`,
      score,
      zoneIndex: zone,
      waypointIndex,
      projectedKm: zone === 1 ? 130 : zone === 2 ? 200 : 270,
      location: { lat, lng },
    };
  }
  function makeRec(cand) {
    return {
      placeId: cand.placeId,
      reason: `LLM-reason-${cand.placeId}`,
      candidate: cand,
      waypointIndex: cand.waypointIndex,
    };
  }

  it('happy path: LLM picks 1 per zone → keeps all 3 unchanged', () => {
    const c1 = makeCand({ id: 'a', zone: 1, score: 5, lat: 40.5, lng: 28.0 });
    const c2 = makeCand({ id: 'b', zone: 2, score: 5, lat: 41.0, lng: 29.0 });
    const c3 = makeCand({ id: 'c', zone: 3, score: 5, lat: 41.5, lng: 30.0 });
    const result = enforceZoneDiversity(
      [makeRec(c1), makeRec(c2), makeRec(c3)],
      [c1, c2, c3],
      X,
    );
    expect(result.map((r) => r.placeId)).toEqual(['a', 'b', 'c']);
    expect(result[0].reason).toBe('LLM-reason-a'); // LLM gerekçesi korunur
  });

  it('LLM picks all 3 from same zone → swaps in best from missing zones', () => {
    // LLM 3 öneriyi de zone 2'den seçmiş; biz zone 1 ve 3'ten manuel pick eklemeliyiz.
    const z1 = makeCand({ id: 'a1', zone: 1, score: 4 });
    const z2top = makeCand({ id: 'b1', zone: 2, score: 9 });
    const z2second = makeCand({ id: 'b2', zone: 2, score: 8 });
    const z2third = makeCand({ id: 'b3', zone: 2, score: 7 });
    const z3 = makeCand({ id: 'c1', zone: 3, score: 5 });

    const llmPicks = [makeRec(z2top), makeRec(z2second), makeRec(z2third)];
    const allCandidates = [z1, z2top, z2second, z2third, z3];

    const result = enforceZoneDiversity(llmPicks, allCandidates, X);
    const ids = result.map((r) => r.placeId);

    // En iyi LLM picki zone 2'den korunur + zone 1 ve 3'ten manuel pick
    expect(ids).toContain('b1'); // zone 2 (LLM)
    expect(ids).toContain('a1'); // zone 1 (manual fallback)
    expect(ids).toContain('c1'); // zone 3 (manual fallback)
    expect(ids).toHaveLength(3);
    // Manuel pick'lerin reason'ı boş, LLM'in dolu
    const b1 = result.find((r) => r.placeId === 'b1');
    expect(b1.reason).toBe('LLM-reason-b1');
    const a1 = result.find((r) => r.placeId === 'a1');
    expect(a1.reason).toBe('');
  });

  it('empty zone 2: backfills from other zones with haversine ≥ 0.45x', () => {
    // Zone 2 boş; zone 1 ve 3'ten dağıtım yapılır
    const z1a = makeCand({ id: 'z1a', zone: 1, score: 5, lat: 40.5, lng: 28.0 });
    const z1b = makeCand({ id: 'z1b', zone: 1, score: 4, lat: 40.8, lng: 28.3 }); // ~37 km z1a'dan
    const z3 = makeCand({ id: 'z3', zone: 3, score: 5, lat: 42.0, lng: 30.0 });

    const llmPicks = [makeRec(z1a), makeRec(z3)];
    const allCandidates = [z1a, z1b, z3];

    const result = enforceZoneDiversity(llmPicks, allCandidates, X);
    const ids = result.map((r) => r.placeId);
    expect(ids).toContain('z1a');
    expect(ids).toContain('z3');
    expect(ids).toContain('z1b'); // backfill (haversine z1a→z1b ≈ 37 km ≥ 22.5 km ✓)
    expect(ids).toHaveLength(3);
  });

  it('skips backfill candidates that are too close (haversine < 0.45x)', () => {
    const z1a = makeCand({ id: 'z1a', zone: 1, score: 5, lat: 40.5, lng: 28.0 });
    const z1b = makeCand({ id: 'z1b', zone: 1, score: 4, lat: 40.51, lng: 28.01 }); // ~1.5 km
    const z3 = makeCand({ id: 'z3', zone: 3, score: 5, lat: 42.0, lng: 30.0 });

    const llmPicks = [makeRec(z1a), makeRec(z3)];
    const allCandidates = [z1a, z1b, z3];

    const result = enforceZoneDiversity(llmPicks, allCandidates, X);
    const ids = result.map((r) => r.placeId);
    expect(ids).toContain('z1a');
    expect(ids).toContain('z3');
    expect(ids).not.toContain('z1b'); // too close → atlanır
    expect(result).toHaveLength(2);   // 3'e ulaşamaz, başka aday yok
  });

  it('zone fully empty + LLM partial → manual fallback fills missing zone', () => {
    // LLM yalnızca zone 1'den seçmiş; zone 2 ve 3 doluda biz manuel ekleriz
    const z1 = makeCand({ id: 'z1', zone: 1, score: 5 });
    const z2 = makeCand({ id: 'z2', zone: 2, score: 4 });
    const z3 = makeCand({ id: 'z3', zone: 3, score: 3 });

    const llmPicks = [makeRec(z1)];
    const result = enforceZoneDiversity(llmPicks, [z1, z2, z3], X);
    expect(result.map((r) => r.placeId).sort()).toEqual(['z1', 'z2', 'z3']);
  });

  it('all zones empty → returns empty array', () => {
    const result = enforceZoneDiversity([], [], X);
    expect(result).toEqual([]);
  });
});

// ─── recommendStream — konuşmaya dayalı refinement (Sprint-4 Task #2) ─────────

describe('recommendStream — refinement & session', () => {
  const twoPlaces = [
    {
      place_id: 'p1', name: 'Place 1', rating: 4.5, user_ratings_total: 100,
      types: ['restaurant'], geometry: { location: { lat: 41.04, lng: 28.98 } },
      vicinity: 'Taksim', opening_hours: { open_now: true },
    },
    {
      place_id: 'p2', name: 'Place 2', rating: 4.3, user_ratings_total: 80,
      types: ['restaurant'], geometry: { location: { lat: 41.041, lng: 28.981 } },
      vicinity: 'Taksim', opening_hours: { open_now: true },
    },
  ];

  function setupProfileMocks() {
    mockPrisma.user.findUnique.mockResolvedValue({
      displayName: 'U', favoriteCuisines: [], starCount: 0, city: null, bio: null,
    });
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.starEvent.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);
    mockPrisma.aiRecommendationLog.create.mockResolvedValue({ id: 'log-1' });
  }

  function callStream(opts = {}) {
    const cards = [];
    return recommendStream({
      userId: 'u1',
      location: { lat: 41.04, lng: 28.98 },
      isPremium: false,
      onCard: (rec) => cards.push(rec),
      onNote: () => {},
      onDone: (meta) => { cards.done = meta; },
      ...opts,
    }).then(() => cards);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockSession.getSession.mockResolvedValue(null);
    mockSession.newSessionId.mockReturnValue('new-sid');
    setupProfileMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue(twoPlaces);
  });

  it('ilk çağrı: yeni sessionId üretir, onDone ile döndürür, oturumu kaydeder', async () => {
    mockStreamResolving(mockAnthropicResponse({
      recommendations: [{ placeId: 'p1', reason: 'r1' }],
    }));

    const cards = await callStream();

    expect(cards.done.sessionId).toBe('new-sid');
    expect(mockSession.saveSession).toHaveBeenCalledWith('new-sid', expect.objectContaining({
      userId: 'u1',
      suggestedPlaceIds: ['p1'],
      refinements: [],
    }));
  });

  it('refinement: önceki önerilen mekan aday listesinden çıkarılır (tekrar önerilmez)', async () => {
    // Oturum: p1 daha önce önerilmiş
    mockSession.getSession.mockResolvedValue({
      userId: 'u1', location: { lat: 41.04, lng: 28.98 },
      suggestedPlaceIds: ['p1'], refinements: ['daha ucuz'],
    });
    // LLM p1'i tekrar dönerse bile filtrelenmeli — ama aday listesinde p1 yok,
    // halüsinasyon filtresi onu eler. p2 geçerli.
    mockStreamResolving(mockAnthropicResponse({
      recommendations: [{ placeId: 'p1', reason: 'tekrar' }, { placeId: 'p2', reason: 'yeni' }],
    }));

    const cards = await callStream({ sessionId: 's1', refinement: 'daha sessiz' });

    const ids = cards.map((c) => c.placeId);
    expect(ids).toContain('p2');
    expect(ids).not.toContain('p1');
    // Audit log candidatePlaceIds p1 içermez
    const logArg = mockPrisma.aiRecommendationLog.create.mock.calls[0][0];
    expect(logArg.data.candidatePlaceIds).not.toContain('p1');
  });

  it('refinement: oturum bağlamı birikerek güncellenir', async () => {
    mockSession.getSession.mockResolvedValue({
      userId: 'u1', location: { lat: 41.04, lng: 28.98 },
      suggestedPlaceIds: ['p1'], refinements: ['daha ucuz'],
    });
    mockStreamResolving(mockAnthropicResponse({
      recommendations: [{ placeId: 'p2', reason: 'r' }],
    }));

    await callStream({ sessionId: 's1', refinement: 'daha sessiz' });

    expect(mockSession.saveSession).toHaveBeenCalledWith('s1', expect.objectContaining({
      suggestedPlaceIds: ['p1', 'p2'],
      refinements: ['daha ucuz', 'daha sessiz'],
    }));
  });

  it('başka kullanıcıya ait sessionId yok sayılır, yeni oturum başlar', async () => {
    mockSession.getSession.mockResolvedValue({
      userId: 'someone-else', suggestedPlaceIds: ['p1'], refinements: [],
    });
    mockStreamResolving(mockAnthropicResponse({
      recommendations: [{ placeId: 'p1', reason: 'r' }],
    }));

    const cards = await callStream({ sessionId: 's1' });

    // p1 hariç tutulmadı (foreign session ignore) → p1 önerilebildi
    expect(cards.map((c) => c.placeId)).toContain('p1');
    // Yeni sessionId üretildi
    expect(cards.done.sessionId).toBe('new-sid');
  });

  it('tüm adaylar önceki önerilerde ise noCandidates döner', async () => {
    mockSession.getSession.mockResolvedValue({
      userId: 'u1', suggestedPlaceIds: ['p1', 'p2'], refinements: [],
    });
    mockStreamResolving(mockAnthropicResponse({ recommendations: [] }));

    const result = await recommendStream({
      userId: 'u1',
      location: { lat: 41.04, lng: 28.98 },
      isPremium: false,
      sessionId: 's1',
      refinement: 'daha ucuz',
      onCard: () => {},
      onNote: () => {},
      onDone: () => {},
    });

    expect(result.noCandidates).toBe(true);
    expect(mockAnthropicStream).not.toHaveBeenCalled();
  });
});
