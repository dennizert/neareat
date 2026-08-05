'use strict';

/**
 * Google Places retry entegrasyonu (S20-2).
 *
 * Doğrulananlar: geçici hatalarda yeniden deneme, KALICI hatalarda (REQUEST_DENIED /
 * OVER_QUERY_LIMIT) hiç denememe, maliyet metriğinin retry'dan etkilenmemesi ve
 * denemeler tükendiğinde çağrı yerinin mevcut davranışının korunması.
 */

jest.mock('../../../src/services/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/metrics', () => ({ recordExternalCall: jest.fn() }));

const mockHttpsGet = jest.fn();
jest.mock('https', () => ({ get: (...args) => mockHttpsGet(...args) }));

// Modül yüklenmeden ÖNCE ayarlanmalı. Retry sayısı açıkça verilir (varsayılana
// güvenilmez): başka bir test dosyası aynı worker'da env'i değiştirmiş olabilir.
process.env.GOOGLE_HTTP_TIMEOUT_MS = '50';
process.env.GOOGLE_RETRY_MAX = '2';

const { getNearbyRestaurants } = require('../../../src/services/googlePlaces');
const { recordExternalCall } = require('../../../src/services/metrics');

/** Sıradaki https.get çağrısını verilen JSON gövdesiyle (ve HTTP statüsüyle) çözer. */
function queueJsonResponse(jsonBody, statusCode = 200) {
  mockHttpsGet.mockImplementationOnce((url, cb) => {
    const res = {
      statusCode,
      on: (event, handler) => {
        if (event === 'data') handler(JSON.stringify(jsonBody));
        if (event === 'end') handler();
        return res;
      },
    };
    cb(res);
    return { on: jest.fn(), destroy: jest.fn() };
  });
}

/** Sıradaki https.get çağrısını ağ hatasıyla reddeder. */
function queueNetworkError(code) {
  mockHttpsGet.mockImplementationOnce(() => {
    const req = {
      on: (event, handler) => {
        if (event === 'error') {
          setImmediate(() => handler(Object.assign(new Error(code), { code })));
        }
        return req;
      },
      destroy: jest.fn(),
    };
    return req;
  });
}

const OK_BODY = { status: 'OK', results: [{ place_id: 'p1' }] };

describe('Google Places retry (S20-2)', () => {
  beforeEach(() => {
    mockHttpsGet.mockReset();
    recordExternalCall.mockClear();
  });

  it('geçici ağ hatasından sonra ikinci denemede başarılı olur', async () => {
    queueNetworkError('ECONNRESET');
    queueJsonResponse(OK_BODY);

    const results = await getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant');

    expect(results).toEqual([{ place_id: 'p1' }]);
    expect(mockHttpsGet).toHaveBeenCalledTimes(2);
  });

  it('retry olsa bile maliyet metriği YALNIZCA bir kez işlenir', async () => {
    queueNetworkError('ECONNRESET');
    queueNetworkError('ETIMEDOUT');
    queueJsonResponse(OK_BODY);

    await getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant');

    expect(mockHttpsGet).toHaveBeenCalledTimes(3);
    // 3 gerçek HTTP denemesi yapıldı ama faturalanabilir başarılı çağrı 1 tane.
    expect(recordExternalCall).toHaveBeenCalledTimes(1);
    expect(recordExternalCall).toHaveBeenCalledWith('google', expect.any(Number));
  });

  it('upstream 5xx yeniden denenir', async () => {
    queueJsonResponse({ error: 'boom' }, 503);
    queueJsonResponse(OK_BODY);

    const results = await getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant');

    expect(results).toEqual([{ place_id: 'p1' }]);
    expect(mockHttpsGet).toHaveBeenCalledTimes(2);
  });

  it('UNKNOWN_ERROR yeniden denenir', async () => {
    queueJsonResponse({ status: 'UNKNOWN_ERROR' });
    queueJsonResponse(OK_BODY);

    const results = await getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant');

    expect(results).toEqual([{ place_id: 'p1' }]);
    expect(mockHttpsGet).toHaveBeenCalledTimes(2);
  });

  it('UNKNOWN_ERROR denemeler tükenince çağrı yerinin MEVCUT hatasını verir', async () => {
    queueJsonResponse({ status: 'UNKNOWN_ERROR' });
    queueJsonResponse({ status: 'UNKNOWN_ERROR' });
    queueJsonResponse({ status: 'UNKNOWN_ERROR' });

    // Gövde çağırana geri verilir → status kontrolü bugünkü mesajı üretir.
    await expect(getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant')).rejects.toThrow(
      'Google Places Nearby Search error: UNKNOWN_ERROR'
    );
    expect(mockHttpsGet).toHaveBeenCalledTimes(3); // 1 + 2 yeniden deneme
  });

  it.each(['REQUEST_DENIED', 'OVER_QUERY_LIMIT', 'INVALID_REQUEST'])(
    '%s KALICI hatadır — hiç yeniden denenmez',
    async (status) => {
      queueJsonResponse({ status });

      await expect(getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant')).rejects.toThrow(status);
      // Kota/kimlik sorununu tekrarlamak yalnızca maliyeti çarpar.
      expect(mockHttpsGet).toHaveBeenCalledTimes(1);
    }
  );

  it('ZERO_RESULTS geçerli sonuçtur — retry tetiklemez', async () => {
    queueJsonResponse({ status: 'ZERO_RESULTS', results: [] });

    const results = await getNearbyRestaurants(41.0, 29.0, 5000, 'cafe');

    expect(results).toEqual([]);
    expect(mockHttpsGet).toHaveBeenCalledTimes(1);
  });

  it('bozuk JSON kalıcı hatadır — yeniden denenmez', async () => {
    mockHttpsGet.mockImplementation((url, cb) => {
      const res = {
        statusCode: 200,
        on: (event, handler) => {
          if (event === 'data') handler('{bozuk');
          if (event === 'end') handler();
          return res;
        },
      };
      cb(res);
      return { on: jest.fn(), destroy: jest.fn() };
    });

    await expect(getNearbyRestaurants(41.0, 29.0, 5000, 'restaurant')).rejects.toBeInstanceOf(
      SyntaxError
    );
    expect(mockHttpsGet).toHaveBeenCalledTimes(1);
  });
});

describe('GOOGLE_RETRY_MAX=0 — retry tamamen kapatılabilir', () => {
  let isolatedGet;
  let getNearby;

  beforeAll(() => {
    jest.resetModules();
    process.env.GOOGLE_RETRY_MAX = '0';

    isolatedGet = jest.fn();
    jest.doMock('https', () => ({ get: (...args) => isolatedGet(...args) }));
    jest.doMock('../../../src/services/redis', () => ({
      cacheGet: jest.fn().mockResolvedValue(null),
      cacheSet: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('../../../src/services/metrics', () => ({ recordExternalCall: jest.fn() }));

    getNearby = require('../../../src/services/googlePlaces').getNearbyRestaurants;
  });

  afterAll(() => {
    // Env worker genelinde paylaşıldığı için sonraki dosyalara sızmasın diye geri al.
    process.env.GOOGLE_RETRY_MAX = '2';
    jest.resetModules();
  });

  it('geçici hata bile olsa tek deneme yapar (mevcut davranışa dönüş)', async () => {
    isolatedGet.mockImplementation(() => {
      const req = {
        on: (event, handler) => {
          if (event === 'error') {
            setImmediate(() => handler(Object.assign(new Error('reset'), { code: 'ECONNRESET' })));
          }
          return req;
        },
        destroy: jest.fn(),
      };
      return req;
    });

    await expect(getNearby(41.0, 29.0, 5000, 'restaurant')).rejects.toMatchObject({
      code: 'ECONNRESET',
    });
    expect(isolatedGet).toHaveBeenCalledTimes(1);
  });
});
