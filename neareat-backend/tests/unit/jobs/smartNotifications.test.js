'use strict';

// Dış bağımlılıkları mock'la — saf çekirdek + idempotency'yi deterministik test et.
const mockPrisma = {
  restaurantProfile: { findMany: jest.fn() },
  favorite: { findMany: jest.fn() },
  restaurantPoll: { findMany: jest.fn() },
  recommendation: { groupBy: jest.fn() },
  user: { findMany: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/services/redis', () => ({
  cacheGet: (...a) => mockCacheGet(...a),
  cacheSet: (...a) => mockCacheSet(...a),
}));

const mockCreateNotification = jest.fn().mockResolvedValue({});
jest.mock('../../../src/services/notificationService', () => ({
  createNotification: (...a) => mockCreateNotification(...a),
  createNotificationsForUsers: jest.fn(),
}));

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const mod = require('../../../src/jobs/smartNotifications');

beforeEach(() => jest.clearAllMocks());

// ─── Saf çekirdek ─────────────────────────────────────────────────────────────

describe('closingSoonDiff / isInClosingWindow', () => {
  it('kapanışa kalan dakikayı hesaplar', () => {
    expect(mod.closingSoonDiff({ close: '22:00' }, 21 * 60)).toBe(60); // 22:00 - 21:00 = 60dk
  });
  it('kapalı/eksik veride null', () => {
    expect(mod.closingSoonDiff({ closed: true }, 600)).toBeNull();
    expect(mod.closingSoonDiff({}, 600)).toBeNull();
    expect(mod.closingSoonDiff(null, 600)).toBeNull();
  });
  it('30-75 dk penceresi: sınırlar dahil, dışı hariç', () => {
    expect(mod.isInClosingWindow(30)).toBe(true);
    expect(mod.isInClosingWindow(75)).toBe(true);
    expect(mod.isInClosingWindow(29)).toBe(false);
    expect(mod.isInClosingWindow(76)).toBe(false);
    expect(mod.isInClosingWindow(null)).toBe(false);
  });
});

describe('selectUnvotedMembers', () => {
  it('oy vermemiş ACCEPTED üyeleri döner', () => {
    const poll = {
      group: { members: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }] },
      options: [{ votes: [{ userId: 'b' }] }, { votes: [{ userId: 'x' }] }],
    };
    const unvoted = mod.selectUnvotedMembers(poll).map((m) => m.userId);
    expect(unvoted).toEqual(['a', 'c']);
  });
});

describe('getTurkeyNow / todayTR', () => {
  it('UTC+3 kayması uygular ve YYYY-MM-DD verir', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 5, 15, 9, 0, 0));
    expect(mod.getTurkeyNow().getTime()).toBe(Date.UTC(2026, 5, 15, 12, 0, 0));
    expect(mod.todayTR()).toBe('2026-06-15');
    spy.mockRestore();
  });
});

// ─── Idempotency: runFavoriteClosingSoon ──────────────────────────────────────

describe('runFavoriteClosingSoon idempotency', () => {
  const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function setupClosingSoonRestaurant() {
    const now = mod.getTurkeyNow();
    const cm = now.getHours() * 60 + now.getMinutes();
    const closeMin = cm + 60; // 60 dk sonra kapanış → pencere içinde (modulo YOK, 24+ olabilir)
    const close = `${Math.floor(closeMin / 60)}:${String(closeMin % 60).padStart(2, '0')}`;
    const dayName = DAY_NAMES[now.getDay()];
    mockPrisma.restaurantProfile.findMany.mockResolvedValue([
      { placeId: 'p1', placeName: 'Lokanta', businessName: 'Lokanta', openingHours: { [dayName]: { close } } },
    ]);
    mockPrisma.favorite.findMany.mockResolvedValue([{ userId: 'u1' }]);
  }

  it('bugün zaten gönderildiyse (cacheGet truthy) bildirim göndermez', async () => {
    setupClosingSoonRestaurant();
    mockCacheGet.mockResolvedValue(1); // zaten gönderildi
    await mod.runFavoriteClosingSoon();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('bugün gönderilmediyse bildirim gönderir + cacheSet ile işaretler', async () => {
    setupClosingSoonRestaurant();
    mockCacheGet.mockResolvedValue(null);
    await mod.runFavoriteClosingSoon();
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'u1', 'FAVORITE_CLOSING_SOON', expect.any(String), expect.any(String), expect.objectContaining({ placeId: 'p1' }),
    );
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('DB hatasında throw etmez (cron güvenli)', async () => {
    mockPrisma.restaurantProfile.findMany.mockRejectedValue(new Error('db down'));
    await expect(mod.runFavoriteClosingSoon()).resolves.toBeUndefined();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});

// ─── #429 — daha önce hiç test edilmeyen 3 job. Export edilmedikleri için
// mock'lu testleri hiç yazılamıyordu; wiring hatası (yanlış prisma alanı, yanlış
// bildirim tipi) sessizce üretime kadar fark edilmezdi.

describe('runPollVoteReminder idempotency', () => {
  function poll(overrides = {}) {
    return {
      id: 'poll-1',
      groupId: 'g-1',
      group: { name: 'Ekip', members: [{ userId: 'a' }, { userId: 'b' }] },
      options: [{ votes: [{ userId: 'a' }] }], // b henüz oy vermedi
      ...overrides,
    };
  }

  it('unvoted üyeye bildirim gönderir + cacheSet ile işaretler', async () => {
    mockPrisma.restaurantPoll.findMany.mockResolvedValue([poll()]);
    mockCacheGet.mockResolvedValue(null);

    await mod.runPollVoteReminder();

    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'b', 'POLL_VOTE_REMINDER', expect.any(String), expect.any(String),
      expect.objectContaining({ groupId: 'g-1', pollId: 'poll-1' }),
    );
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('4 saat içinde zaten hatırlatıldıysa (cacheGet truthy) tekrar göndermez', async () => {
    mockPrisma.restaurantPoll.findMany.mockResolvedValue([poll()]);
    mockCacheGet.mockResolvedValue(1);

    await mod.runPollVoteReminder();

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('herkes oy vermişse kimseye bildirim gitmez', async () => {
    mockPrisma.restaurantPoll.findMany.mockResolvedValue([
      poll({ options: [{ votes: [{ userId: 'a' }, { userId: 'b' }] }] }),
    ]);
    await mod.runPollVoteReminder();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('DB hatasında throw etmez', async () => {
    mockPrisma.restaurantPoll.findMany.mockRejectedValue(new Error('db down'));
    await expect(mod.runPollVoteReminder()).resolves.toBeUndefined();
  });
});

describe('runWeeklyDigest', () => {
  it('haftalık öneri alan her kullanıcıya doğru sayıyla bildirim gönderir', async () => {
    mockPrisma.recommendation.groupBy.mockResolvedValue([
      { toUserId: 'u1', _count: { id: 3 } },
      { toUserId: 'u2', _count: { id: 1 } },
    ]);

    await mod.runWeeklyDigest();

    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'u1', 'WEEKLY_DIGEST', expect.any(String), expect.stringContaining('3 arkadaşın'),
      expect.objectContaining({ screen: 'Profile' }),
    );
  });

  it('öneri alan kimse yoksa hiç bildirim gitmez', async () => {
    mockPrisma.recommendation.groupBy.mockResolvedValue([]);
    await mod.runWeeklyDigest();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('DB hatasında throw etmez', async () => {
    mockPrisma.recommendation.groupBy.mockRejectedValue(new Error('db down'));
    await expect(mod.runWeeklyDigest()).resolves.toBeUndefined();
  });
});

describe('runInactivityReminder idempotency', () => {
  it('favorisi olan kullanıcıya favori adını içeren mesaj gönderir + damgalar', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', favorites: [{ placeName: 'Köşk Kebap' }] },
    ]);
    mockCacheGet.mockResolvedValue(null);

    await mod.runInactivityReminder();

    expect(mockCreateNotification).toHaveBeenCalledWith(
      'u1', 'INACTIVITY_REMINDER', expect.any(String), expect.stringContaining('Köşk Kebap'),
      expect.objectContaining({ screen: 'Home' }),
    );
    expect(mockCacheSet).toHaveBeenCalled();
  });

  // Sorgu `favorites: { some: {} }` ile en az bir favorisi olanı filtreliyor, ama
  // `take: 1` boş dönerse (ör. veri tutarsızlığı) jenerik mesaja düşülmeli — patlamamalı.
  it('favori adı okunamazsa jenerik mesaja düşer', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', favorites: [] }]);
    mockCacheGet.mockResolvedValue(null);

    await mod.runInactivityReminder();

    expect(mockCreateNotification).toHaveBeenCalledWith(
      'u1', 'INACTIVITY_REMINDER', expect.any(String), expect.stringContaining('çok şey kaçırıyor'),
      expect.any(Object),
    );
  });

  it('bu hafta zaten hatırlatıldıysa (cacheGet truthy) tekrar göndermez', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', favorites: [{ placeName: 'X' }] }]);
    mockCacheGet.mockResolvedValue(1);

    await mod.runInactivityReminder();

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('DB hatasında throw etmez', async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error('db down'));
    await expect(mod.runInactivityReminder()).resolves.toBeUndefined();
  });
});
