'use strict';

/**
 * Sprint-5 Task #1 — runPendingReservationEscalation unit tests.
 * 24h+ PENDING rezervasyonların escalate edilmesi + idempotency.
 */

const mockPrisma = {
  reservation: { findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const mockCreateNotification = jest.fn().mockResolvedValue({});
jest.mock('../../../src/services/notificationService', () => ({
  createNotification: mockCreateNotification,
}));

const {
  runPendingReservationEscalation,
  PENDING_ESCALATION_HOURS,
} = require('../../../src/jobs/reservationReminders');

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.reservation.update.mockResolvedValue({});
  mockCreateNotification.mockResolvedValue({});
});

function staleReservation(overrides = {}) {
  return {
    id: 'r1',
    userId: 'u1',
    date: '2026-05-30',
    time: '19:30',
    guestCount: 2,
    user: { displayName: 'Ali' },
    restaurant: { userId: 'owner1', businessName: 'Test Restoran', placeName: 'Test Restoran' },
    ...overrides,
  };
}

describe('runPendingReservationEscalation', () => {
  it('sadece PENDING + 24h önce + henüz hatırlatılmamış rezervasyonları sorgular', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([]);

    await runPendingReservationEscalation();

    const where = mockPrisma.reservation.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PENDING');
    expect(where.pendingReminderSentAt).toBeNull();
    expect(where.createdAt.lte).toBeInstanceOf(Date);
    // cutoff ~24h önce
    const diffH = (Date.now() - where.createdAt.lte.getTime()) / 3600000;
    expect(Math.round(diffH)).toBe(PENDING_ESCALATION_HOURS);
  });

  it('stale rezervasyon için restorana + kullanıcıya bildirim gönderir ve damgalar', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([staleReservation()]);

    const processed = await runPendingReservationEscalation();

    expect(processed).toBe(1);
    // 2 bildirim: restoran owner + kullanıcı
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    const targets = mockCreateNotification.mock.calls.map((c) => c[0]);
    expect(targets).toContain('owner1'); // restoran sahibi
    expect(targets).toContain('u1');     // kullanıcı
    const types = mockCreateNotification.mock.calls.map((c) => c[1]);
    expect(types.every((t) => t === 'RESERVATION_PENDING_REMINDER')).toBe(true);
    // idempotency damgası
    expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { pendingReminderSentAt: expect.any(Date) },
    });
  });

  it('stale rezervasyon yoksa bildirim/güncelleme yapmaz, 0 döner', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([]);

    const processed = await runPendingReservationEscalation();

    expect(processed).toBe(0);
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockPrisma.reservation.update).not.toHaveBeenCalled();
  });

  it('birden fazla stale rezervasyonu tek tek işler', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([
      staleReservation({ id: 'r1' }),
      staleReservation({ id: 'r2', userId: 'u2', user: { displayName: 'Veli' } }),
    ]);

    const processed = await runPendingReservationEscalation();

    expect(processed).toBe(2);
    expect(mockPrisma.reservation.update).toHaveBeenCalledTimes(2);
    expect(mockCreateNotification).toHaveBeenCalledTimes(4);
  });

  it('DB hatasında throw etmez (cron güvenli)', async () => {
    mockPrisma.reservation.findMany.mockRejectedValueOnce(new Error('db down'));
    await expect(runPendingReservationEscalation()).resolves.toBe(0);
  });
});
