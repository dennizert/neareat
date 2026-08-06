'use strict';

/**
 * socialService birim testleri (S22-2).
 *
 * Odak: refactor sırasında sessizce bozulabilecek kurallar — yıldız kazanımı (S18 seviye
 * zinciri buna bağlı), arkadaşlık durum geçişleri, gizli profil görünürlüğü ve çok alıcılı
 * öneri gönderiminin ATOMİK kalması.
 */

jest.mock('../../../src/utils/prisma', () => ({
  friendRequest: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  user: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  recommendation: { count: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  starEvent: { findFirst: jest.fn(), findMany: jest.fn() },
  reward: { findMany: jest.fn() },
  userReward: { findMany: jest.fn() },
  userReport: { findFirst: jest.fn(), create: jest.fn() },
  notification: { findFirst: jest.fn() },
  activityEvent: { findMany: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../../../src/utils/stars', () => ({
  awardStars: jest.fn().mockResolvedValue({ event: { id: 'ev-1' }, newStarCount: 10, newRewards: [] }),
  getLevel: jest.fn(() => ({ level: 2, levelName: 'L2' })),
}));
jest.mock('../../../src/utils/starGuards', () => ({ canEarnPlaceStars: jest.fn() }));
jest.mock('../../../src/utils/premiumCheck', () => ({ isPremiumUser: jest.fn() }));
jest.mock('../../../src/services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  createNotificationsForUsers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/logService', () => ({
  logActivity: jest.fn(),
  ACTIVITY_TYPES: { RECOMMENDATION: 'RECOMMENDATION' },
}));
jest.mock('../../../src/services/friendSuggestionService', () => ({
  getCachedSuggestions: jest.fn(),
  computeSuggestionsForUser: jest.fn(),
  invalidateSuggestions: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../../src/utils/prisma');
const { awardStars } = require('../../../src/utils/stars');
const { canEarnPlaceStars } = require('../../../src/utils/starGuards');
const { isPremiumUser } = require('../../../src/utils/premiumCheck');
const { logActivity } = require('../../../src/services/logService');
const svc = require('../../../src/services/socialService');
const { HttpError } = require('../../../src/utils/httpError');

const ACTOR = { id: 'u-1', displayName: 'Deniz', starCount: 100 };

beforeEach(() => {
  jest.clearAllMocks();
  isPremiumUser.mockResolvedValue(false);
  awardStars.mockResolvedValue({ event: { id: 'ev-1' }, newStarCount: 10, newRewards: [] });
});

async function expectHttpError(promise, status, bodyMatch) {
  const err = await promise.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(HttpError);
  expect(err.status).toBe(status);
  if (bodyMatch) expect(err.body).toMatchObject(bodyMatch);
  return err;
}

describe('rateRestaurant — S18-3 farming önleme', () => {
  beforeEach(() => prisma.starEvent.findFirst.mockResolvedValue(null));

  it('doğrulanmış ziyaret yoksa 403 VISIT_REQUIRED ve yıldız VERİLMEZ', async () => {
    canEarnPlaceStars.mockResolvedValue({ visited: false, underCap: true });
    await expectHttpError(
      svc.rateRestaurant(ACTOR.id, { placeId: 'p1', placeName: 'Test' }),
      403,
      { code: 'VISIT_REQUIRED' },
    );
    expect(awardStars).not.toHaveBeenCalled();
  });

  it('günlük tavan dolduysa 429 ve yıldız VERİLMEZ', async () => {
    canEarnPlaceStars.mockResolvedValue({ visited: true, underCap: false });
    await expectHttpError(svc.rateRestaurant(ACTOR.id, { placeId: 'p1', placeName: 'Test' }), 429);
    expect(awardStars).not.toHaveBeenCalled();
  });

  it('24 saat içinde aynı yere ikinci puanlama 429', async () => {
    prisma.starEvent.findFirst.mockResolvedValue({ id: 'prev' });
    await expectHttpError(svc.rateRestaurant(ACTOR.id, { placeId: 'p1', placeName: 'Test' }), 429);
    expect(canEarnPlaceStars).not.toHaveBeenCalled();
  });

  it('ziyaret + tavan altı → yıldız verilir', async () => {
    canEarnPlaceStars.mockResolvedValue({ visited: true, underCap: true });
    const result = await svc.rateRestaurant(ACTOR.id, { placeId: 'p1', placeName: 'Test' });
    expect(awardStars).toHaveBeenCalledWith(ACTOR.id, 'RATING', expect.any(String), 'p1');
    expect(result).toMatchObject({ newStarCount: 10 });
  });
});

describe('sendFriendRequest — durum geçişleri', () => {
  it('kendine istek gönderilemez', async () => {
    await expectHttpError(svc.sendFriendRequest(ACTOR, { toUserId: ACTOR.id }), 400);
  });

  it('karşı yönde PENDING varsa otomatik kabul edilir ve yıldız verilir', async () => {
    prisma.friendRequest.findUnique.mockResolvedValueOnce({ id: 'fr-1', status: 'PENDING' });
    prisma.friendRequest.update.mockResolvedValue({ id: 'fr-1', status: 'ACCEPTED' });

    const result = await svc.sendFriendRequest(ACTOR, { toUserId: 'u-2' });

    expect(result.autoAccepted).toBe(true);
    expect(result.status).toBe(200);
    expect(awardStars).toHaveBeenCalledWith(ACTOR.id, 'FRIEND_ADDED', expect.any(String), 'fr-1');
  });

  it('zaten arkadaşsa 400', async () => {
    prisma.friendRequest.findUnique
      .mockResolvedValueOnce(null)                              // ters yön yok
      .mockResolvedValueOnce({ id: 'fr-2', status: 'ACCEPTED' }); // kendi yönüm
    await expectHttpError(svc.sendFriendRequest(ACTOR, { toUserId: 'u-2' }), 400);
  });

  it('zaten bekleyen istek varsa 409 (çift kayıt oluşmaz)', async () => {
    prisma.friendRequest.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'fr-2', status: 'PENDING' });
    await expectHttpError(svc.sendFriendRequest(ACTOR, { toUserId: 'u-2' }), 409);
    expect(prisma.friendRequest.create).not.toHaveBeenCalled();
  });

  it('REJECTED istek yeniden PENDING yapılır (yeni kayıt açılmaz)', async () => {
    prisma.friendRequest.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'fr-2', status: 'REJECTED' });
    prisma.friendRequest.update.mockResolvedValue({ id: 'fr-2', status: 'PENDING' });

    const result = await svc.sendFriendRequest(ACTOR, { toUserId: 'u-2' });

    expect(result.status).toBe(201);
    expect(prisma.friendRequest.create).not.toHaveBeenCalled();
  });

  it('300 karakterden uzun not reddedilir', async () => {
    await expectHttpError(
      svc.sendFriendRequest(ACTOR, { toUserId: 'u-2', note: 'x'.repeat(301) }),
      400,
    );
  });
});

describe('acceptFriendRequest — yetki', () => {
  it('başkasının isteği kabul edilemez', async () => {
    prisma.friendRequest.findUnique.mockResolvedValue({ id: 'fr-1', toUserId: 'BASKA', status: 'PENDING' });
    await expectHttpError(svc.acceptFriendRequest(ACTOR.id, 'fr-1'), 403);
    expect(awardStars).not.toHaveBeenCalled();
  });

  it('zaten işlenmiş istek tekrar kabul edilemez (çift yıldız yok)', async () => {
    prisma.friendRequest.findUnique.mockResolvedValue({ id: 'fr-1', toUserId: ACTOR.id, status: 'ACCEPTED' });
    await expectHttpError(svc.acceptFriendRequest(ACTOR.id, 'fr-1'), 400);
    expect(awardStars).not.toHaveBeenCalled();
  });
});

describe('removeFriend — yetki', () => {
  it('tarafı olmadığın arkadaşlık silinemez', async () => {
    prisma.friendRequest.findUnique.mockResolvedValue({ id: 'fr-1', fromUserId: 'a', toUserId: 'b' });
    await expectHttpError(svc.removeFriend(ACTOR.id, 'fr-1'), 403);
    expect(prisma.friendRequest.delete).not.toHaveBeenCalled();
  });
});

describe('sendRecommendation', () => {
  beforeEach(() => {
    prisma.recommendation.count.mockResolvedValue(0);
    prisma.recommendation.create.mockResolvedValue({ id: 'rec-1' });
    prisma.$transaction.mockResolvedValue([{ id: 'rec-1' }, { id: 'rec-2' }]);
  });

  it('placeId/placeName zorunlu', async () => {
    await expectHttpError(svc.sendRecommendation(ACTOR, { placeId: 'p1' }), 400);
  });

  it('ücretsiz kullanıcı günlük limiti aşarsa 403 PREMIUM_REQUIRED', async () => {
    prisma.recommendation.count.mockResolvedValue(1);
    await expectHttpError(
      svc.sendRecommendation(ACTOR, { placeId: 'p1', placeName: 'Test', toUserIds: ['u-2'] }),
      403,
      { code: 'PREMIUM_REQUIRED' },
    );
  });

  it('çok alıcılı gönderim TEK transaction içinde yapılır (kısmi gönderim yok)', async () => {
    // Premium: 2 alıcı ücretsiz günlük limiti (1) aşardı — burada test edilen şey limit değil,
    // gönderimin atomikliği.
    isPremiumUser.mockResolvedValue(true);
    await svc.sendRecommendation(ACTOR, { placeId: 'p1', placeName: 'Test', toUserIds: ['u-2', 'u-3'] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('premium kullanıcıda yıldız çarpanı 2 olur', async () => {
    isPremiumUser.mockResolvedValue(true);
    await svc.sendRecommendation(ACTOR, { placeId: 'p1', placeName: 'Test', toUserIds: [] });
    expect(awardStars).toHaveBeenCalledWith(ACTOR.id, 'RECOMMENDATION', expect.any(String), 'rec-1', 2);
  });

  it('ücretsiz kullanıcıda yıldız çarpanı 1 olur', async () => {
    await svc.sendRecommendation(ACTOR, { placeId: 'p1', placeName: 'Test', toUserIds: [] });
    expect(awardStars).toHaveBeenCalledWith(ACTOR.id, 'RECOMMENDATION', expect.any(String), 'rec-1', 1);
  });

  it('aktivite akışına tek olay yazılır (alıcı sayısından bağımsız)', async () => {
    isPremiumUser.mockResolvedValue(true); // limit değil, olay sayısı test ediliyor
    await svc.sendRecommendation(ACTOR, { placeId: 'p1', placeName: 'Test', toUserIds: ['u-2', 'u-3'] });
    expect(logActivity).toHaveBeenCalledTimes(1);
  });
});

describe('getUserRecommendations — gizli profil', () => {
  it('gizli profil + arkadaş değil → boş liste (içerik sızmaz)', async () => {
    prisma.user.findUnique.mockResolvedValue({ isPublic: false });
    prisma.friendRequest.findFirst.mockResolvedValue(null);

    await expect(svc.getUserRecommendations(ACTOR.id, 'u-2')).resolves.toEqual([]);
    expect(prisma.recommendation.findMany).not.toHaveBeenCalled();
  });

  it('gizli profil + arkadaş → içerik döner', async () => {
    prisma.user.findUnique.mockResolvedValue({ isPublic: false });
    prisma.friendRequest.findFirst.mockResolvedValue({ id: 'fr-1' });
    prisma.recommendation.findMany.mockResolvedValue([{ id: 'rec-1' }]);

    await expect(svc.getUserRecommendations(ACTOR.id, 'u-2')).resolves.toEqual([{ id: 'rec-1' }]);
  });

  it('olmayan kullanıcı → 404', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expectHttpError(svc.getUserRecommendations(ACTOR.id, 'yok'), 404);
  });
});

describe('reportUser', () => {
  it('kendini şikayet edemezsin', async () => {
    await expectHttpError(svc.reportUser(ACTOR.id, ACTOR.id, { reason: 'sebep' }), 400);
  });

  it('24 saat içinde aynı kullanıcı tekrar şikayet edilemez', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-2' });
    prisma.userReport.findFirst.mockResolvedValue({ id: 'rep-1' });
    await expectHttpError(svc.reportUser(ACTOR.id, 'u-2', { reason: 'sebep' }), 429);
    expect(prisma.userReport.create).not.toHaveBeenCalled();
  });
});

describe('getActivityFeed', () => {
  it('arkadaş yoksa boş akış döner (sorgu yapılmaz)', async () => {
    prisma.friendRequest.findMany.mockResolvedValue([]);
    await expect(svc.getActivityFeed(ACTOR.id, {})).resolves.toEqual({ events: [], nextCursor: null });
    expect(prisma.activityEvent.findMany).not.toHaveBeenCalled();
  });

  it('limit üst sınırı aşamaz', async () => {
    prisma.friendRequest.findMany.mockResolvedValue([{ fromUserId: ACTOR.id, toUserId: 'u-2' }]);
    prisma.activityEvent.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);

    await svc.getActivityFeed(ACTOR.id, { limit: '999' });

    expect(prisma.activityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: svc.FEED_MAX_LIMIT + 1 }),
    );
  });
});

describe('getLeaderboard', () => {
  it('gerçek adlar maskelenir ve kendi sıran hesaplanır', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u-9', displayName: 'Ahmet Yılmaz', starCount: 500 },
    ]);
    prisma.user.count.mockResolvedValue(3);

    const result = await svc.getLeaderboard(ACTOR);

    expect(result.top5[0].maskedName).toBe('Ah. Yı...');
    expect(result.top5[0]).not.toHaveProperty('displayName');
    expect(result.myRank).toBe(4);
    expect(result.myStarCount).toBe(ACTOR.starCount);
  });
});
