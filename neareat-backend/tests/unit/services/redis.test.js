'use strict';

/**
 * #485 — redis.js daha önce hiç test edilmemişti. Tüm job'lar ve controller'lar
 * idempotency/cache için bu katmanı kullanıyor; kasıtlı olarak fail-open
 * tasarlanmış — Redis hata verirse hiçbir exception fırlatmadan sessizce
 * devre dışı kalması gerekiyor. Bu, tam olarak #429'u tetikleyen "sessiz
 * başarısızlık" deseni: bir regresyon burada kullanıcıya hiç görünmeden geçer.
 */

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  pipeline: jest.fn(),
  on: jest.fn(),
};
jest.mock('ioredis', () => jest.fn(() => mockRedisClient));

const mockRecordRedis = jest.fn();
jest.mock('../../../src/services/metrics', () => ({ recordRedis: (...a) => mockRecordRedis(...a) }));

const { cacheGet, cacheSet, cacheDel, cacheSetMany } = require('../../../src/services/redis');

beforeEach(() => jest.clearAllMocks());

describe('cacheGet', () => {
  it('geçerli JSON varsa parse edip döner, hit olarak sayar', async () => {
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ a: 1 }));
    const result = await cacheGet('k1');
    expect(result).toEqual({ a: 1 });
    expect(mockRecordRedis).toHaveBeenCalledWith(true);
  });

  it('key yoksa (null) ıska olarak sayar, null döner', async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);
    const result = await cacheGet('k1');
    expect(result).toBeNull();
    expect(mockRecordRedis).toHaveBeenCalledWith(false);
  });

  it('Redis client hata fırlatırsa throw etmez, null döner', async () => {
    mockRedisClient.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(cacheGet('k1')).resolves.toBeNull();
    // Redis hatası ıska sayılmaz — metrik hiç çağrılmamalı
    expect(mockRecordRedis).not.toHaveBeenCalled();
  });
});

describe('cacheSet', () => {
  it('değeri JSON.stringify edip doğru TTL ile EX seçeneğiyle yazar', async () => {
    mockRedisClient.set.mockResolvedValueOnce('OK');
    await cacheSet('k1', { a: 1 }, 60);
    expect(mockRedisClient.set).toHaveBeenCalledWith('k1', JSON.stringify({ a: 1 }), 'EX', 60);
  });

  it('Redis hata verirse throw etmez', async () => {
    mockRedisClient.set.mockRejectedValueOnce(new Error('down'));
    await expect(cacheSet('k1', {}, 60)).resolves.toBeUndefined();
  });
});

describe('cacheDel', () => {
  it('doğru key ile silme çağırır', async () => {
    mockRedisClient.del.mockResolvedValueOnce(1);
    await cacheDel('k1');
    expect(mockRedisClient.del).toHaveBeenCalledWith('k1');
  });

  it('Redis hata verirse throw etmez', async () => {
    mockRedisClient.del.mockRejectedValueOnce(new Error('down'));
    await expect(cacheDel('k1')).resolves.toBeUndefined();
  });
});

describe('cacheSetMany', () => {
  it('boş/eksik dizi verilirse hiçbir şey yapmaz', async () => {
    await cacheSetMany([], 60);
    await cacheSetMany(undefined, 60);
    expect(mockRedisClient.pipeline).not.toHaveBeenCalled();
  });

  it('birden fazla girdiyi TEK pipeline ile yazıp exec eder', async () => {
    const mockPipeline = { set: jest.fn(), exec: jest.fn().mockResolvedValue([]) };
    mockRedisClient.pipeline.mockReturnValueOnce(mockPipeline);

    await cacheSetMany([{ key: 'k1', value: { a: 1 } }, { key: 'k2', value: { b: 2 } }], 120);

    expect(mockRedisClient.pipeline).toHaveBeenCalledTimes(1);
    expect(mockPipeline.set).toHaveBeenCalledWith('k1', JSON.stringify({ a: 1 }), 'EX', 120);
    expect(mockPipeline.set).toHaveBeenCalledWith('k2', JSON.stringify({ b: 2 }), 'EX', 120);
    expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
  });

  it('pipeline hata verirse throw etmez', async () => {
    const mockPipeline = { set: jest.fn(), exec: jest.fn().mockRejectedValue(new Error('down')) };
    mockRedisClient.pipeline.mockReturnValueOnce(mockPipeline);
    await expect(cacheSetMany([{ key: 'k1', value: 1 }], 60)).resolves.toBeUndefined();
  });
});
