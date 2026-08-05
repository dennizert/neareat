'use strict';

/**
 * httpTimeout yardımcıları (S20-1) — saf, ağ yok.
 */

const { TimeoutError, withTimeout, readTimeoutEnv } = require('../../../src/utils/httpTimeout');

describe('TimeoutError', () => {
  it('ETIMEDOUT kodu taşır (retry kararı bunu kullanacak — S20-2)', () => {
    const err = new TimeoutError(8000, 'Test isteği');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.code).toBe('ETIMEDOUT');
    expect(err.timeoutMs).toBe(8000);
    expect(err.message).toContain('8000ms');
    expect(err.message).toContain('Test isteği');
  });
});

describe('readTimeoutEnv', () => {
  const ENV = 'TEST_TIMEOUT_ENV_VAR';
  afterEach(() => {
    delete process.env[ENV];
  });

  it('geçerli pozitif tamsayıyı okur', () => {
    process.env[ENV] = '1234';
    expect(readTimeoutEnv(ENV, 9999)).toBe(1234);
  });

  it('tanımsızsa varsayılana düşer', () => {
    expect(readTimeoutEnv(ENV, 9999)).toBe(9999);
  });

  it.each(['0', '-5', 'abc', ''])(
    'geçersiz değerde (%s) varsayılana düşer — korumasız kalmaz',
    (raw) => {
      process.env[ENV] = raw;
      expect(readTimeoutEnv(ENV, 9999)).toBe(9999);
    }
  );
});

describe('withTimeout', () => {
  it('süre dolmadan çözülen promise sonucunu aynen döndürür', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'X')).resolves.toBe('ok');
  });

  it('promise reddederse orijinal hatayı iletir (timeout hatası değil)', async () => {
    const original = new Error('sağlayıcı hatası');
    await expect(withTimeout(Promise.reject(original), 1000, 'X')).rejects.toBe(original);
  });

  it('süre dolduğunda TimeoutError ile reddeder', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 20, 'Yavaş çağrı')).rejects.toMatchObject({
      code: 'ETIMEDOUT',
      name: 'TimeoutError',
    });
  });

  it('timeoutMs geçersizse sarmalama yapmaz (promise aynen döner)', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 0, 'X')).resolves.toBe('ok');
  });

  it('timeout kazandıktan sonra gelen geç red, unhandled rejection üretmez', async () => {
    let rejectLate;
    const late = new Promise((_res, rej) => {
      rejectLate = rej;
    });

    const onUnhandled = jest.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      await expect(withTimeout(late, 10, 'Geç')).rejects.toMatchObject({ code: 'ETIMEDOUT' });
      rejectLate(new Error('çok geç geldi'));
      // Mikro/makro görev kuyruğunun boşalmasını bekle.
      await new Promise((r) => setTimeout(r, 30));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
