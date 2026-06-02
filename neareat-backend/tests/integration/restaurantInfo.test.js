'use strict';

// S10-1 — PUT /api/restaurant-account/info: displayName + altPhone

jest.mock('../../src/utils/prisma', () => ({
  restaurantProfile: { update: jest.fn(), findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
}));

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));
jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(undefined),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  createNotificationsForUsers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/logService', () => ({
  logRequest: jest.fn().mockResolvedValue(undefined),
  logActivity: jest.fn().mockResolvedValue(undefined),
  ACTIVITY_TYPES: {},
}));
jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const request = require('supertest');
const { createTestToken } = require('../helpers');
const app = require('../../src/app');
const prisma = require('../../src/utils/prisma');

const ownerToken = createTestToken('owner-1');
const PUT = '/api/restaurant-account/info';

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'RESTAURANT', isSuspended: false });
  prisma.restaurantProfile.update.mockImplementation(({ data }) =>
    Promise.resolve({ id: 'r-1', userId: 'owner-1', ...data }),
  );
});

describe('PUT /api/restaurant-account/info — displayName + altPhone (S10-1)', () => {
  it('geçerli displayName + altPhone → 200, update doğru veriyle çağrılır', async () => {
    const res = await request(app)
      .put(PUT)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ displayName: 'Mavera Restaurant', altPhone: '+90 555 111 22 33' });

    expect(res.status).toBe(200);
    expect(prisma.restaurantProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayName: 'Mavera Restaurant', altPhone: '+90 555 111 22 33' }),
      }),
    );
  });

  it('displayName 1 karakter → 400', async () => {
    const res = await request(app)
      .put(PUT)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ displayName: 'A' });
    expect(res.status).toBe(400);
  });

  it('displayName boş string → null kaydedilir (Google adına döner)', async () => {
    const res = await request(app)
      .put(PUT)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ displayName: '' });
    expect(res.status).toBe(200);
    expect(prisma.restaurantProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayName: null }) }),
    );
  });

  it('altPhone 20+ karakter → 400', async () => {
    const res = await request(app)
      .put(PUT)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ altPhone: '1'.repeat(21) });
    expect(res.status).toBe(400);
  });

  it('restoran olmayan kullanıcı → 403', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'USER', isSuspended: false });
    const res = await request(app)
      .put(PUT)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ displayName: 'X Restaurant' });
    expect(res.status).toBe(403);
  });
});
