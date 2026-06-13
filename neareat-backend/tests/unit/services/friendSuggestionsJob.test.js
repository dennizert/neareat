'use strict';

/**
 * S16-5 — computeAllSuggestions chunk + pipeline davranışı.
 *
 * Viewer'lar parçalara bölünür; her parça için sinyal+adjacency yüklenir ve TEK
 * pipeline (cacheSetMany) ile yazılır (viewer başına ayrı cacheSet DEĞİL). Aday
 * sinyalleri bir kez yüklenir. prisma + redis mock'lanır.
 */

// Küçük parça boyutu — modül yüklenmeden ÖNCE ayarlanmalı (const load-time okunur).
process.env.FRIEND_JOB_CHUNK = '2';

jest.mock('../../../src/services/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheSetMany: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn(),
}));

jest.mock('../../../src/utils/prisma', () => ({
  user: { findMany: jest.fn(), findUnique: jest.fn() },
  favorite: { findMany: jest.fn().mockResolvedValue([]) },
  collectionItem: { findMany: jest.fn().mockResolvedValue([]) },
  recommendation: { findMany: jest.fn().mockResolvedValue([]) },
  reservation: { findMany: jest.fn().mockResolvedValue([]) },
  pollVote: { findMany: jest.fn().mockResolvedValue([]) },
  restaurantPoll: { findMany: jest.fn().mockResolvedValue([]) },
  feedbackPreference: { findMany: jest.fn().mockResolvedValue([]) },
  aiRecommendationLog: { groupBy: jest.fn().mockResolvedValue([]) },
  friendRequest: { findMany: jest.fn().mockResolvedValue([]) },
}));

const prisma = require('../../../src/utils/prisma');
const { cacheSet, cacheSetMany } = require('../../../src/services/redis');
const { computeAllSuggestions } = require('../../../src/services/friendSuggestionService');

const u = (id) => ({ id, displayName: id, photoUrl: null, city: 'İstanbul', favoriteCuisines: [], starCount: 0 });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('computeAllSuggestions — chunk + pipeline (S16-5)', () => {
  it('3 viewer / parça=2 → 2 pipeline yazımı, viewer başına cacheSet YOK', async () => {
    // 1. findMany → viewer'lar; 2. findMany → public adaylar
    prisma.user.findMany
      .mockResolvedValueOnce([u('v1'), u('v2'), u('v3')])
      .mockResolvedValueOnce([u('c1'), u('c2')]);

    const result = await computeAllSuggestions();

    expect(result).toEqual({ processed: 3, stored: 3 });

    // Parça=2 → 2 chunk → 2 pipeline çağrısı
    expect(cacheSetMany).toHaveBeenCalledTimes(2);
    // Sıralı per-viewer cacheSet kullanılmamalı
    expect(cacheSet).not.toHaveBeenCalled();

    // Yazılan anahtarlar tüm viewer'ları kapsar
    const writtenKeys = cacheSetMany.mock.calls.flatMap(([entries]) => entries.map((e) => e.key));
    expect(writtenKeys.sort()).toEqual([
      'friend-suggestions:v1',
      'friend-suggestions:v2',
      'friend-suggestions:v3',
    ]);

    // Aday sinyalleri 1 kez + her chunk için 1 kez = 3 loadSignalMaps → favorite.findMany 3 kez
    expect(prisma.favorite.findMany).toHaveBeenCalledTimes(3);
  });

  it('viewer yoksa erken döner (DB/Redis yazımı yok)', async () => {
    prisma.user.findMany.mockResolvedValueOnce([]);
    const result = await computeAllSuggestions();
    expect(result).toEqual({ processed: 0, stored: 0 });
    expect(cacheSetMany).not.toHaveBeenCalled();
  });
});
