'use strict';

/**
 * #485 — notificationService.js daha önce hiç test edilmemişti, ama #429'da
 * test edilen TÜM job'ların (runFavoriteClosingSoon, runPollVoteReminder,
 * runWeeklyDigest, runInactivityReminder, runPendingReservationEscalation,
 * runFeedbackAggregation...) çağırdığı tek ortak bildirim yazma noktası.
 * O testlerde hep mock'landığı için kendi opt-out ve toplu-gönderim mantığı
 * hiç doğrulanmamıştı.
 */

const mockPrisma = {
  notificationPreference: { findUnique: jest.fn(), findMany: jest.fn() },
  notification: { create: jest.fn(), createMany: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);
jest.mock('../../../src/utils/logger', () => ({ error: jest.fn() }));

const {
  isNotificationEnabled,
  createNotification,
  createNotificationsForUsers,
} = require('../../../src/services/notificationService');

beforeEach(() => jest.clearAllMocks());

describe('isNotificationEnabled — opt-out modeli', () => {
  it('kayıt yoksa (null) varsayılan true döner', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce(null);
    await expect(isNotificationEnabled('u1', 'WEEKLY_DIGEST')).resolves.toBe(true);
  });

  it('kayıt varsa enabled alanını döner', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({ enabled: false });
    await expect(isNotificationEnabled('u1', 'WEEKLY_DIGEST')).resolves.toBe(false);
  });
});

describe('createNotification', () => {
  it('opt-out kapalıysa DB’ye yazmadan null döner', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({ enabled: false });
    const result = await createNotification('u1', 'WEEKLY_DIGEST', 'Başlık', 'Gövde');
    expect(result).toBeNull();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('açıksa notification.create çağırır ve sonucu döner', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({ enabled: true });
    mockPrisma.notification.create.mockResolvedValueOnce({ id: 'n1' });

    const result = await createNotification('u1', 'WEEKLY_DIGEST', 'Başlık', 'Gövde', { x: 1 });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: { userId: 'u1', type: 'WEEKLY_DIGEST', title: 'Başlık', body: 'Gövde', data: { x: 1 } },
    });
    expect(result).toEqual({ id: 'n1' });
  });

  it('kayıt yoksa (varsayılan açık) yine de yazar', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce(null);
    mockPrisma.notification.create.mockResolvedValueOnce({ id: 'n1' });
    await createNotification('u1', 'WEEKLY_DIGEST', 'Başlık', 'Gövde');
    expect(mockPrisma.notification.create).toHaveBeenCalled();
  });

  it('DB hatasında throw etmez', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({ enabled: true });
    mockPrisma.notification.create.mockRejectedValueOnce(new Error('db down'));
    await expect(createNotification('u1', 'X', 'a', 'b')).resolves.toBeUndefined();
  });
});

describe('createNotificationsForUsers', () => {
  it('boş userIds ile erken çıkar, hiçbir sorgu atmaz', async () => {
    await createNotificationsForUsers([], 'CAMPAIGN', 'a', 'b');
    await createNotificationsForUsers(undefined, 'CAMPAIGN', 'a', 'b');
    expect(mockPrisma.notificationPreference.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('opt-out kullanıcıları toplu sorgudan filtreleyip yalnızca aktiflere createMany çağırır', async () => {
    mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([{ userId: 'u2' }]);
    mockPrisma.notification.createMany.mockResolvedValueOnce({ count: 2 });

    await createNotificationsForUsers(['u1', 'u2', 'u3'], 'CAMPAIGN', 'Başlık', 'Gövde', { y: 1 });

    expect(mockPrisma.notificationPreference.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['u1', 'u2', 'u3'] }, type: 'CAMPAIGN', enabled: false },
      select: { userId: true },
    });
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', type: 'CAMPAIGN', title: 'Başlık', body: 'Gövde', data: { y: 1 } },
        { userId: 'u3', type: 'CAMPAIGN', title: 'Başlık', body: 'Gövde', data: { y: 1 } },
      ],
    });
  });

  it('herkes opt-out ise createMany hiç çağrılmaz', async () => {
    mockPrisma.notificationPreference.findMany.mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }]);
    await createNotificationsForUsers(['u1', 'u2'], 'CAMPAIGN', 'a', 'b');
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('DB hatasında throw etmez', async () => {
    mockPrisma.notificationPreference.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(createNotificationsForUsers(['u1'], 'CAMPAIGN', 'a', 'b')).resolves.toBeUndefined();
  });
});
