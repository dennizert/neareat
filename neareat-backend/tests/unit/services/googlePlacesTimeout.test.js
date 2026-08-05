'use strict';

/**
 * fetchJson zaman aşımı davranışı (S20-1).
 *
 * Rapor bulgusu: `https.get` zaman aşımsızdı — Google yanıt vermediğinde soket
 * süresiz asılı kalabiliyordu. Bu testler toplam süre bütçesinin uygulandığını,
 * soketin kapatıldığını ve çift-settle olmadığını doğrular. https + redis mock'lu.
 */

jest.mock('../../../src/services/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/metrics', () => ({ recordExternalCall: jest.fn() }));

const mockHttpsGet = jest.fn();
jest.mock('https', () => ({ get: (...args) => mockHttpsGet(...args) }));

// Modül yüklenmeden ÖNCE ayarlanmalı (env yükleme anında okunur).
process.env.GOOGLE_HTTP_TIMEOUT_MS = '40';
// Bu dosya YALNIZCA zaman aşımı semantiğini test eder; retry (S20-2) kapatılır ki
// deneme sayıları buradaki iddiaları bulandırmasın. Retry davranışı ayrı dosyada
// (googlePlacesRetry.test.js) test edilir.
process.env.GOOGLE_RETRY_MAX = '0';

const { getNearbyRestaurants } = require('../../../src/services/googlePlaces');

describe('fetchJson — zaman aşımı (S20-1)', () => {
  beforeEach(() => {
    mockHttpsGet.mockReset();
  });

  it('upstream hiç yanıt vermezse zaman aşımıyla reddeder ve soketi kapatır', async () => {
    const destroy = jest.fn();
    // Yanıt callback'i HİÇ çağrılmaz — asılı kalan bir istek.
    mockHttpsGet.mockImplementation(() => ({ on: jest.fn(), destroy }));

    await expect(getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant')).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });

    // Soket sızıntısı bırakılmamalı.
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('zaman aşımı sonrası gelen error olayı ikinci kez reddetmez (çift-settle yok)', async () => {
    const destroy = jest.fn();
    let errorHandler = null;
    mockHttpsGet.mockImplementation(() => ({
      on: (event, handler) => {
        if (event === 'error') errorHandler = handler;
      },
      destroy,
    }));

    const onUnhandled = jest.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      await expect(getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant')).rejects.toMatchObject({
        code: 'ETIMEDOUT',
      });

      // destroy() gerçek soketde ECONNRESET üretir — bu ikinci sinyal yutulmalı.
      expect(errorHandler).toBeInstanceOf(Function);
      expect(() => errorHandler(new Error('socket hang up'))).not.toThrow();

      await new Promise((r) => setTimeout(r, 20));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('süre dolmadan gelen normal yanıt etkilenmez (regresyon)', async () => {
    mockHttpsGet.mockImplementation((url, cb) => {
      const res = {
        on: (event, handler) => {
          if (event === 'data') handler(JSON.stringify({ status: 'OK', results: [{ place_id: 'x' }] }));
          if (event === 'end') handler();
          return res;
        },
      };
      cb(res);
      return { on: jest.fn(), destroy: jest.fn() };
    });

    const results = await getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant');
    expect(results).toEqual([{ place_id: 'x' }]);
  });

  it('bozuk JSON zaman aşımı hatası değil, parse hatası verir (ayırt edilebilir)', async () => {
    mockHttpsGet.mockImplementation((url, cb) => {
      const res = {
        on: (event, handler) => {
          if (event === 'data') handler('{bozuk json');
          if (event === 'end') handler();
          return res;
        },
      };
      cb(res);
      return { on: jest.fn(), destroy: jest.fn() };
    });

    const err = await getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant').catch((e) => e);
    expect(err).toBeInstanceOf(SyntaxError);
    expect(err.code).not.toBe('ETIMEDOUT');
  });
});
