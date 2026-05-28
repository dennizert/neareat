'use strict';

/**
 * Sprint-5 Task #2 — awardStars level-up tetikleyici birim testleri.
 *
 * LEVEL_UP bildirimi awardStars içinde zaten tetikleniyordu (v12-v25) ama
 * doğrudan testi yoktu. Bu dosya: seviye atlayınca tam 1 LEVEL_UP, aynı
 * seviyede tekrar yok, çoklu atlamada tek bildirim, milestone davranışı.
 */

const mockPrisma = {
  // $transaction dizisi oluşturulurken bu builder'lar çağrılır (jest.fn yeterli)
  user: { findUnique: jest.fn(), update: jest.fn() },
  starEvent: { create: jest.fn() },
  reward: { findMany: jest.fn().mockResolvedValue([]) },
  userReward: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const mockCreateNotification = jest.fn().mockResolvedValue({});
jest.mock('../../../src/services/notificationService', () => ({
  createNotification: mockCreateNotification,
  createNotificationsForUsers: jest.fn(),
}));

const { awardStars } = require('../../../src/utils/stars');

/** oldStars (findUnique) ve newStars ($transaction sonucu) bağımsız kontrol edilir. */
function setupStars(oldStars, newStars) {
  mockPrisma.user.findUnique.mockResolvedValue({ starCount: oldStars });
  mockPrisma.$transaction.mockResolvedValue([
    { id: 'e1', type: 'REVIEW', amount: 5 },
    { starCount: newStars },
  ]);
  mockPrisma.reward.findMany.mockResolvedValue([]);
}

function levelUpCalls() {
  return mockCreateNotification.mock.calls.filter((c) => c[1] === 'LEVEL_UP');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.reward.findMany.mockResolvedValue([]);
});

describe('awardStars — level-up notification', () => {
  it('seviye atlayınca tam 1 LEVEL_UP bildirimi gönderir', async () => {
    setupStars(9, 14); // level 1 → 2

    await awardStars('u1', 'REVIEW', 'yorum');

    const calls = levelUpCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('u1');
    expect(calls[0][4]).toMatchObject({ newLevel: 2 });
  });

  it('aynı seviyede kalınca LEVEL_UP tetiklenmez', async () => {
    setupStars(11, 16); // level 2 → 2

    await awardStars('u1', 'REVIEW', 'yorum');

    expect(levelUpCalls()).toHaveLength(0);
  });

  it('tek seferde iki seviye atlanırsa yine tam 1 LEVEL_UP (son seviye)', async () => {
    setupStars(0, 30); // level 1 → 3

    await awardStars('u1', 'REVIEW', 'yorum');

    const calls = levelUpCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][4]).toMatchObject({ newLevel: 3 });
  });

  it('seviye 5 sınırını geçince LEVEL_UP gönderir', async () => {
    setupStars(99, 104); // level 4 → 5

    await awardStars('u1', 'REVIEW', 'yorum');

    expect(levelUpCalls()).toHaveLength(1);
    expect(levelUpCalls()[0][4]).toMatchObject({ newLevel: 5 });
  });

  it('seviye 5 içindeyken (atlama yok) STAR_MILESTONE gönderir, LEVEL_UP göndermez', async () => {
    setupStars(190, 210); // ikisi de level 5; 200 milestone geçildi

    await awardStars('u1', 'REVIEW', 'yorum');

    expect(levelUpCalls()).toHaveLength(0);
    const milestoneCalls = mockCreateNotification.mock.calls.filter((c) => c[1] === 'STAR_MILESTONE');
    expect(milestoneCalls).toHaveLength(1);
    expect(milestoneCalls[0][4]).toMatchObject({ milestone: 200 });
  });

  it('{ event, newStarCount, newRewards } döner', async () => {
    setupStars(9, 14);

    const result = await awardStars('u1', 'REVIEW', 'yorum');

    expect(result.newStarCount).toBe(14);
    expect(result.event).toBeDefined();
    expect(Array.isArray(result.newRewards)).toBe(true);
  });
});
