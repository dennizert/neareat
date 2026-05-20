'use strict';

/**
 * Sprint-1 Task #6 — recommendationService unit tests.
 * AC: parseLlmJson defensive, modelForTier, summarizeUsage, halüsinasyon filtresi.
 *
 * Anthropic API mock'lu — gerçek call yok.
 */

const mockPrisma = {
  user: { findUnique: jest.fn() },
  favorite: { findMany: jest.fn() },
  review: { findMany: jest.fn() },
  starEvent: { findMany: jest.fn() },
  recommendation: { findMany: jest.fn() },
  aiRecommendationLog: { create: jest.fn(), count: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const mockGooglePlaces = {
  getNearbyRestaurantsFast: jest.fn(),
};
jest.mock('../../../src/services/googlePlaces', () => mockGooglePlaces);

// Anthropic SDK mock
const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  }));
});

const { mockAnthropicResponse } = require('../../helpers');
const {
  MODELS,
  modelForTier,
  summarizeUsage,
  recommend,
  __test: { parseLlmJson },
} = require('../../../src/services/recommendationService');

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
    expect(callArg.data.mood).toBe('şık');
    expect(callArg.data.lat).toBe(41.04);
    expect(callArg.data.lng).toBe(28.98);
  });

  it('premium tier uses Sonnet model', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1', name: 'X', rating: 4.5, types: ['restaurant'],
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
        place_id: 'p1', name: 'X', rating: 4.5, types: ['restaurant'],
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
        place_id: 'p1', name: 'X', rating: 4.5, types: ['restaurant'],
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
        place_id: 'p1', name: 'X', rating: 4.5, types: ['restaurant'],
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

  it('passes through cache_control markers to Anthropic API', async () => {
    setupBasicMocks();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      {
        place_id: 'p1', name: 'X', rating: 4.5, types: ['restaurant'],
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
