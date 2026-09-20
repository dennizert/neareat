'use strict';

/**
 * #487 — googlePlaces.js'in daha önce test edilmeyen 5 fonksiyonu:
 * getNearbyRestaurantsFast, searchPlacesByText, getPlaceDetails,
 * getRouteWaypoints, isOpenAtTime. Mevcut googlePlaces*.test.js dosyaları
 * yalnızca getNearbyRestaurants + fetchGoogleJson'ın retry/timeout davranışını
 * ve kalite filtresini kapsıyor.
 */

jest.mock('../../../src/services/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/metrics', () => ({ recordExternalCall: jest.fn() }));

const mockHttpsGet = jest.fn();
jest.mock('https', () => ({ get: (...args) => mockHttpsGet(...args) }));

const {
  getNearbyRestaurantsFast,
  searchPlacesByText,
  getPlaceDetails,
  getRouteWaypoints,
  isOpenAtTime,
} = require('../../../src/services/googlePlaces');
const { cacheGet, cacheSet } = require('../../../src/services/redis');

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
    return { on: () => ({}) };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  cacheGet.mockResolvedValue(null);
  cacheSet.mockResolvedValue(undefined);
});

describe('getNearbyRestaurantsFast', () => {
  it('cache hit’te Google’a hiç istek atmadan cache’teki sonucu döner', async () => {
    cacheGet.mockResolvedValueOnce([{ place_id: 'cached' }]);
    const result = await getNearbyRestaurantsFast(41, 29, 'cafe');
    expect(result).toEqual([{ place_id: 'cached' }]);
    expect(mockHttpsGet).not.toHaveBeenCalled();
  });

  it('cache miss’te Google’a gider ve nearbyFast: anahtarıyla cache’e yazar', async () => {
    mockHttpsResponseOnce({ status: 'OK', results: [{ place_id: 'p1' }] });
    const result = await getNearbyRestaurantsFast(41.123, 29.456, 'restaurant');
    expect(result).toEqual([{ place_id: 'p1' }]);
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringContaining('nearbyFast:41.123:29.456:restaurant'),
      [{ place_id: 'p1' }],
      expect.any(Number),
    );
  });

  it('status OK/ZERO_RESULTS dışıysa throw eder', async () => {
    mockHttpsResponseOnce({ status: 'INVALID_REQUEST' });
    await expect(getNearbyRestaurantsFast(41, 29)).rejects.toThrow('INVALID_REQUEST');
  });
});

describe('searchPlacesByText', () => {
  it('boş/whitespace query ile erken [] döner, Google’a hiç gitmez', async () => {
    expect(await searchPlacesByText('   ')).toEqual([]);
    expect(await searchPlacesByText('')).toEqual([]);
    expect(mockHttpsGet).not.toHaveBeenCalled();
  });

  it('lat/lng verilmezse URL’e location/radius eklenmez', async () => {
    mockHttpsResponseOnce({ status: 'OK', results: [] });
    await searchPlacesByText('kebap');
    const url = mockHttpsGet.mock.calls[0][0];
    expect(url).not.toContain('location=');
    expect(url).not.toContain('radius=');
  });

  it('lat/lng verilirse location+radius=25000 eklenir', async () => {
    mockHttpsResponseOnce({ status: 'OK', results: [] });
    await searchPlacesByText('kebap', 41, 29);
    const url = mockHttpsGet.mock.calls[0][0];
    expect(url).toContain('location=41,29');
    expect(url).toContain('radius=25000');
  });

  it('status OK/ZERO_RESULTS dışıysa throw eder', async () => {
    mockHttpsResponseOnce({ status: 'REQUEST_DENIED' });
    await expect(searchPlacesByText('kebap')).rejects.toThrow('REQUEST_DENIED');
  });
});

describe('getPlaceDetails', () => {
  it('cache hit’te Google’a gitmez', async () => {
    cacheGet.mockResolvedValueOnce({ name: 'cached' });
    const result = await getPlaceDetails('p1');
    expect(result).toEqual({ name: 'cached' });
    expect(mockHttpsGet).not.toHaveBeenCalled();
  });

  it('cache miss’te sonucu döner ve place: anahtarıyla cache’e yazar', async () => {
    mockHttpsResponseOnce({ status: 'OK', result: { name: 'Lokanta' } });
    const result = await getPlaceDetails('p1');
    expect(result).toEqual({ name: 'Lokanta' });
    expect(cacheSet).toHaveBeenCalledWith('place:p1', { name: 'Lokanta' }, expect.any(Number));
  });

  it('status !== OK ise throw eder', async () => {
    mockHttpsResponseOnce({ status: 'NOT_FOUND' });
    await expect(getPlaceDetails('p1')).rejects.toThrow('NOT_FOUND');
  });
});

describe('getRouteWaypoints', () => {
  function step(distanceValue, lat, lng) {
    return { distance: { value: distanceValue }, end_location: { lat, lng } };
  }

  it('status !== OK veya routes boşsa null döner', async () => {
    mockHttpsResponseOnce({ status: 'ZERO_RESULTS', routes: [] });
    expect(await getRouteWaypoints(1, 2, 3, 4)).toBeNull();
  });

  it('≤20km rotada 1 waypoint, zoneIndex null', async () => {
    // 10km toplam — tek uzun step yeterli (0.5 hedefine ilk stepte ulaşılır).
    mockHttpsResponseOnce({
      status: 'OK',
      routes: [{ legs: [{ distance: { value: 10000 }, duration: { value: 600 }, steps: [step(10000, 10, 20)] }] }],
    });

    const result = await getRouteWaypoints(0, 0, 1, 1);

    expect(result.waypoints).toHaveLength(1);
    expect(result.waypoints[0]).toMatchObject({ lat: 10, lng: 20, zoneIndex: null });
    expect(result.isLongRoute).toBe(false);
    expect(result.zoneCount).toBe(0);
    expect(result.totalDistanceKm).toBe(10);
  });

  it('20-300km rotada 3 waypoint (%25/%50/%75), hepsi zoneIndex null', async () => {
    // 100km toplam, 4x25km step.
    const steps = [step(25000, 1, 10), step(25000, 2, 20), step(25000, 3, 30), step(25000, 4, 40)];
    mockHttpsResponseOnce({
      status: 'OK',
      routes: [{ legs: [{ distance: { value: 100000 }, duration: { value: 6000 }, steps }] }],
    });

    const result = await getRouteWaypoints(0, 0, 1, 1);

    expect(result.waypoints).toHaveLength(3);
    expect(result.waypoints.map((w) => w.zoneIndex)).toEqual([null, null, null]);
    expect(result.waypoints.map((w) => `${w.lat},${w.lng}`)).toEqual(['1,10', '2,20', '3,30']);
    expect(result.isLongRoute).toBe(false);
    expect(result.zoneCount).toBe(0);
  });

  it('≥300km rotada 3 waypoint, zoneIndex sırasıyla 1/2/3, isLongRoute true', async () => {
    // 300km toplam, 6x50km step.
    const steps = [
      step(50000, 1, 10), step(50000, 2, 20), step(50000, 3, 30),
      step(50000, 4, 40), step(50000, 5, 50), step(50000, 6, 60),
    ];
    mockHttpsResponseOnce({
      status: 'OK',
      routes: [{ legs: [{ distance: { value: 300000 }, duration: { value: 18000 }, steps }] }],
    });

    const result = await getRouteWaypoints(0, 0, 1, 1);

    expect(result.isLongRoute).toBe(true);
    expect(result.zoneCount).toBe(3);
    expect(result.waypoints).toHaveLength(3);
    expect(result.waypoints.map((w) => w.zoneIndex)).toEqual([1, 2, 3]);
  });
});

describe('isOpenAtTime', () => {
  it('periods yoksa/boşsa null döner', () => {
    expect(isOpenAtTime(null, 1, '1200')).toBeNull();
    expect(isOpenAtTime([], 1, '1200')).toBeNull();
  });

  it('24/7 (tek periyot, close yok) her zaman true', () => {
    const periods = [{ open: { day: 0, time: '0000' } }];
    expect(isOpenAtTime(periods, 3, '0300')).toBe(true);
    expect(isOpenAtTime(periods, 6, '2359')).toBe(true);
  });

  it('aynı gün açılıp kapanan periyotta pencere içi true, dışı false', () => {
    const periods = [{ open: { day: 1, time: '0900' }, close: { day: 1, time: '2200' } }];
    expect(isOpenAtTime(periods, 1, '1000')).toBe(true);
    expect(isOpenAtTime(periods, 1, '2300')).toBe(false);
    expect(isOpenAtTime(periods, 2, '1000')).toBe(false); // farklı gün
  });

  it('gece yarısını geçen periyotta hem gece hem sabah tarafında true, gündüz false', () => {
    // Cuma 22:00 → Cumartesi 02:00
    const periods = [{ open: { day: 5, time: '2200' }, close: { day: 6, time: '0200' } }];
    expect(isOpenAtTime(periods, 5, '2300')).toBe(true);  // Cuma gece
    expect(isOpenAtTime(periods, 6, '0100')).toBe(true);  // Cumartesi sabaha karşı
    expect(isOpenAtTime(periods, 5, '1000')).toBe(false); // Cuma gündüz (henüz açılmadı)
    expect(isOpenAtTime(periods, 6, '0300')).toBe(false); // Cumartesi kapandıktan sonra
  });
});
