'use strict';

const mockPrisma = { notification: { deleteMany: jest.fn() } };
jest.mock('../../../src/utils/prisma', () => mockPrisma);
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const { runNotificationCleanup } = require('../../../src/jobs/notificationCleanup');

beforeEach(() => jest.clearAllMocks());

describe('runNotificationCleanup', () => {
  it('okunmuş + 90 günden eski bildirimleri siler', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 42 });
    const deleted = await runNotificationCleanup();
    expect(deleted).toBe(42);
    const call = mockPrisma.notification.deleteMany.mock.calls[0][0];
    expect(call.where.isRead).toBe(true);
    expect(call.where.createdAt.lt).toBeInstanceOf(Date);
    const ageMs = Date.now() - call.where.createdAt.lt.getTime();
    expect(ageMs).toBeGreaterThanOrEqual(89 * 24 * 60 * 60 * 1000);
    expect(ageMs).toBeLessThanOrEqual(91 * 24 * 60 * 60 * 1000);
  });

  it('silme yoksa 0 döner', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 0 });
    const deleted = await runNotificationCleanup();
    expect(deleted).toBe(0);
  });

  it('DB hatasında 0 döner (hata fırlatmaz)', async () => {
    mockPrisma.notification.deleteMany.mockRejectedValue(new Error('DB error'));
    const deleted = await runNotificationCleanup();
    expect(deleted).toBe(0);
  });
});
