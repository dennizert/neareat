'use strict';

/**
 * Sprint-8 #100 — Bildirim tercihleri integration testleri.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  notificationPreference: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

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

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const userId = 'u-1';
const token = createTestToken({ id: userId, email: 'u@test.com', role: 'USER' });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'User', starCount: 0, isSuspended: false,
  });
  mockPrisma.notificationPreference.findMany.mockResolvedValue([]);
  mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
  mockPrisma.notificationPreference.upsert.mockResolvedValue({});
});

describe('GET /api/notifications/type-preferences', () => {
  it('tercih yoksa tümü enabled:true döner', async () => {
    const res = await request(app).get('/api/notifications/type-preferences').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.preferences).toBeDefined();
    expect(res.body.preferences.every((p) => p.enabled === true)).toBe(true);
    expect(res.body.preferences.length).toBeGreaterThan(0);
  });

  it('kapalı tercih varsa false döner', async () => {
    mockPrisma.notificationPreference.findMany.mockResolvedValue([
      { type: 'WEEKLY_DIGEST', enabled: false },
    ]);
    const res = await request(app).get('/api/notifications/type-preferences').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const pref = res.body.preferences.find((p) => p.type === 'WEEKLY_DIGEST');
    expect(pref.enabled).toBe(false);
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).get('/api/notifications/type-preferences');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/notifications/type-preferences', () => {
  it('geçerli tercih güncellenir', async () => {
    const res = await request(app)
      .put('/api/notifications/type-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: [{ type: 'WEEKLY_DIGEST', enabled: false }] });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ type: 'WEEKLY_DIGEST', enabled: false }) }),
    );
  });

  it('preferences dizi değilse 400', async () => {
    const res = await request(app)
      .put('/api/notifications/type-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: 'not-array' });
    expect(res.status).toBe(400);
  });

  it('geçersiz type filtrelenir, geçerli kalan 0 ise 400', async () => {
    const res = await request(app)
      .put('/api/notifications/type-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: [{ type: 'NONEXISTENT_TYPE', enabled: false }] });
    expect(res.status).toBe(400);
  });

  it('çoklu güncelleme', async () => {
    const res = await request(app)
      .put('/api/notifications/type-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        preferences: [
          { type: 'WEEKLY_DIGEST', enabled: false },
          { type: 'INACTIVITY_REMINDER', enabled: false },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).put('/api/notifications/type-preferences').send({});
    expect(res.status).toBe(401);
  });
});
