'use strict';

/**
 * Sprint-4 Task #7 — feedbackAggregator.aggregateTypePreferences unit tests.
 * Saf aggregate mantığı (DB'siz).
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../../src/utils/prisma', () => ({}));

const { aggregateTypePreferences, MAX_PREFERENCE_TYPES } = require('../../../src/jobs/feedbackAggregator');

describe('aggregateTypePreferences', () => {
  it('boş girdide boş diziler', () => {
    expect(aggregateTypePreferences([])).toEqual({ likedTypes: [], dislikedTypes: [] });
    expect(aggregateTypePreferences(undefined)).toEqual({ likedTypes: [], dislikedTypes: [] });
  });

  it('pozitif feedback tipleri likedTypes, negatif dislikedTypes', () => {
    const res = aggregateTypePreferences([
      { sentiment: 'positive', placeTypes: ['italian_restaurant'] },
      { sentiment: 'negative', placeTypes: ['fast_food_restaurant'] },
    ]);
    expect(res.likedTypes).toContain('italian_restaurant');
    expect(res.dislikedTypes).toContain('fast_food_restaurant');
  });

  it('genel/jenerik tipleri (restaurant, food, point_of_interest...) eler', () => {
    const res = aggregateTypePreferences([
      { sentiment: 'positive', placeTypes: ['restaurant', 'food', 'point_of_interest', 'establishment', 'cafe', 'sushi_restaurant'] },
    ]);
    expect(res.likedTypes).toEqual(['sushi_restaurant']);
  });

  it('net skor: aynı tip hem beğenilip hem beğenilmezse net yöne gider', () => {
    const res = aggregateTypePreferences([
      { sentiment: 'positive', placeTypes: ['kebab'] },
      { sentiment: 'positive', placeTypes: ['kebab'] },
      { sentiment: 'positive', placeTypes: ['kebab'] },
      { sentiment: 'negative', placeTypes: ['kebab'] },
    ]);
    // net +2 → liked
    expect(res.likedTypes).toContain('kebab');
    expect(res.dislikedTypes).not.toContain('kebab');
  });

  it('net sıfır olan tip hiçbir listeye girmez', () => {
    const res = aggregateTypePreferences([
      { sentiment: 'positive', placeTypes: ['seafood'] },
      { sentiment: 'negative', placeTypes: ['seafood'] },
    ]);
    expect(res.likedTypes).not.toContain('seafood');
    expect(res.dislikedTypes).not.toContain('seafood');
  });

  it('ağırlığa göre sıralar (en çok beğenilen başta)', () => {
    const res = aggregateTypePreferences([
      { sentiment: 'positive', placeTypes: ['a'] },
      { sentiment: 'positive', placeTypes: ['b'] },
      { sentiment: 'positive', placeTypes: ['b'] },
    ]);
    expect(res.likedTypes).toEqual(['b', 'a']);
  });

  it('her yönde en fazla MAX_PREFERENCE_TYPES tip döner', () => {
    const records = [];
    for (let i = 0; i < MAX_PREFERENCE_TYPES + 5; i++) {
      records.push({ sentiment: 'positive', placeTypes: [`type_${i}`] });
    }
    const res = aggregateTypePreferences(records);
    expect(res.likedTypes.length).toBe(MAX_PREFERENCE_TYPES);
  });

  it('tipleri küçük harfe normalize eder', () => {
    const res = aggregateTypePreferences([
      { sentiment: 'positive', placeTypes: ['Italian_Restaurant'] },
    ]);
    expect(res.likedTypes).toContain('italian_restaurant');
  });
});
