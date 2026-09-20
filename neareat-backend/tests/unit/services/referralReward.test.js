'use strict';

// S18-3 — referral sertleştirme: davet eden yıldızı ertelenir ve koşullu/idempotent verilir.

const mockPrisma = {
  user: { findUnique: jest.fn() },
  starEvent: { findFirst: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const mockAwardStars = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/utils/stars', () => ({ awardStars: mockAwardStars }));

const mockCache = { cacheGet: jest.fn(), cacheSet: jest.fn().mockResolvedValue(undefined), cacheDel: jest.fn().mockResolvedValue(undefined) };
jest.mock('../../../src/services/redis', () => mockCache);

const { markPendingReferral, maybeAwardReferrer, pendingKey } = require('../../../src/services/referralReward');

beforeEach(() => jest.clearAllMocks());

describe('markPendingReferral', () => {
  it('bekleyen bağı Redis\'e TTL ile yazar', async () => {
    await markPendingReferral('referred-1', 'referrer-1');
    expect(mockCache.cacheSet).toHaveBeenCalledWith(pendingKey('referred-1'), 'referrer-1', expect.any(Number));
  });
});

describe('maybeAwardReferrer', () => {
  it('bekleyen bağ yoksa → ödül yok', async () => {
    mockCache.cacheGet.mockResolvedValue(null);
    await maybeAwardReferrer('referred-1');
    expect(mockAwardStars).not.toHaveBeenCalled();
  });

  it('bağ var ama davet edilen e-postası doğrulanmamış → ödül yok, bağ korunur', async () => {
    mockCache.cacheGet.mockResolvedValue('referrer-1');
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: false, displayName: 'Ali' });
    await maybeAwardReferrer('referred-1');
    expect(mockAwardStars).not.toHaveBeenCalled();
    expect(mockCache.cacheDel).not.toHaveBeenCalled();
  });

  it('bağ + doğrulanmış + önceden ödül yok → davet edene REFERRAL verir, bağı siler', async () => {
    mockCache.cacheGet.mockResolvedValue('referrer-1');
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: true, displayName: 'Ali' });
    mockPrisma.starEvent.findFirst.mockResolvedValue(null);
    await maybeAwardReferrer('referred-1');
    expect(mockAwardStars).toHaveBeenCalledWith('referrer-1', 'REFERRAL', expect.any(String), 'referred-1');
    expect(mockCache.cacheDel).toHaveBeenCalledWith(pendingKey('referred-1'));
  });

  it('idempotent: önceden REFERRAL verilmişse → tekrar vermez, bağı siler', async () => {
    mockCache.cacheGet.mockResolvedValue('referrer-1');
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: true, displayName: 'Ali' });
    mockPrisma.starEvent.findFirst.mockResolvedValue({ id: 'se-1' }); // zaten ödüllenmiş
    await maybeAwardReferrer('referred-1');
    expect(mockAwardStars).not.toHaveBeenCalled();
    expect(mockCache.cacheDel).toHaveBeenCalledWith(pendingKey('referred-1'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DB06 (#453) — ödül yazılamazsa bekleyen bağ TÜKETİLMEMELİ.
//
// Eskiden `awardStars(...).catch(() => {})` hatayı yutuyor, hemen ardından
// `cacheDel` koşulsuz çalışıyordu. Davet eden yıldızını alamıyor, bağ da
// silindiği için ikinci deneme imkânsız oluyordu — sessiz ve kalıcı kayıp.
// ─────────────────────────────────────────────────────────────────────────────
describe('maybeAwardReferrer — ödül başarısızlığında jeton tüketimi (DB06)', () => {
  beforeEach(() => {
    mockCache.cacheGet.mockResolvedValue('referrer-1');
    mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: true, displayName: 'Ali' });
    mockPrisma.starEvent.findFirst.mockResolvedValue(null);
  });

  it('T1 awardStars fırlatırsa bekleyen bağ SİLİNMEZ', async () => {
    mockAwardStars.mockRejectedValueOnce(new Error('deadlock detected'));

    await maybeAwardReferrer('referred-1');

    expect(mockAwardStars).toHaveBeenCalled();
    expect(mockCache.cacheDel).not.toHaveBeenCalled();
  });

  // Çağıranlar (reviewController, reservationService) fire-and-forget kullanıyor.
  it('T2 awardStars fırlatsa da fonksiyon hata FIRLATMAZ', async () => {
    mockAwardStars.mockRejectedValueOnce(new Error('connection pool timeout'));
    await expect(maybeAwardReferrer('referred-1')).resolves.toBeUndefined();
  });

  it('T3 awardStars başarılıysa bağ tüketilir', async () => {
    mockAwardStars.mockResolvedValueOnce(undefined);

    await maybeAwardReferrer('referred-1');

    expect(mockCache.cacheDel).toHaveBeenCalledWith(pendingKey('referred-1'));
  });

  // S3 uçtan uca: ilk nitelikli aksiyonda hata, ikincisinde başarı.
  it('T7 ilk denemede hata → bağ korunur → ikinci çağrıda ödül verilir', async () => {
    mockAwardStars.mockRejectedValueOnce(new Error('geçici'));
    await maybeAwardReferrer('referred-1');
    expect(mockCache.cacheDel).not.toHaveBeenCalled();

    // Bağ hâlâ Redis'te olduğu için sonraki aksiyon yeniden tetikler.
    mockAwardStars.mockResolvedValueOnce(undefined);
    await maybeAwardReferrer('referred-1');

    expect(mockAwardStars).toHaveBeenCalledTimes(2);
    expect(mockCache.cacheDel).toHaveBeenCalledWith(pendingKey('referred-1'));
  });

  it('T4 zaten ödüllendirilmişse ödül verilmez ama bağ temizlenir', async () => {
    mockPrisma.starEvent.findFirst.mockResolvedValue({ id: 'se-1' });

    await maybeAwardReferrer('referred-1');

    expect(mockAwardStars).not.toHaveBeenCalled();
    expect(mockCache.cacheDel).toHaveBeenCalledWith(pendingKey('referred-1'));
  });
});
