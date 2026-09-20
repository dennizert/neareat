'use strict';

/**
 * POST /api/analytics/events — hafif ürün analitiği (S14-M5 devamı, #481).
 * GET /api/admin/analytics/summary — huni özeti.
 */

const request = require('supertest');
const { createTestToken, createTestUser } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  analyticsEvent: { create: jest.fn(), groupBy: jest.fn() },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));

jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const USER = createTestUser({ id: 'u-1', role: 'USER' });
const ADMIN = createTestUser({ id: 'admin-1', role: 'ADMIN' });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'ev-1' });
});

describe('POST /api/analytics/events', () => {
  it('giriş yapmış kullanıcı: 202, userId ile kaydedilir', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(USER);

    const res = await request(app).post('/api/analytics/events')
      .set('Authorization', `Bearer ${createTestToken(USER.id)}`)
      .send({ name: 'restaurant_detail_open', props: { placeId: 'p1' } });

    expect(res.status).toBe(202);
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: { userId: 'u-1', name: 'restaurant_detail_open', props: { placeId: 'p1' } },
      select: { id: true },
    });
  });

  // ASIL GEREKSİNİM: anonim istek 401 ALMAMALI — optionalAuth kullanılıyor.
  // authenticate kullanılsaydı token'sız istek 401 dönerdi ve mobil interceptor'ı
  // bunu global logout olarak yorumlardı; analitik ana akışı bozmamalı.
  it('token olmadan (anonim) 401 DEĞİL, 202 döner ve userId null ile kaydedilir', async () => {
    const res = await request(app).post('/api/analytics/events')
      .send({ name: 'screen_view' });

    expect(res.status).toBe(202);
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: { userId: null, name: 'screen_view', props: null },
      select: { id: true },
    });
  });

  it('geçersiz/süresi dolmuş token da 401 vermez, anonim gibi işlenir', async () => {
    const res = await request(app).post('/api/analytics/events')
      .set('Authorization', 'Bearer gecersiz-token')
      .send({ name: 'screen_view' });

    expect(res.status).toBe(202);
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: null }) }),
    );
  });

  it('name eksikse 400 döner', async () => {
    const res = await request(app).post('/api/analytics/events')
      .set('Authorization', `Bearer ${createTestToken(USER.id)}`)
      .send({ props: { placeId: 'p1' } });

    expect(res.status).toBe(400);
    expect(mockPrisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('PII içeren props sunucu tarafında temizlenir (derinlemesine savunma)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(USER);

    await request(app).post('/api/analytics/events')
      .set('Authorization', `Bearer ${createTestToken(USER.id)}`)
      .send({ name: 'x', props: { email: 'sizinti@test.com', placeId: 'p1' } });

    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ props: { placeId: 'p1' } }) }),
    );
  });
});

describe('GET /api/admin/analytics/summary', () => {
  it('admin: huni özetini döner', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(ADMIN);
    mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
      { name: 'restaurant_detail_open', _count: { _all: 10 } },
    ]);

    const res = await request(app).get('/api/admin/analytics/summary?days=14')
      .set('Authorization', `Bearer ${createTestToken(ADMIN.id)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sinceDays: 14,
      events: [{ name: 'restaurant_detail_open', count: 10 }],
    });
  });

  it('admin olmayan kullanıcı 403 alır', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(USER);

    const res = await request(app).get('/api/admin/analytics/summary')
      .set('Authorization', `Bearer ${createTestToken(USER.id)}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.analyticsEvent.groupBy).not.toHaveBeenCalled();
  });

  it('auth olmadan 401', async () => {
    const res = await request(app).get('/api/admin/analytics/summary');
    expect(res.status).toBe(401);
  });
});
