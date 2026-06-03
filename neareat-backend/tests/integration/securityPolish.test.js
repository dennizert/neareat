'use strict';

// S11-11 — Güvenlik cilası: koleksiyon/bio moderasyonu + forgot-password enumerasyon koruması

jest.mock('../../src/utils/prisma', () => ({
  user: { findUnique: jest.fn(), update: jest.fn() },
  collection: { create: jest.fn(), count: jest.fn() },
}));
jest.mock('../../src/utils/contentFilter', () => ({ containsOffensiveContent: jest.fn(() => false) }));
jest.mock('../../src/utils/premiumCheck', () => ({
  isPremiumUser: jest.fn().mockResolvedValue(true),
  isActivePremium: jest.fn().mockReturnValue(true),
}));

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));
jest.mock('../../src/services/googleAuth', () => ({ verifyGoogleIdToken: jest.fn() }));
jest.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(undefined),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
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
const { containsOffensiveContent } = require('../../src/utils/contentFilter');
const { sendPasswordResetEmail } = require('../../src/services/emailService');

const token = createTestToken('user-1');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'USER', isSuspended: false });
});

describe('Koleksiyon adı moderasyonu (S11-11)', () => {
  it('uygunsuz koleksiyon adı → 400, create çağrılmaz', async () => {
    containsOffensiveContent.mockReturnValueOnce(true);
    const res = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Kötü ad' });
    expect(res.status).toBe(400);
    expect(prisma.collection.create).not.toHaveBeenCalled();
  });

  it('temiz ad → 201', async () => {
    prisma.collection.create.mockResolvedValue({ id: 'c-1', name: 'Favori Mekanlar', userId: 'user-1' });
    const res = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Favori Mekanlar' });
    expect(res.status).toBe(201);
  });
});

describe('Profil bio moderasyonu (S11-11)', () => {
  it('uygunsuz bio → 400, update çağrılmaz', async () => {
    containsOffensiveContent.mockReturnValueOnce(true);
    const res = await request(app)
      .put('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'kötü bio' });
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('forgot-password enumerasyon koruması (S11-11)', () => {
  it('Google hesabı → generic 200, sıfırlama e-postası gönderilmez', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'g-1', email: 'g@x.com', authProvider: 'google' });
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'g@x.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/kayıtlıysa/i);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('kayıtlı olmayan e-posta → aynı generic 200', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'yok@x.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/kayıtlıysa/i);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
