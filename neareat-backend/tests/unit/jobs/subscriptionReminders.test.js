'use strict';

// S19-1 — restoran trial bitiş hatırlatması (pencere + idempotency).

const mockPrisma = { subscription: { findMany: jest.fn() } };
jest.mock('../../../src/utils/prisma', () => mockPrisma);
jest.mock('../../../src/services/cronLock', () => ({ withCronLock: jest.fn() }));
const mockCache = { cacheGet: jest.fn(), cacheSet: jest.fn().mockResolvedValue(undefined) };
jest.mock('../../../src/services/redis', () => mockCache);
const mockCreateNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/services/notificationService', () => ({ createNotification: mockCreateNotification }));

const { runSubscriptionReminders, reminderWindow, REMINDER_DAYS } = require('../../../src/jobs/subscriptionReminders');

beforeEach(() => jest.clearAllMocks());

describe('reminderWindow (pure)', () => {
  it('[now, now+REMINDER_DAYS]', () => {
    const now = new Date('2026-06-23T00:00:00Z');
    const w = reminderWindow(now);
    expect(w.gte).toBe(now);
    expect((w.lte.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)).toBe(REMINDER_DAYS);
  });
});

describe('runSubscriptionReminders', () => {
  const now = new Date('2026-06-23T00:00:00Z');

  it('yakında bitecek trial sahibine bildirim gönderir + damgalar', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { userId: 'r1', expiresAt: new Date('2026-06-25T00:00:00Z') },
    ]);
    mockCache.cacheGet.mockResolvedValue(null); // henüz hatırlatılmadı

    const res = await runSubscriptionReminders(now);

    expect(res.sent).toBe(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'r1', 'SUBSCRIPTION_TRIAL_ENDING', expect.any(String), expect.any(String), expect.any(Object),
    );
    expect(mockCache.cacheSet).toHaveBeenCalled(); // idempotency damgası
  });

  it('idempotent: daha önce hatırlatıldıysa tekrar göndermez', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { userId: 'r1', expiresAt: new Date('2026-06-25T00:00:00Z') },
    ]);
    mockCache.cacheGet.mockResolvedValue('1'); // damga var

    const res = await runSubscriptionReminders(now);

    expect(res.sent).toBe(0);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('yakında biten trial yoksa → sent 0', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    const res = await runSubscriptionReminders(now);
    expect(res).toMatchObject({ found: 0, sent: 0 });
  });
});
