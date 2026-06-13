'use strict';

// Dış bağımlılıkları mock'la — saf çekirdek + idempotency'yi deterministik test et.
const mockPrisma = {
  restaurantProfile: { findMany: jest.fn() },
  favorite: { findMany: jest.fn() },
  restaurantPoll: { findMany: jest.fn() },
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
});
