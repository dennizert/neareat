'use strict';

/**
 * Sprint-1 Task #6 — promptBuilder unit tests.
 * AC: deterministic output, cache marker yapısı, token estimate doğru çalışıyor.
 */

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  review: { findMany: jest.fn() },
  favorite: { findMany: jest.fn() },
  starEvent: { findMany: jest.fn() },
  recommendation: { findMany: jest.fn() },
  friendRequest: { findMany: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const {
  buildUserProfileSummary,
  buildClaudeRequest,
  SYSTEM_PROMPT,
  __test: { stableStringify, approxTokens, buildSystemBlock, buildProfileBlock, buildVariableBlock, buildFriendSignals },
} = require('../../../src/services/promptBuilder');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('stableStringify', () => {
  it('produces identical output for objects with different key insertion order', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('preserves array order (arrays are NOT re-sorted)', () => {
    const obj = { items: [3, 1, 2] };
    const s = stableStringify(obj);
    expect(s).toContain('[\n    3,\n    1,\n    2\n  ]');
  });

  it('handles nested objects recursively', () => {
    const a = { outer: { z: 1, a: 2 }, x: 5 };
    const b = { x: 5, outer: { a: 2, z: 1 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('returns string', () => {
    expect(typeof stableStringify({})).toBe('string');
  });
});

describe('approxTokens', () => {
  it('returns 0 for empty/undefined', () => {
    expect(approxTokens('')).toBe(0);
    expect(approxTokens(undefined)).toBe(0);
    expect(approxTokens(null)).toBe(0);
  });

  it('scales roughly linearly with length', () => {
    const short = approxTokens('a'.repeat(35));   // ~10 tokens
    const long = approxTokens('a'.repeat(350));   // ~100 tokens
    expect(long).toBeGreaterThan(short * 5);
  });

  it('returns positive integer', () => {
    const n = approxTokens('Türkçe metin örneği');
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });
});

describe('SYSTEM_PROMPT', () => {
  it('is a long stable string (≥ 2000 chars) — required for Haiku 4.5 caching', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(2000);
  });

  it('contains required directives', () => {
    expect(SYSTEM_PROMPT).toMatch(/sommelier/i);
    expect(SYSTEM_PROMPT).toMatch(/ÇIKTI FORMATI/i);
    expect(SYSTEM_PROMPT).toMatch(/placeId/);
    expect(SYSTEM_PROMPT).toMatch(/recommendations/);
  });

  it('does NOT contain dynamic placeholders like current date', () => {
    // Determinizm garantisi — cache key stabil kalmalı
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/); // ISO date
    expect(SYSTEM_PROMPT).not.toMatch(/{{[^}]+}}/);          // template var
  });
});

describe('buildSystemBlock', () => {
  it('returns array with single text block carrying cache_control', () => {
    const blocks = buildSystemBlock();
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].text).toBe(SYSTEM_PROMPT);
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('buildProfileBlock', () => {
  it('wraps profile text with cache_control', () => {
    const block = buildProfileBlock('## Test profile\nContent here');
    expect(block.type).toBe('text');
    expect(block.text).toContain('Test profile');
    expect(block.cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('buildVariableBlock', () => {
  const baseCands = [{
    placeId: 'p1',
    name: 'Test Place',
    distanceKm: 0.5,
    rating: 4.5,
    userRatingsTotal: 100,
    priceLevel: 2,
    types: ['restaurant', 'italian_restaurant'],
    vicinity: 'Taksim',
    openNow: true,
  }];

  it('does NOT have cache_control (volatile block)', () => {
    const block = buildVariableBlock({
      candidates: baseCands,
      location: { lat: 41, lng: 28.9 },
      mood: 'şık',
      now: '2026-05-20T18:00:00Z',
    });
    expect(block.cache_control).toBeUndefined();
  });

  it('includes candidate details', () => {
    const block = buildVariableBlock({
      candidates: baseCands,
      location: { lat: 41.0369, lng: 28.985 },
      mood: 'şık',
      now: '2026-05-20T18:00:00Z',
    });
    expect(block.text).toContain('Test Place');
    expect(block.text).toContain('p1');
    expect(block.text).toContain('0.5 km');
    expect(block.text).toMatch(/4\.5/);
    expect(block.text).toContain('AÇIK'); // openNow=true
  });

  it('marks place as KAPALI for openNow=false', () => {
    const block = buildVariableBlock({
      candidates: [{ ...baseCands[0], openNow: false }],
      location: { lat: 41, lng: 28.9 },
      now: '2026-05-20T18:00:00Z',
    });
    expect(block.text).toContain('KAPALI');
  });

  it('marks as belirsiz when openNow is null', () => {
    const block = buildVariableBlock({
      candidates: [{ ...baseCands[0], openNow: null }],
      location: { lat: 41, lng: 28.9 },
      now: '2026-05-20T18:00:00Z',
    });
    expect(block.text).toMatch(/belirsiz/);
  });

  it('says "belirtilmedi" when mood is empty', () => {
    const block = buildVariableBlock({
      candidates: baseCands,
      location: { lat: 41, lng: 28.9 },
      mood: undefined,
      now: '2026-05-20T18:00:00Z',
    });
    expect(block.text).toMatch(/belirtilmedi/);
  });
});

describe('buildUserProfileSummary', () => {
  function setupEmptyUser() {
    mockPrisma.user.findUnique.mockResolvedValue({
      displayName: 'Test User',
      favoriteCuisines: [],
      starCount: 0,
      city: null,
      bio: null,
    });
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.starEvent.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);
  }

  it('throws when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.starEvent.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);

    await expect(buildUserProfileSummary('no-such-id')).rejects.toThrow(/user not found/);
  });

  it('returns text + profile + tokenEstimate', async () => {
    setupEmptyUser();
    const result = await buildUserProfileSummary('u1');
    expect(typeof result.text).toBe('string');
    expect(typeof result.profile).toBe('object');
    expect(typeof result.tokenEstimate).toBe('number');
    expect(result.profile.displayName).toBe('Test User');
    expect(result.profile.recentReviews).toEqual([]);
  });

  it('is DETERMINISTIC — 2 calls with same data produce identical text', async () => {
    setupEmptyUser();
    const r1 = await buildUserProfileSummary('u1');
    const r2 = await buildUserProfileSummary('u1');
    expect(r1.text).toBe(r2.text); // bytes-level identical → cache key stabil
  });

  it('computes reviewer avgRating from review records', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      displayName: 'Reviewer',
      favoriteCuisines: ['Türk'],
      starCount: 10,
      city: 'İstanbul',
      bio: null,
    });
    mockPrisma.review.findMany.mockResolvedValue([
      { placeId: 'p1', rating: 5, body: 'Harika', createdAt: new Date('2026-01-15') },
      { placeId: 'p2', rating: 3, body: 'İdare eder', createdAt: new Date('2026-02-10') },
      { placeId: 'p3', rating: 4, body: 'İyi', createdAt: new Date('2026-03-05') },
    ]);
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.starEvent.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);

    const r = await buildUserProfileSummary('u1');
    expect(r.profile.reviewerStats.totalReviews).toBe(3);
    expect(r.profile.reviewerStats.avgRating).toBeCloseTo(4.0, 1);
  });

  it('only includes YYYY-MM in recent reviews (no full timestamp — determinizm)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      displayName: 'U', favoriteCuisines: [], starCount: 0, city: null, bio: null,
    });
    mockPrisma.review.findMany.mockResolvedValue([
      { placeId: 'p1', rating: 5, body: 'Test', createdAt: new Date('2026-03-15T14:23:45.678Z') },
    ]);
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.starEvent.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);

    const r = await buildUserProfileSummary('u1');
    expect(r.profile.recentReviews[0].monthYear).toBe('2026-03');
    // Full timestamp should NOT leak in text
    expect(r.text).not.toContain('14:23:45');
    expect(r.text).not.toContain('2026-03-15T');
  });
});

describe('buildClaudeRequest', () => {
  const stubProfileSummary = {
    text: '## Profile\nempty user',
    profile: { displayName: 'U' },
    tokenEstimate: 100,
  };

  const stubCandidates = [{
    placeId: 'p1',
    name: 'Test Place',
    distanceKm: 0.5,
    rating: 4.5,
    userRatingsTotal: 100,
    priceLevel: 2,
    types: ['restaurant'],
    vicinity: 'Taksim',
    openNow: true,
  }];

  it('returns shape { system, messages, tokenEstimate }', () => {
    const req = buildClaudeRequest({
      profileSummary: stubProfileSummary,
      candidates: stubCandidates,
      location: { lat: 41, lng: 28.9 },
      now: '2026-05-20T18:00:00Z',
    });

    expect(req.system).toBeDefined();
    expect(req.messages).toBeDefined();
    expect(req.tokenEstimate).toBeDefined();
    expect(req.tokenEstimate.system).toBeGreaterThan(0);
    expect(req.tokenEstimate.profile).toBe(100);
    expect(req.tokenEstimate.variable).toBeGreaterThan(0);
  });

  it('places cache_control on system block', () => {
    const req = buildClaudeRequest({
      profileSummary: stubProfileSummary,
      candidates: stubCandidates,
      location: { lat: 41, lng: 28.9 },
      now: '2026-05-20T18:00:00Z',
    });
    expect(req.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('places cache_control on profile block, NOT on variable block', () => {
    const req = buildClaudeRequest({
      profileSummary: stubProfileSummary,
      candidates: stubCandidates,
      location: { lat: 41, lng: 28.9 },
      now: '2026-05-20T18:00:00Z',
    });
    const userMsg = req.messages[0];
    expect(userMsg.role).toBe('user');
    expect(userMsg.content[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(userMsg.content[1].cache_control).toBeUndefined();
  });

  it('uses exactly 2 cache breakpoints (max 4 allowed)', () => {
    const req = buildClaudeRequest({
      profileSummary: stubProfileSummary,
      candidates: stubCandidates,
      location: { lat: 41, lng: 28.9 },
      now: '2026-05-20T18:00:00Z',
    });

    let count = 0;
    for (const b of req.system) if (b.cache_control) count++;
    for (const m of req.messages) {
      for (const b of m.content) if (b.cache_control) count++;
    }
    expect(count).toBe(2);
  });
});

// ─── buildFriendSignals ──────────────────────────────────────────────────────

describe('buildFriendSignals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty array when user has no accepted friend requests', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);

    const result = await buildFriendSignals('u1');

    expect(result).toEqual([]);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('returns empty array when no friends opted-in (KVKK)', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([
      { fromUserId: 'u1', toUserId: 'f1' },
    ]);
    // f1 hasn't opted-in
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await buildFriendSignals('u1');

    expect(result).toEqual([]);
  });

  it('returns anonymized signals for opted-in friends', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([
      { fromUserId: 'u1', toUserId: 'f1' },
      { fromUserId: 'f2', toUserId: 'u1' },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);
    mockPrisma.recommendation.findMany.mockResolvedValue([
      { fromUserId: 'f1', placeTypes: ['italian_restaurant', 'restaurant'] },
      { fromUserId: 'f1', placeTypes: ['italian_restaurant'] },
      { fromUserId: 'f2', placeTypes: ['sushi_restaurant'] },
    ]);
    mockPrisma.review.findMany.mockResolvedValue([
      { userId: 'f1', rating: 5 },
      { userId: 'f1', rating: 4 },
      { userId: 'f2', rating: 4 },
    ]);

    const result = await buildFriendSignals('u1');

    expect(result).toHaveLength(2);
    // No real IDs or names
    expect(result[0].label).toBe('arkadaş 1');
    expect(result[1].label).toBe('arkadaş 2');
    // f1: italian appears twice → top type
    expect(result[0].topCuisineTypes).toContain('italian_restaurant');
    expect(result[0].reviewCount).toBe(2);
    expect(result[0].avgRating).toBeCloseTo(4.5, 1);
    // f2: sushi
    expect(result[1].topCuisineTypes).toContain('sushi_restaurant');
  });

  it('excludes friends with no cuisine signal and no reviews', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([
      { fromUserId: 'u1', toUserId: 'f1' },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'f1' }]);
    // f1 has no recs and no reviews
    mockPrisma.recommendation.findMany.mockResolvedValue([]);
    mockPrisma.review.findMany.mockResolvedValue([]);

    const result = await buildFriendSignals('u1');

    expect(result).toEqual([]);
  });

  it('is deterministic — same data yields identical output twice', async () => {
    const setupMocks = () => {
      mockPrisma.friendRequest.findMany.mockResolvedValue([
        { fromUserId: 'u1', toUserId: 'f1' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'f1' }]);
      mockPrisma.recommendation.findMany.mockResolvedValue([
        { fromUserId: 'f1', placeTypes: ['cafe', 'italian_restaurant'] },
      ]);
      mockPrisma.review.findMany.mockResolvedValue([
        { userId: 'f1', rating: 4 },
      ]);
    };

    setupMocks();
    const r1 = await buildFriendSignals('u1');
    setupMocks();
    const r2 = await buildFriendSignals('u1');

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('does NOT expose friend IDs or names in output', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([
      { fromUserId: 'u1', toUserId: 'real-uuid-friend-123' },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'real-uuid-friend-123' }]);
    mockPrisma.recommendation.findMany.mockResolvedValue([
      { fromUserId: 'real-uuid-friend-123', placeTypes: ['cafe'] },
    ]);
    mockPrisma.review.findMany.mockResolvedValue([
      { userId: 'real-uuid-friend-123', rating: 4 },
    ]);

    const result = await buildFriendSignals('u1');
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('real-uuid-friend-123');
    expect(result[0].label).toBe('arkadaş 1');
  });
});

// ─── buildUserProfileSummary — tier integration ──────────────────────────────

describe('buildUserProfileSummary — free vs premium tier', () => {
  function setupBaseUser() {
    mockPrisma.user.findUnique.mockResolvedValue({
      displayName: 'Test User',
      favoriteCuisines: [],
      starCount: 0,
      city: null,
      bio: null,
    });
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.starEvent.findMany.mockResolvedValue([]);
  }

  it('does NOT call friendRequest for free tier (cache stabil)', async () => {
    setupBaseUser();
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);

    await buildUserProfileSummary('u1', { tier: 'free' });

    expect(mockPrisma.friendRequest.findMany).not.toHaveBeenCalled();
  });

  it('does NOT include friendSignals key for free tier', async () => {
    setupBaseUser();
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);

    const r = await buildUserProfileSummary('u1', { tier: 'free' });

    expect(r.profile.friendSignals).toBeUndefined();
  });

  it('does NOT include friendSignals when no opt-in friends (premium)', async () => {
    setupBaseUser();
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);

    const r = await buildUserProfileSummary('u1', { tier: 'premium' });

    expect(r.profile.friendSignals).toBeUndefined();
  });

  it('includes friendSignals in profile for premium with opted-in friends', async () => {
    setupBaseUser();
    // User's own queries — distinguish by query shape
    mockPrisma.review.findMany.mockImplementation(({ where }) => {
      if (where?.userId?.in) return Promise.resolve([{ userId: 'f1', rating: 5 }]);
      return Promise.resolve([]); // user's own reviews
    });
    mockPrisma.recommendation.findMany.mockImplementation(({ where }) => {
      if (where?.fromUserId?.in) {
        return Promise.resolve([{ fromUserId: 'f1', placeTypes: ['italian_restaurant'] }]);
      }
      return Promise.resolve([]); // user's sent recs
    });
    mockPrisma.friendRequest.findMany.mockResolvedValue([
      { fromUserId: 'u1', toUserId: 'f1' },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'f1' }]);

    const r = await buildUserProfileSummary('u1', { tier: 'premium' });

    expect(Array.isArray(r.profile.friendSignals)).toBe(true);
    expect(r.profile.friendSignals).toHaveLength(1);
    expect(r.profile.friendSignals[0].label).toBe('arkadaş 1');
    expect(r.profile.friendSignals[0].topCuisineTypes).toContain('italian_restaurant');
  });

  it('free and premium profiles with same user data differ only in friendSignals presence', async () => {
    setupBaseUser();
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);

    const free = await buildUserProfileSummary('u1', { tier: 'free' });
    const premium = await buildUserProfileSummary('u1', { tier: 'premium' });

    // Both have same base fields
    expect(free.profile.displayName).toBe(premium.profile.displayName);
    // Free has no friendSignals key at all
    expect('friendSignals' in free.profile).toBe(false);
    // Premium with no opt-in friends also has no key
    expect('friendSignals' in premium.profile).toBe(false);
  });
});
