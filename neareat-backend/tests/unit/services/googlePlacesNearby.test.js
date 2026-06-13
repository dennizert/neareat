'use strict';

/**
 * getNearbyRestaurants tek-sayfa davranışı testi (S15-P1).
 *
 * Keşfet listesi soğuk yüklemesini hızlandırmak için pagination (next_page_token +
 * 2sn beklemeler) kaldırıldı. Bu test, `next_page_token` dönen bir yanıt karşısında
 * bile YALNIZCA tek bir Google çağrısı yapıldığını ve sonraki sayfanın takip
 * edilmediğini doğrular. https + redis mock'lanır (gerçek ağ/cache yok).
 */

// Redis cache — her zaman miss, set noop.
jest.mock('../../../src/services/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));

// https.get — sahte yanıt akışı (data + end emit).
const mockHttpsGet = jest.fn();
jest.mock('https', () => ({ get: (...args) => mockHttpsGet(...args) }));

const { getNearbyRestaurants } = require('../../../src/services/googlePlaces');

/** Tek bir https.get çağrısını JSON gövdesiyle çözen sahte response kurar. */
function mockHttpsResponseOnce(jsonBody) {
  mockHttpsGet.mockImplementationOnce((url, cb) => {
    const res = {
      on: (event, handler) => {
        if (event === 'data') handler(JSON.stringify(jsonBody));
        if (event === 'end') handler();
        return res;
      },
    };
    cb(res);
    return { on: () => ({}) }; // .on('error', ...) zincirini karşıla
  });
}

describe('getNearbyRestaurants — tek sayfa (S15-P1)', () => {
  beforeEach(() => {
    mockHttpsGet.mockReset();
  });

  it('next_page_token dönse bile ikinci sayfayı çekmez (tek https çağrısı)', async () => {
    mockHttpsResponseOnce({
      status: 'OK',
      results: [{ place_id: 'a' }, { place_id: 'b' }],
      next_page_token: 'TOKEN_SHOULD_BE_IGNORED',
    });

    const results = await getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant');

    expect(results).toHaveLength(2);
    // Pagination kaldırıldı → tam olarak 1 çağrı; pagetoken'lı 2. istek YOK.
    expect(mockHttpsGet).toHaveBeenCalledTimes(1);
    const calledUrl = mockHttpsGet.mock.calls[0][0];
    expect(calledUrl).not.toContain('pagetoken');
  });

  it('ZERO_RESULTS güvenle boş dizi döner', async () => {
    mockHttpsResponseOnce({ status: 'ZERO_RESULTS', results: [] });
    const results = await getNearbyRestaurants(41.0, 29.0, 5000, 'cafe');
    expect(results).toEqual([]);
    expect(mockHttpsGet).toHaveBeenCalledTimes(1);
  });
});
