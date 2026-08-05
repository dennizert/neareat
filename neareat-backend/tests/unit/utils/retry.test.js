'use strict';

/**
 * Retry çekirdeği (S20-2) — saf, ağ yok, gerçek bekleme yok.
 * `sleep` ve `random` enjekte edildiği için testler deterministik ve hızlıdır.
 */

const {
  withRetry,
  computeBackoffMs,
  isTransientNetworkError,
} = require('../../../src/utils/retry');

/** Beklemeleri kaydeden sahte sleep — gerçek zaman harcamaz. */
function makeSleepSpy() {
  const waits = [];
  const sleep = jest.fn(async (ms) => {
    waits.push(ms);
  });
  return { sleep, waits };
}

const alwaysRetry = () => true;

describe('withRetry', () => {
  it('ilk deneme başarılıysa tek kez çağırır ve hiç beklemez', async () => {
    const { sleep } = makeSleepSpy();
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(withRetry(fn, { isRetryable: alwaysRetry, sleep })).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('geçici hatadan sonra başarılı olursa sonucu döndürür (çağıran hatayı görmez)', async () => {
    const { sleep, waits } = makeSleepSpy();
    const err = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    const fn = jest.fn().mockRejectedValueOnce(err).mockResolvedValue('ok');

    await expect(
      withRetry(fn, { isRetryable: isTransientNetworkError, sleep })
    ).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(2);
    expect(waits).toHaveLength(1);
  });

  it('tüm denemeler başarısızsa son hatayı fırlatır ve tam retries+1 kez dener', async () => {
    const { sleep } = makeSleepSpy();
    const fn = jest.fn().mockRejectedValue(new Error('kalıcı'));

    await expect(
      withRetry(fn, { retries: 2, isRetryable: alwaysRetry, sleep })
    ).rejects.toThrow('kalıcı');

    expect(fn).toHaveBeenCalledTimes(3); // 1 ilk + 2 yeniden deneme
    expect(sleep).toHaveBeenCalledTimes(2); // son denemeden sonra beklenmez
  });

  it('yeniden denenemez hatada HİÇ retry yapmaz, hatayı anında fırlatır', async () => {
    const { sleep } = makeSleepSpy();
    const fn = jest.fn().mockRejectedValue(new Error('kalıcı'));

    await expect(
      withRetry(fn, { retries: 5, isRetryable: () => false, sleep })
    ).rejects.toThrow('kalıcı');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('varsayılan isRetryable hiçbir şeyi denemez (güvenli varsayılan)', async () => {
    const { sleep } = makeSleepSpy();
    const fn = jest.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'ECONNRESET' }));

    await expect(withRetry(fn, { sleep })).rejects.toThrow('x');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries=0 ise tek deneme yapar', async () => {
    const { sleep } = makeSleepSpy();
    const fn = jest.fn().mockRejectedValue(new Error('x'));

    await expect(withRetry(fn, { retries: 0, isRetryable: alwaysRetry, sleep })).rejects.toThrow('x');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('beklemeler exponential artar ve maxDelayMs ile sınırlıdır', async () => {
    const { sleep, waits } = makeSleepSpy();
    const fn = jest.fn().mockRejectedValue(new Error('x'));

    await expect(
      withRetry(fn, {
        retries: 4,
        baseDelayMs: 100,
        maxDelayMs: 300,
        isRetryable: alwaysRetry,
        sleep,
        random: () => 1, // jitter tavanını ölç
      })
    ).rejects.toThrow('x');

    // 100, 200, 300(kırpıldı), 300(kırpıldı)
    expect(waits).toEqual([100, 200, 300, 300]);
    expect(Math.max(...waits)).toBeLessThanOrEqual(300);
  });
});

describe('computeBackoffMs — full jitter', () => {
  it('random=0 ise 0 döner (alt sınır)', () => {
    expect(
      computeBackoffMs(3, { baseDelayMs: 200, maxDelayMs: 2000, random: () => 0 })
    ).toBe(0);
  });

  it('random=1 ise exponential tavanı döner', () => {
    expect(
      computeBackoffMs(2, { baseDelayMs: 100, maxDelayMs: 5000, random: () => 1 })
    ).toBe(400); // 100 * 2^2
  });

  it('her zaman [0, maxDelayMs] aralığında kalır', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const ms = computeBackoffMs(attempt, {
        baseDelayMs: 200,
        maxDelayMs: 2000,
        random: Math.random,
      });
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThanOrEqual(2000);
    }
  });
});

describe('isTransientNetworkError', () => {
  it.each(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'])(
    '%s geçici sayılır',
    (code) => {
      expect(isTransientNetworkError(Object.assign(new Error('x'), { code }))).toBe(true);
    }
  );

  it('kod taşımayan hatalar geçici sayılmaz', () => {
    expect(isTransientNetworkError(new Error('düz hata'))).toBe(false);
    expect(isTransientNetworkError(new SyntaxError('bozuk json'))).toBe(false);
  });

  it('null/undefined güvenli', () => {
    expect(isTransientNetworkError(null)).toBe(false);
    expect(isTransientNetworkError(undefined)).toBe(false);
  });
});
