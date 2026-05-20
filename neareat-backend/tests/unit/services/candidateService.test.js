'use strict';

/**
 * Sprint-1 Task #6 — candidateService unit tests.
 * AC: distance, cuisine match, max 20, openNow filter, rating filter.
 */

const mockPrisma = {
  user: { findUnique: jest.fn() },
  favorite: { findMany: jest.fn() },
  review: { findMany: jest.fn() },
  recommendation: { findMany: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const mockGooglePlaces = {
  getNearbyRestaurantsFast: jest.fn(),
  getPlaceDetails: jest.fn().mockResolvedValue({}), // no photos by default
  getPhotoUrl: jest.fn().mockReturnValue('https://maps.googleapis.com/photo?ref=TEST'),
};
jest.mock('../../../src/services/googlePlaces', () => mockGooglePlaces);

const {
  MAX_CANDIDATES,
  MIN_RATING,
  getCandidates,
  __test: { placeTypesSet, cuisineMatchScore, scoreCandidate, toCandidate, fetchUserPrefs },
} = require('../../../src/services/candidateService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('placeTypesSet', () => {
  it('returns lowercase Set from place.types', () => {
    const s = placeTypesSet({ types: ['Restaurant', 'ITALIAN_RESTAURANT'] });
    expect(s instanceof Set).toBe(true);
    expect(s.has('restaurant')).toBe(true);
    expect(s.has('italian_restaurant')).toBe(true);
  });

  it('returns empty Set when types missing', () => {
    expect(placeTypesSet({}).size).toBe(0);
    expect(placeTypesSet({ types: null }).size).toBe(0);
  });
});

describe('cuisineMatchScore', () => {
  it('returns 0 when either set is empty', () => {
    expect(cuisineMatchScore(new Set(), new Set(['italian']))).toBe(0);
    expect(cuisineMatchScore(new Set(['italian_restaurant']), new Set())).toBe(0);
  });

  it('gives 2 for exact match', () => {
    const score = cuisineMatchScore(
      new Set(['italian_restaurant']),
      new Set(['italian_restaurant']),
    );
    expect(score).toBe(2);
  });

  it('gives 1 for substring match', () => {
    const score = cuisineMatchScore(
      new Set(['italian_restaurant']),
      new Set(['italian']),
    );
    expect(score).toBe(1);
  });

  it('gives 0 for no match', () => {
    const score = cuisineMatchScore(
      new Set(['japanese_restaurant']),
      new Set(['italian']),
    );
    expect(score).toBe(0);
  });

  it('accumulates across multiple matching types', () => {
    const score = cuisineMatchScore(
      new Set(['italian_restaurant', 'pizza']),
      new Set(['italian', 'pizza']),
    );
    expect(score).toBeGreaterThanOrEqual(2);
  });
});

describe('scoreCandidate', () => {
  const basePlace = {
    place_id: 'p1',
    name: 'Test',
    rating: 4.5,
    user_ratings_total: 1000,
    types: ['italian_restaurant', 'restaurant'],
  };
  const emptyPrefs = {
    cuisineHints: new Set(),
    recentPlaceIds: new Set(),
    likedPlaceIds: new Set(),
  };

  it('higher score when closer (distance bonus)', () => {
    const close = scoreCandidate(basePlace, 0.5, emptyPrefs);
    const far = scoreCandidate(basePlace, 5.0, emptyPrefs);
    expect(close).toBeGreaterThan(far);
  });

  it('cuisine match bumps score', () => {
    const withMatch = scoreCandidate(basePlace, 1.0, {
      ...emptyPrefs,
      cuisineHints: new Set(['italian']),
    });
    const noMatch = scoreCandidate(basePlace, 1.0, emptyPrefs);
    expect(withMatch).toBeGreaterThan(noMatch);
  });

  it('applies -2 novelty penalty for recently visited place (not liked)', () => {
    const novel = scoreCandidate(basePlace, 1.0, emptyPrefs);
    const visited = scoreCandidate(basePlace, 1.0, {
      ...emptyPrefs,
      recentPlaceIds: new Set(['p1']),
    });
    expect(visited).toBeCloseTo(novel - 2, 5);
  });

  it('liked place gets +1 instead of -2', () => {
    const novel = scoreCandidate(basePlace, 1.0, emptyPrefs);
    const visitedAndLiked = scoreCandidate(basePlace, 1.0, {
      ...emptyPrefs,
      recentPlaceIds: new Set(['p1']),
      likedPlaceIds: new Set(['p1']),
    });
    expect(visitedAndLiked).toBeCloseTo(novel + 1, 5);
  });

  it('higher rating → higher score', () => {
    const low = scoreCandidate({ ...basePlace, rating: 3.5 }, 1.0, emptyPrefs);
    const high = scoreCandidate({ ...basePlace, rating: 4.9 }, 1.0, emptyPrefs);
    expect(high).toBeGreaterThan(low);
  });
});

describe('toCandidate', () => {
  it('produces LLM-friendly shape with required fields', () => {
    const place = {
      place_id: 'p1',
      name: 'Test',
      types: ['restaurant'],
      rating: 4.5,
      user_ratings_total: 100,
      price_level: 2,
      vicinity: 'Taksim',
      geometry: { location: { lat: 41.04, lng: 28.98 } },
      opening_hours: { open_now: true },
    };
    const c = toCandidate(place, 0.42, 7.123);
    expect(c.placeId).toBe('p1');
    expect(c.name).toBe('Test');
    expect(c.types).toEqual(['restaurant']);
    expect(c.rating).toBe(4.5);
    expect(c.distanceKm).toBe(0.42);
    expect(c.score).toBe(7.123);
    expect(c.openNow).toBe(true);
    expect(c.location).toEqual({ lat: 41.04, lng: 28.98 });
  });

  it('handles null/missing fields gracefully', () => {
    const c = toCandidate({ place_id: 'p1', name: 'X', geometry: { location: { lat: 0, lng: 0 } } }, 1.0, 5.0);
    expect(c.rating).toBeNull();
    expect(c.userRatingsTotal).toBeNull();
    expect(c.priceLevel).toBeNull();
    expect(c.openNow).toBeNull();
  });
});

describe('fetchUserPrefs', () => {
  it('returns aggregated prefs from DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ favoriteCuisines: ['Türk', 'İtalyan'] });
    mockPrisma.favorite.findMany.mockResolvedValue([
      { placeId: 'fav1' },
      { placeId: 'fav2' },
    ]);
    mockPrisma.review.findMany.mockResolvedValue([
      { placeId: 'r1', rating: 5 },
      { placeId: 'r2', rating: 3 },
    ]);
    mockPrisma.recommendation.findMany.mockResolvedValue([
      { placeTypes: ['italian_restaurant', 'restaurant'] },
    ]);

    const prefs = await fetchUserPrefs('u1');
    expect(prefs.favoriteCuisines).toEqual(['Türk', 'İtalyan']);
    expect(prefs.cuisineHints.has('türk')).toBe(true);
    expect(prefs.cuisineHints.has('italian_restaurant')).toBe(true);
    expect(prefs.recentPlaceIds.has('fav1')).toBe(true);
    expect(prefs.recentPlaceIds.has('r1')).toBe(true);
    expect(prefs.likedPlaceIds.has('r1')).toBe(true);     // rating 5 → liked
    expect(prefs.likedPlaceIds.has('r2')).toBe(false);    // rating 3 → not liked
  });

  it('handles missing user gracefully (returns empty prefs)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);

    const prefs = await fetchUserPrefs('no-such-user');
    expect(prefs.favoriteCuisines).toEqual([]);
    expect(prefs.cuisineHints.size).toBe(0);
  });
});

describe('getCandidates (integration: prisma + googlePlaces mocks)', () => {
  function setupNoUserHistory() {
    mockPrisma.user.findUnique.mockResolvedValue({ favoriteCuisines: [] });
    mockPrisma.favorite.findMany.mockResolvedValue([]);
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.recommendation.findMany.mockResolvedValue([]);
  }

  function makePlace(i, opts = {}) {
    return {
      place_id: `p${i}`,
      name: `Place ${i}`,
      rating: opts.rating ?? 4.5,
      user_ratings_total: 100 + i,
      types: opts.types ?? ['restaurant'],
      geometry: { location: { lat: 41.04 + i * 0.001, lng: 28.98 } },
      vicinity: 'Test',
      opening_hours: opts.openingHours,
    };
  }

  it('returns max 20 candidates', async () => {
    setupNoUserHistory();
    // 30 places
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => makePlace(i)),
    );

    const { candidates } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });
    expect(candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    expect(candidates.length).toBe(20);
  });

  it('filters out places with rating < 3.5', async () => {
    setupNoUserHistory();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      makePlace(1, { rating: 4.5 }),
      makePlace(2, { rating: 3.0 }),  // below threshold
      makePlace(3, { rating: 3.4 }),  // below threshold
      makePlace(4, { rating: 3.5 }),  // exactly threshold → keep
    ]);

    const { candidates } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });
    const ratings = candidates.map((c) => c.rating);
    expect(ratings.every((r) => r >= MIN_RATING)).toBe(true);
    expect(candidates).toHaveLength(2);
  });

  it('keeps places with no rating (potentially new)', async () => {
    setupNoUserHistory();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      makePlace(1, { rating: 4.5 }),
      { ...makePlace(2), rating: undefined },  // rating yok
    ]);

    const { candidates } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });
    expect(candidates).toHaveLength(2);
  });

  it('filters out places that are explicitly closed (open_now: false)', async () => {
    setupNoUserHistory();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      makePlace(1, { openingHours: { open_now: true } }),
      makePlace(2, { openingHours: { open_now: false } }), // closed
      makePlace(3, { openingHours: undefined }),            // unknown — keep
    ]);

    const { candidates } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });
    const ids = candidates.map((c) => c.placeId);
    expect(ids).toContain('p1');
    expect(ids).not.toContain('p2');
    expect(ids).toContain('p3');
  });

  it('sorts candidates by score (best first)', async () => {
    setupNoUserHistory();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      { ...makePlace(1, { rating: 4.0 }), geometry: { location: { lat: 41.05, lng: 28.99 } } }, // farther
      { ...makePlace(2, { rating: 4.5 }), geometry: { location: { lat: 41.04, lng: 28.98 } } }, // closer
    ]);

    const { candidates } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });
    expect(candidates[0].score).toBeGreaterThan(candidates[1].score);
  });

  it('skips places without place_id or geometry', async () => {
    setupNoUserHistory();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([
      makePlace(1),
      { name: 'No id' }, // missing place_id
      { place_id: 'p3' }, // missing geometry
    ]);

    const { candidates } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].placeId).toBe('p1');
  });

  it('returns meta with diagnostic info', async () => {
    setupNoUserHistory();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([makePlace(1)]);

    const { meta } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });
    expect(meta.fetchedPlaces).toBe(1);
    expect(meta.afterFilter).toBe(1);
    expect(meta.returned).toBe(1);
    expect(typeof meta.latencyMs).toBe('number');
  });

  it('throws on invalid lat/lng', async () => {
    await expect(getCandidates('u1', { lat: 'invalid', lng: 28.98 })).rejects.toThrow();
    await expect(getCandidates('u1', { lat: 41.04, lng: null })).rejects.toThrow();
  });

  it('enriches top 5 candidates with photoUrl (Sprint-2 Task #3)', async () => {
    setupNoUserHistory();
    const places = Array.from({ length: 7 }, (_, i) => makePlace(i + 1));
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue(places);

    // Top 5 get a photo reference, rest don't
    mockGooglePlaces.getPlaceDetails.mockImplementation((placeId) => {
      // Mocked per-placeId: p1-p5 have photos, p6+ don't
      const idx = parseInt(String(placeId).replace('p', '') || '99', 10);
      if (idx <= 5) return Promise.resolve({ photos: [{ photo_reference: `ref${idx}` }] });
      return Promise.resolve({});
    });
    mockGooglePlaces.getPhotoUrl.mockImplementation((ref) => `https://photo/${ref}`);

    const { candidates } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });

    // At least some top candidates should have photoUrl
    const withPhoto = candidates.filter((c) => c.photoUrl !== null);
    expect(withPhoto.length).toBeGreaterThan(0);
    // photoUrl format check
    withPhoto.forEach((c) => expect(c.photoUrl).toMatch(/^https:\/\/photo\//));
  });

  it('photoUrl is null when getPlaceDetails fails (graceful fallback)', async () => {
    setupNoUserHistory();
    mockGooglePlaces.getNearbyRestaurantsFast.mockResolvedValue([makePlace(1)]);
    mockGooglePlaces.getPlaceDetails.mockRejectedValue(new Error('API error'));

    const { candidates } = await getCandidates('u1', { lat: 41.04, lng: 28.98 });
    expect(candidates[0].photoUrl).toBeNull();
  });
});
