'use strict';

/**
 * AI günlük kotası — atomik rezervasyon.
 *
 * Yarış: kota sayacı AiRecommendationLog satırlarını sayıyor ama o satır LLM
 * çağrısından SONRA fire-and-forget yazılıyor → uçuştaki istekler birbirini görmüyor
 * ve aynı anda gelen N istek de geçip N× Claude faturası çıkarıyordu.
 */

const mockRedis = { incr: jest.fn(), expire: jest.fn(), decr: jest.fn() };
jest.mock('../../../src/services/redis', () => ({ getRedis: () => mockRedis }));

const { reserveDailySlot, releaseDailySlot, secondsUntilNextIstanbulMidnight } =
  require('../../../src/utils/aiDailyQuota');

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.expire.mockResolvedValue(1);
  mockRedis.decr.mockResolvedValue(0);
});

describe('reserveDailySlot', () => {
  it('limit içindeyken izin verir', async () => {
    mockRedis.incr.mockResolvedValue(1);
    await expect(reserveDailySlot('u-1', 5)).resolves.toMatchObject({ allowed: true, used: 1 });
  });

  it('limitin tam sınırında hâlâ izin verir (used === limit)', async () => {
    mockRedis.incr.mockResolvedValue(5);
    await expect(reserveDailySlot('u-1', 5)).resolves.toMatchObject({ allowed: true, used: 5 });
  });

  it('limit aşıldığında reddeder', async () => {
    mockRedis.incr.mockResolvedValue(6);
    await expect(reserveDailySlot('u-1', 5)).resolves.toMatchObject({ allowed: false, used: 6 });
  });

  // Yarışın kapandığının asıl kanıtı: sayaç atomik olarak artıyor, yani eşzamanlı
  // isteklere farklı sıra numaraları düşüyor ve yalnızca ilk N tanesi geçiyor.
  it('eşzamanlı isteklerde yalnızca limit kadarı geçer', async () => {
    let counter = 0;
    mockRedis.incr.mockImplementation(async () => ++counter);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => reserveDailySlot('u-1', 3)),
    );

    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(results.filter((r) => !r.allowed)).toHaveLength(5);
  });

  it('sınırsız (limit null) için sayaç HİÇ artırılmaz', async () => {
    await expect(reserveDailySlot('u-1', null)).resolves.toMatchObject({ allowed: true });
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('yalnızca ilk artışta TTL kurulur', async () => {
    mockRedis.incr.mockResolvedValue(1);
    await reserveDailySlot('u-1', 5);
    expect(mockRedis.expire).toHaveBeenCalledTimes(1);

    mockRedis.incr.mockResolvedValue(2);
    await reserveDailySlot('u-1', 5);
    expect(mockRedis.expire).toHaveBeenCalledTimes(1); // artmadı
  });

  it('anahtar İstanbul gününe göre ayrılır (kullanıcı başına)', async () => {
    mockRedis.incr.mockResolvedValue(1);
    await reserveDailySlot('u-42', 5);
    expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringMatching(/^ai-used:u-42:\d{4}-\d{2}-\d{2}$/));
  });

  // Günlük kota için fail-OPEN doğrusu: Redis çökünce herkesi AI'dan kilitlemek yerine
  // mevcut DB kontrolüne düşülür. Maliyet freni olarak dakikalık aiRateLimit fail-closed.
  it('Redis hata verirse izin verir ve degraded işaretler', async () => {
    mockRedis.incr.mockRejectedValue(new Error('redis down'));
    await expect(reserveDailySlot('u-1', 1)).resolves.toMatchObject({ allowed: true, degraded: true });
  });

  it('INCR sayı dönmezse bloklamaz (bozuk istemciye karşı)', async () => {
    mockRedis.incr.mockResolvedValue(undefined);
    await expect(reserveDailySlot('u-1', 1)).resolves.toMatchObject({ allowed: true, degraded: true });
  });
});

describe('releaseDailySlot', () => {
  it('sayacı geri azaltır', async () => {
    await releaseDailySlot('u-1');
    expect(mockRedis.decr).toHaveBeenCalledWith(expect.stringContaining('ai-used:u-1:'));
  });

  it('Redis hatası akışı bozmaz', async () => {
    mockRedis.decr.mockRejectedValue(new Error('redis down'));
    await expect(releaseDailySlot('u-1')).resolves.toBeUndefined();
  });
});

describe('secondsUntilNextIstanbulMidnight', () => {
  it('bir günü aşmaz ve makul bir alt sınırın üstündedir', () => {
    const s = secondsUntilNextIstanbulMidnight(new Date('2026-09-19T12:00:00Z'));
    expect(s).toBeGreaterThan(60);
    expect(s).toBeLessThanOrEqual(24 * 60 * 60 + 1);
  });
});
