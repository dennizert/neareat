'use strict';

/**
 * Sprint-7 #97 — /api/referral endpoint integration testleri.
 * fix/#160 — REFERRAL_BONUS type doğrulama eklendi.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const U1 = { id: 'u-1', email: 'a@test.com', role: 'USER', displayName: 'Ahmet', starCount: 0, isSuspended: false, referralCode: null, referralApplied: false };
const U2 = { id: 'u-2', email: 'b@test.com', role: 'USER', displayName: 'Bora', starCount: 0, isSuspended: false, referralCode: 'BORA1234', referralApplied: false };

const mockAwardStars = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/utils/stars', () => ({
  awardStars: mockAwardStars,
  deductStars: jest.fn().mockResolvedValue(undefined),
  STAR_AMOUNTS: { REFERRAL: 15, REFERRAL_BONUS: 10 },
  RESERVATION_NO_SHOW_PENALTY: 10,
}));

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
  starEvent: { create: jest.fn() },
  userReward: { create: jest.fn() },
  reward: { findMany: jest.fn() },
  $transaction: jest.fn(),
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

jest.mock('../../src/services/notificationService', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const token1 = createTestToken({ id: 'u-1', email: 'a@test.com', role: 'USER' });
const token2 = createTestToken({ id: 'u-2', email: 'b@test.com', role: 'USER' });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.reward.findMany.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation((ops) => Promise.all(ops));
  mockPrisma.starEvent.create.mockResolvedValue({});
  mockPrisma.user.update.mockResolvedValue({ starCount: 10 });
  mockPrisma.user.count.mockResolvedValue(0);
});

// Helper: sets up findUnique to return values in order
function mockFindUnique(...responses) {
  responses.forEach((r) => mockPrisma.user.findUnique.mockResolvedValueOnce(r));
}

describe('GET /api/referral/my-code', () => {
  it('kod yoksa üretir ve döner', async () => {
    mockFindUnique(U1, U1);  // auth, getMyCode
    mockPrisma.user.findUnique.mockResolvedValueOnce(null); // unique check
    mockPrisma.user.update.mockResolvedValue({ ...U1, referralCode: 'AHME5678' });
    mockPrisma.user.count.mockResolvedValue(3);
    const res = await request(app).get('/api/referral/my-code').set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('AHME5678');
    expect(res.body.usageCount).toBe(3);
    expect(res.body.earnedStars).toBe(45);
  });

  it('kodu varsa güncelleme yapmadan döner', async () => {
    mockFindUnique(U2, U2); // auth, getMyCode
    mockPrisma.user.count.mockResolvedValue(1);
    const res = await request(app).get('/api/referral/my-code').set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('BORA1234');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).get('/api/referral/my-code');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/referral/apply', () => {
  it('code eksikse 400', async () => {
    mockFindUnique(U1); // auth
    const res = await request(app).post('/api/referral/apply').set('Authorization', `Bearer ${token1}`).send({});
    expect(res.status).toBe(400);
  });

  it('geçersiz kod 404', async () => {
    mockFindUnique(U1, U1, null); // auth, me, referrer not found
    const res = await request(app).post('/api/referral/apply').set('Authorization', `Bearer ${token1}`).send({ code: 'INVALID' });
    expect(res.status).toBe(404);
  });

  it('kodu zaten uyguladıysa 409', async () => {
    mockFindUnique(U1, { ...U1, referralApplied: true }); // auth, me
    const res = await request(app).post('/api/referral/apply').set('Authorization', `Bearer ${token1}`).send({ code: 'BORA1234' });
    expect(res.status).toBe(409);
  });

  it('kendi kodunu uygulayamaz', async () => {
    mockFindUnique(U2, U2); // auth, me (u2 has referralCode = BORA1234)
    const res = await request(app).post('/api/referral/apply').set('Authorization', `Bearer ${token2}`).send({ code: 'BORA1234' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/kendi/i);
  });

  it('başarılı uygulama 200', async () => {
    mockFindUnique(U1, U1, U2); // auth, me, referrer
    mockPrisma.user.update.mockResolvedValue({ ...U1, referralApplied: true });
    const res = await request(app).post('/api/referral/apply').set('Authorization', `Bearer ${token1}`).send({ code: 'BORA1234' });
    expect(res.status).toBe(200);
    expect(res.body.earnedStars).toBe(10);
    expect(res.body.referrerName).toBe('Bora');
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post('/api/referral/apply').send({ code: 'BORA1234' });
    expect(res.status).toBe(401);
  });

  it('referred user REFERRAL_BONUS, referrer REFERRAL tipiyle awardStars çağrılır', async () => {
    mockFindUnique(U1, U1, U2); // auth, me, referrer
    mockPrisma.user.update.mockResolvedValue({ ...U1, referralApplied: true });
    await request(app).post('/api/referral/apply').set('Authorization', `Bearer ${token1}`).send({ code: 'BORA1234' });

    const calls = mockAwardStars.mock.calls;
    const referrerCall = calls.find(c => c[0] === U2.id);
    const referredCall = calls.find(c => c[0] === U1.id);
    expect(referrerCall[1]).toBe('REFERRAL');
    expect(referredCall[1]).toBe('REFERRAL_BONUS');
  });
});
