'use strict';

/**
 * Arkadaş Önerisi puanlama çekirdeği — saf fonksiyon testleri (DB'siz).
 */

const {
  scoreCandidate,
  rankForViewer,
  intersectionCount,
  aiUsageLevel,
  maskName,
  MAX_SCORE,
  W,
} = require('../../../src/services/friendSuggestionService');

// Eksiksiz context objesi üretir (test kolaylığı için)
function ctx(over = {}) {
  return {
    id: over.id || 'u',
    displayName: over.displayName || 'Test User',
    photoUrl: over.photoUrl ?? null,
    city: over.city ?? null,
    countryCode: over.countryCode ?? null,
    starCount: over.starCount ?? 0,
    favorites: new Set(over.favorites || []),
    collections: new Set(over.collections || []),
    cuisines: new Set(over.cuisines || []),
    recommendations: new Set(over.recommendations || []),
    reservations: new Set(over.reservations || []),
    polls: new Set(over.polls || []),
    likedTypes: new Set(over.likedTypes || []),
    aiLevel: over.aiLevel ?? 0,
  };
}

describe('intersectionCount', () => {
  it('ortak eleman sayısını döner', () => {
    expect(intersectionCount(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBe(2);
  });
  it('boş kümelerde 0 döner', () => {
    expect(intersectionCount(new Set(), new Set(['a']))).toBe(0);
  });
});

describe('aiUsageLevel', () => {
  it('kullanım sayısını seviyeye böler', () => {
    expect(aiUsageLevel(0)).toBe(0);
    expect(aiUsageLevel(3)).toBe(1);
    expect(aiUsageLevel(10)).toBe(2);
    expect(aiUsageLevel(50)).toBe(3);
  });
});

describe('maskName', () => {
  it('tek kelimeyi kısaltır', () => {
    expect(maskName('Ahmet')).toBe('Ah...');
  });
  it('ad-soyadı maskeler', () => {
    expect(maskName('Ahmet Yılmaz')).toBe('Ah. Yı...');
  });
});

describe('scoreCandidate', () => {
  it('hiç ortak sinyal yoksa 0 puan + boş sebep', () => {
    const r = scoreCandidate(ctx(), ctx({ id: 'c' }));
    expect(r.score).toBe(0);
    expect(r.reasons).toHaveLength(0);
  });

  it('aynı şehir puanı verir', () => {
    const r = scoreCandidate(ctx({ city: 'İstanbul' }), ctx({ id: 'c', city: 'istanbul' }));
    expect(r.score).toBe(W.sameCity);
    expect(r.reasons).toContain('Aynı şehir');
  });

  it('aynı şehirken ülke puanı eklenmez (çifte sayım yok)', () => {
    const r = scoreCandidate(
      ctx({ city: 'İstanbul', countryCode: 'TR' }),
      ctx({ id: 'c', city: 'İstanbul', countryCode: 'TR' }),
    );
    expect(r.score).toBe(W.sameCity);
    expect(r.reasons).not.toContain('Aynı ülke');
  });

  it('farklı şehir ama aynı ülke → ülke puanı', () => {
    const r = scoreCandidate(
      ctx({ city: 'İstanbul', countryCode: 'TR' }),
      ctx({ id: 'c', city: 'Ankara', countryCode: 'TR' }),
    );
    expect(r.score).toBe(W.sameCountry);
    expect(r.reasons).toContain('Aynı ülke');
  });

  it('ortak favoriler tavanı aşmaz', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'];
    const r = scoreCandidate(ctx({ favorites: many }), ctx({ id: 'c', favorites: many }));
    expect(r.commonFavorites).toBe(6);
    expect(r.score).toBe(W.favoriteCap); // 6*15=90 ama cap 60
  });

  it('paylaşılan öneri + rezervasyon + anket sinyallerini sayar', () => {
    const r = scoreCandidate(
      ctx({ recommendations: ['p1'], reservations: ['p2'], polls: ['p3'] }),
      ctx({ id: 'c', recommendations: ['p1'], reservations: ['p2'], polls: ['p3'] }),
    );
    expect(r.commonRecommendations).toBe(1);
    expect(r.commonReservations).toBe(1);
    expect(r.commonPolls).toBe(1);
    expect(r.score).toBe(W.recommendationPer + W.reservationPer + W.pollPer);
    expect(r.reasons).toEqual(expect.arrayContaining([
      '1 ortak paylaşılan mekan', '1 ortak rezervasyon mekanı', '1 ortak anket mekanı',
    ]));
  });

  it('AI feedback beğeni profili örtüşmesini sayar', () => {
    const r = scoreCandidate(
      ctx({ likedTypes: ['sushi', 'pizza'] }),
      ctx({ id: 'c', likedTypes: ['sushi', 'burger'] }),
    );
    expect(r.commonLikedTypes).toBe(1);
    expect(r.score).toBe(W.likedTypePer);
    expect(r.reasons).toContain('Benzer beğeni profili');
  });

  it('benzer AI kullanım seviyesinde puan verir, uzak seviyede vermez', () => {
    const near = scoreCandidate(ctx({ aiLevel: 2 }), ctx({ id: 'c', aiLevel: 3 }));
    expect(near.score).toBe(W.aiUsageSimilar);
    expect(near.reasons).toContain('Benzer AI kullanımı');

    const far = scoreCandidate(ctx({ aiLevel: 1 }), ctx({ id: 'c', aiLevel: 3 }));
    expect(far.score).toBe(0);
  });

  it('AI seviyelerinden biri 0 ise puan vermez', () => {
    const r = scoreCandidate(ctx({ aiLevel: 0 }), ctx({ id: 'c', aiLevel: 1 }));
    expect(r.score).toBe(0);
  });
});

describe('rankForViewer', () => {
  const viewer = ctx({ id: 'me', city: 'İstanbul', favorites: ['p1'] });

  it('puana göre sıralar, ilişkide olunanları eler, matchPercent ekler', () => {
    const cands = [
      ctx({ id: 'low', favorites: ['p1'] }),                       // 15
      ctx({ id: 'high', city: 'İstanbul', favorites: ['p1'] }),    // 45
      ctx({ id: 'friend', city: 'İstanbul', favorites: ['p1'] }),  // elenecek
      ctx({ id: 'zero' }),                                          // 0 → düşer
    ];
    const result = rankForViewer(viewer, cands, new Set(['me', 'friend']));

    expect(result.map((r) => r.userId)).toEqual(['high', 'low']);
    expect(result[0].matchScore).toBeGreaterThan(result[1].matchScore);
    expect(result[0].matchPercent).toBe(Math.round((result[0].matchScore / MAX_SCORE) * 100));
    expect(result.find((r) => r.userId === 'friend')).toBeUndefined();
    expect(result.find((r) => r.userId === 'zero')).toBeUndefined();
  });

  it('en fazla 10 sonuç döner', () => {
    const cands = Array.from({ length: 20 }, (_, i) => ctx({ id: `c${i}`, favorites: ['p1'] }));
    const result = rankForViewer(viewer, cands, new Set(['me']));
    expect(result).toHaveLength(10);
  });
});
