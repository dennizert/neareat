'use strict';

/**
 * S16-2 — metrik kayıt defteri birim testleri (in-memory, saf).
 */

const metrics = require('../../../src/services/metrics');

beforeEach(() => metrics._reset());

describe('recordRequest + snapshot', () => {
  it('status kovaları doğru sayılır', () => {
    metrics.recordRequest(10, 200);
    metrics.recordRequest(10, 201);
    metrics.recordRequest(10, 404);
    metrics.recordRequest(10, 500);
    metrics.recordRequest(10, 503);
    const s = metrics.snapshot();
    expect(s.requests.status).toEqual({ '2xx': 2, '3xx': 0, '4xx': 1, '5xx': 2 });
    expect(s.requests.count).toBe(5);
    expect(s.requests.errorRate).toBeCloseTo(2 / 5, 4);
  });

  it('p50/p95/p99 makul hesaplanır', () => {
    for (let i = 1; i <= 100; i++) metrics.recordRequest(i, 200); // 1..100 ms
    const s = metrics.snapshot();
    expect(s.requests.p50).toBeGreaterThanOrEqual(48);
    expect(s.requests.p50).toBeLessThanOrEqual(52);
    expect(s.requests.p95).toBeGreaterThanOrEqual(94);
    expect(s.requests.p99).toBeGreaterThanOrEqual(98);
  });

  it('kayan pencere sınırlı — 1000 üstü örnek belleği şişirmez', () => {
    for (let i = 0; i < 1500; i++) metrics.recordRequest(5, 200);
    const s = metrics.snapshot();
    // count status sayacından gelir (toplam istek), pencere ise sınırlı kalır (p hesabı patlamaz)
    expect(s.requests.count).toBe(1500);
    expect(s.requests.p50).toBe(5);
  });

  it('boş durumda güvenli (count 0)', () => {
    const s = metrics.snapshot();
    expect(s.requests.count).toBe(0);
    expect(s.requests.errorRate).toBe(0);
    expect(s.redis.hitRate).toBeNull();
  });
});

describe('recordRedis', () => {
  it('isabet oranı doğru', () => {
    metrics.recordRedis(true);
    metrics.recordRedis(true);
    metrics.recordRedis(false);
    const s = metrics.snapshot();
    expect(s.redis).toMatchObject({ hits: 2, misses: 1 });
    expect(s.redis.hitRate).toBeCloseTo(2 / 3, 4);
  });
});

describe('recordExternalCall', () => {
  it('sağlayıcı bazında çağrı + maliyet toplanır', () => {
    metrics.recordExternalCall('anthropic', 0.01);
    metrics.recordExternalCall('anthropic', 0.02);
    metrics.recordExternalCall('google', 0.16);
    const s = metrics.snapshot();
    expect(s.external.anthropic).toEqual({ calls: 2, costUsd: expect.closeTo(0.03, 5) });
    expect(s.external.google).toEqual({ calls: 1, costUsd: expect.closeTo(0.16, 5) });
  });
});

describe('evaluateAlarms', () => {
  it('yeterli örnek + yüksek 5xx → errorRate ihlali', () => {
    for (let i = 0; i < 60; i++) metrics.recordRequest(5, i < 5 ? 500 : 200); // ~%8 hata
    const breaches = metrics.evaluateAlarms(metrics.snapshot(), { errorRate: 0.02, eventLoopLagMs: 9999, aiDailyUsd: 9999, googleDailyUsd: 9999 });
    expect(breaches.find((b) => b.metric === 'errorRate')).toBeTruthy();
  });

  it('az örnek varken errorRate alarmı üretmez (gürültü önleme)', () => {
    for (let i = 0; i < 10; i++) metrics.recordRequest(5, 500); // hepsi 5xx ama count<50
    const breaches = metrics.evaluateAlarms(metrics.snapshot(), { errorRate: 0.02, eventLoopLagMs: 9999, aiDailyUsd: 9999, googleDailyUsd: 9999 });
    expect(breaches.find((b) => b.metric === 'errorRate')).toBeUndefined();
  });

  it('AI günlük harcama eşiği aşımı → aiDailyUsd ihlali', () => {
    metrics.recordExternalCall('anthropic', 60);
    const breaches = metrics.evaluateAlarms(metrics.snapshot(), { errorRate: 1, eventLoopLagMs: 9999, aiDailyUsd: 50, googleDailyUsd: 9999 });
    expect(breaches.find((b) => b.metric === 'aiDailyUsd')).toMatchObject({ threshold: 50 });
  });

  it('eşik altında ihlal yok', () => {
    for (let i = 0; i < 60; i++) metrics.recordRequest(5, 200);
    metrics.recordExternalCall('anthropic', 1);
    const breaches = metrics.evaluateAlarms(metrics.snapshot(), { errorRate: 0.02, eventLoopLagMs: 9999, aiDailyUsd: 50, googleDailyUsd: 30 });
    expect(breaches).toHaveLength(0);
  });
});
