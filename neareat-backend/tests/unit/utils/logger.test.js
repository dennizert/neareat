'use strict';

/**
 * Logger + istek bağlamı korelasyonu (S21-2).
 *
 * Kritik davranış: bağlam kaybı bir HATA DEĞİL, zarif düşüştür — log satırı yine yazılır,
 * yalnızca korelasyon kimliği olmadan. Bir logun kaybolması, kimliğin kaybolmasından kötüdür.
 */

const logger = require('../../../src/utils/logger');
const {
  runWithContext,
  runWithJobContext,
  getRequestId,
  getJobName,
} = require('../../../src/utils/requestContext');

// Testlerde logger varsayılan olarak sessizdir; bu dosyada çıktıyı görebilmek için açılır.
const prevEnv = process.env.LOG_IN_TESTS;

let entries;
beforeEach(() => {
  process.env.LOG_IN_TESTS = 'true';
  entries = [];
  logger.setSink((level, entry) => entries.push({ level, ...entry }));
});

afterEach(() => {
  logger.setSink(null);
  if (prevEnv === undefined) delete process.env.LOG_IN_TESTS;
  else process.env.LOG_IN_TESTS = prevEnv;
});

describe('logger — temel davranış', () => {
  it.each(['debug', 'info', 'warn', 'error'])('%s seviyesi yazılır', (level) => {
    logger[level]('mesaj');
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe(level);
    expect(entries[0].message).toBe('mesaj');
    expect(entries[0].time).toEqual(expect.any(String));
  });

  it('meta verilmezse entry meta alanı taşımaz', () => {
    logger.info('mesaj');
    expect(entries[0]).not.toHaveProperty('meta');
  });

  it('sink patlarsa uygulama düşmez', () => {
    logger.setSink(() => {
      throw new Error('sink bozuk');
    });
    expect(() => logger.error('yine de çağrılabilmeli')).not.toThrow();
  });
});

describe('logger — istek bağlamı korelasyonu', () => {
  it('istek bağlamı içinde requestId otomatik eklenir', () => {
    runWithContext({ requestId: 'req-123' }, () => {
      logger.info('istek yolunda bir log');
    });
    expect(entries[0].requestId).toBe('req-123');
  });

  it('bağlam async sınırları aşar (await zinciri boyunca korunur)', async () => {
    await runWithContext({ requestId: 'req-async' }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      await Promise.resolve();
      logger.info('async iş sonrası');
      expect(getRequestId()).toBe('req-async');
    });
    expect(entries[0].requestId).toBe('req-async');
  });

  it('SSE benzeri uzun akışta bağlam korunur (ardışık chunk logları)', async () => {
    await runWithContext({ requestId: 'req-sse' }, async () => {
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 1));
        logger.info(`chunk ${i}`);
      }
    });
    expect(entries.map((e) => e.requestId)).toEqual(['req-sse', 'req-sse', 'req-sse']);
  });

  it('bağlam YOKSA log yine yazılır, sadece requestId taşımaz (zarif düşüş)', () => {
    logger.warn('bağlamsız log');
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty('requestId');
  });

  it('job bağlamı `job` alanıyla etiketlenir, çökme olmaz', () => {
    runWithJobContext('seasonReset', () => {
      logger.info('cron çalışıyor');
      expect(getJobName()).toBe('seasonReset');
      expect(getRequestId()).toBeNull();
    });
    expect(entries[0].job).toBe('seasonReset');
    expect(entries[0]).not.toHaveProperty('requestId');
  });

  it('iç içe bağlamlar birbirine sızmaz', () => {
    runWithContext({ requestId: 'dis' }, () => {
      runWithContext({ requestId: 'ic' }, () => logger.info('ic log'));
      logger.info('dis log');
    });
    expect(entries.map((e) => e.requestId)).toEqual(['ic', 'dis']);
  });
});

describe('logger — hassas alan maskeleme', () => {
  it.each([
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'apiKey',
    'authorization',
    'secret',
  ])('%s alanı maskelenir', (key) => {
    logger.info('mesaj', { [key]: 'gizli-deger' });
    expect(entries[0].meta[key]).toBe('[REDACTED]');
  });

  it('iç içe nesnelerde de maskeler', () => {
    logger.info('mesaj', { user: { id: 'u1', passwordHash: 'gizli' } });
    expect(entries[0].meta.user.id).toBe('u1');
    expect(entries[0].meta.user.passwordHash).toBe('[REDACTED]');
  });

  it('hassas olmayan alanlar korunur', () => {
    logger.info('mesaj', { userId: 'u1', status: 500, latencyMs: 42 });
    expect(entries[0].meta).toMatchObject({ userId: 'u1', status: 500, latencyMs: 42 });
  });

  it('dizilerde de maskeler', () => {
    logger.info('mesaj', { items: [{ token: 'abc' }] });
    expect(entries[0].meta.items[0].token).toBe('[REDACTED]');
  });
});

describe('logger — test ortamında sessizlik', () => {
  it('LOG_IN_TESTS ayarlı değilken hiçbir şey yazmaz (CI gürültüsü olmaz)', () => {
    delete process.env.LOG_IN_TESTS;
    logger.info('bu görünmemeli');
    expect(entries).toHaveLength(0);
  });
});
