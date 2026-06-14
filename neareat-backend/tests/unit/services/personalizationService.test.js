'use strict';

/**
 * Sprint-17 #366 — personalizationService (kişiselleştirme çekirdeği) unit testleri.
 * Saf modül: mock yok. buildTasteProfile / scorePlace / rankForYou davranışı.
 */

const {
  buildTasteProfile,
  scorePlace,
  rankForYou,
  W,
} = require('../../../src/services/personalizationService');

describe('buildTasteProfile', () => {
  test('ağırlık sınıflarına göre mutfak etiketi ağırlıklarını birleştirir', () => {
    const profile = buildTasteProfile({
      weightedTags: [
        { tags: ['Kebap'], weightKey: 'favoritePlaceTag' }, // 1.5
        { tags: ['Kebap'], weightKey: 'otherEngagedTag' },  // 1
        { tags: ['Pizza'], weightKey: 'otherEngagedTag' },  // 1
      ],
    });
    expect(profile.cuisineWeights.get('Kebap')).toBeCloseTo(W.favoritePlaceTag + W.otherEngagedTag);
    expect(profile.cuisineWeights.get('Pizza')).toBeCloseTo(W.otherEngagedTag);
  });

  test('ziyaret sayısı ≥2 olan mekanları frequentPlaceIds olarak işaretler', () => {
    const profile = buildTasteProfile({
      placeFrequency: { a: 3, b: 1, c: 2 },
    });
    expect(profile.frequentPlaceIds.has('a')).toBe(true);
    expect(profile.frequentPlaceIds.has('c')).toBe(true);
    expect(profile.frequentPlaceIds.has('b')).toBe(false);
  });

  test('favori mutfakları normalize eder (küçük harf)', () => {
    const profile = buildTasteProfile({ favoriteCuisines: ['İtalyan', 'Vegan'] });
    expect(profile.favoriteCuisines).toContain('italyan');
    expect(profile.favoriteCuisines).toContain('vegan');
  });
});

describe('scorePlace', () => {
  const profile = buildTasteProfile({
    favoriteCuisines: ['İtalyan'],
    likedTypes: ['cafe'],
    weightedTags: [{ tags: ['Kebap'], weightKey: 'favoritePlaceTag' }],
    triedPlaceIds: ['tried-1'],
    highRatedPlaceIds: [],
  });

  test('sevilen mutfak etiketi yüksek skor + doğru gerekçe üretir', () => {
    const { score, reasons } = scorePlace(
      { placeId: 'x', name: 'Şah Kebap', cuisineTags: ['Kebap'], rating: 4.2, distanceKm: 1 },
      profile,
    );
    expect(score).toBeGreaterThan(0);
    expect(reasons).toContain('Sevdiğin mutfak: Kebap');
  });

  test('sık gidilen mekana frequent bonusu + "Sık gittiğin yer" gerekçesi', () => {
    const p = buildTasteProfile({ placeFrequency: { f1: 4 } });
    const { score, reasons } = scorePlace(
      { placeId: 'f1', name: 'Yer', cuisineTags: [], rating: 3, distanceKm: 2 },
      p,
    );
    expect(reasons).toContain('Sık gittiğin yer');
    expect(score).toBeGreaterThan(3);
  });

  test('yakında denenmiş (ama sık değil) mekan ceza alır', () => {
    const triedScore = scorePlace(
      { placeId: 'tried-1', name: 'Yer', cuisineTags: [], rating: 3, distanceKm: 2 },
      profile,
    ).score;
    const freshScore = scorePlace(
      { placeId: 'new-1', name: 'Yer', cuisineTags: [], rating: 3, distanceKm: 2 },
      profile,
    ).score;
    expect(triedScore).toBeLessThan(freshScore);
  });

  test('favori mutfak isimde/etikette geçiyorsa skora katkı verir', () => {
    const withFav = scorePlace(
      { placeId: 'a', name: 'İtalyan Bistro', cuisineTags: [], rating: 3, distanceKm: 1 },
      profile,
    ).score;
    const without = scorePlace(
      { placeId: 'b', name: 'Sıradan Lokanta', cuisineTags: [], rating: 3, distanceKm: 1 },
      profile,
    ).score;
    expect(withFav).toBeGreaterThan(without);
  });

  test('profil/place yoksa güvenli sıfır döner', () => {
    expect(scorePlace(null, profile)).toEqual({ score: 0, reasons: [] });
    expect(scorePlace({ placeId: 'x' }, null)).toEqual({ score: 0, reasons: [] });
  });
});

describe('rankForYou', () => {
  test('daha alakalı mekanı öne alır ve personalScore/reasons ekler', () => {
    const profile = buildTasteProfile({
      weightedTags: [{ tags: ['Kebap'], weightKey: 'favoritePlaceTag' }],
    });
    const places = [
      { placeId: 'pizza', name: 'Pizza Yeri', cuisineTags: ['Pizza'], rating: 4, distanceKm: 1 },
      { placeId: 'kebap', name: 'Kebap Yeri', cuisineTags: ['Kebap'], rating: 4, distanceKm: 1 },
    ];
    const ranked = rankForYou(places, profile);
    expect(ranked[0].placeId).toBe('kebap');
    expect(ranked[0]).toHaveProperty('personalScore');
    expect(ranked[0]).toHaveProperty('reasons');
  });

  test('boş girdi boş dizi döner', () => {
    expect(rankForYou([], buildTasteProfile({}))).toEqual([]);
    expect(rankForYou(undefined, buildTasteProfile({}))).toEqual([]);
  });
});
