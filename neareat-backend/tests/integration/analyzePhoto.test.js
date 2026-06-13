'use strict';

/**
 * Sprint-7 #94 — POST /api/recommendations/analyze-photo integration testleri.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  subscription: { findUnique: jest.fn() },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));

const mockCacheStore = new Map();
jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG'), incr: jest.fn().mockResolvedValue(1), pexpire: jest.fn() }),
  cacheGet: jest.fn((k) => Promise.resolve(mockCacheStore.get(k))),
  cacheSet: jest.fn((k, v) => { mockCacheStore.set(k, v); return Promise.resolve(); }),
  cacheDel: jest.fn((k) => { mockCacheStore.delete(k); return Promise.resolve(); }),
}));

const mockAnalyze = jest.fn();
jest.mock('../../src/services/photoAnalysis', () => ({
  analyzeRestaurantPhoto: (...args) => mockAnalyze(...args),
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
  mockCacheStore.clear();
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'U', starCount: 0, isSuspended: false,
  });
  mockPrisma.subscription.findUnique.mockResolvedValue(null);
  mockAnalyze.mockResolvedValue({
    analysis: 'Sıcak ışıklandırma, ahşap mobilyalar — şık ama rahat bir akşam yemeği mekanı.',
    model: 'claude-haiku-4-5-20251001',
    fallback: false,
  });
});

describe('POST /api/recommendations/analyze-photo', () => {
  const PATH = '/api/recommendations/analyze-photo';

  it('image yoksa 400', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1' });
    expect(res.status).toBe(400);
  });

  it('imageBase64 string değilse 400', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ imageBase64: 12345 });
    expect(res.status).toBe(400);
  });

  it('başarılı imageUrl ile analiz döner', async () => {
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ imageUrl: 'https://example.com/p.jpg', placeName: 'Köşk' });
    expect(res.status).toBe(200);
    expect(res.body.analysis).toContain('Sıcak');
    expect(res.body.fallback).toBe(false);
    expect(res.body.model).toContain('haiku');
    expect(mockAnalyze).toHaveBeenCalledWith(expect.objectContaining({
      imageUrl: 'https://example.com/p.jpg',
      placeName: 'Köşk',
    }));
  });

  it('free tier 3 başarılı çağrı, 4. → 429 LIMIT_EXCEEDED', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
        .send({ imageUrl: 'https://x/p.jpg' });
      expect(r.status).toBe(200);
    }
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ imageUrl: 'https://x/p.jpg' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('LIMIT_EXCEEDED');
    expect(res.body.upgrade).toBe(true);
  });

  it('free tier remainingToday geri sayım', async () => {
    const r1 = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ imageUrl: 'https://x/p.jpg' });
    expect(r1.body.remainingToday).toBe(2);
    const r2 = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ imageUrl: 'https://x/p.jpg' });
    expect(r2.body.remainingToday).toBe(1);
  });

  it('premium kullanıcıda limit yok (remainingToday null)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      status: 'active',
      expiresAt: new Date(Date.now() + 86400000 * 30),
    });
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
        .send({ imageUrl: 'https://x/p.jpg' });
      expect(r.status).toBe(200);
      expect(r.body.remainingToday).toBeNull();
    }
  });

  it('Anthropic hatasında fallback:true, analysis:null', async () => {
    mockAnalyze.mockResolvedValueOnce({ analysis: null, model: null, fallback: true, error: 'rate_limit' });
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`)
      .send({ imageUrl: 'https://x/p.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.analysis).toBeNull();
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post(PATH).send({ imageUrl: 'https://x.jpg' });
    expect(res.status).toBe(401);
  });
});
