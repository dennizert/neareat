'use strict';

// S10-2 — POST /api/restaurant-account/photos/upload-url (S3 presigned)

jest.mock('../../src/utils/prisma', () => ({
  restaurantProfile: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
}));

jest.mock('../../src/services/s3', () => ({
  isS3Configured: jest.fn(() => true),
  ALLOWED_KINDS: ['restaurant', 'product'],
  ALLOWED_CONTENT_TYPES: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  createUploadUrl: jest.fn().mockResolvedValue({
    uploadUrl: 'https://signed.example/put',
    key: 'restaurants/r-1/restaurant/uuid.jpg',
    publicUrl: 'https://bucket.s3.eu-central-1.amazonaws.com/restaurants/r-1/restaurant/uuid.jpg',
    expiresIn: 300,
  }),
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
const s3 = require('../../src/services/s3');

const ownerToken = createTestToken('owner-1');
const URL = '/api/restaurant-account/photos/upload-url';

beforeEach(() => {
  jest.clearAllMocks();
  s3.isS3Configured.mockReturnValue(true);
  prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'RESTAURANT', isSuspended: false });
  prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'r-1' });
});

describe('POST /api/restaurant-account/photos/upload-url (S10-2)', () => {
  it('geçerli kind + contentType → 200, presigned + public URL döner', async () => {
    const res = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'restaurant', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.publicUrl).toBeDefined();
    expect(s3.createUploadUrl).toHaveBeenCalledWith('r-1', 'restaurant', 'image/jpeg');
  });

  it('desteklenmeyen contentType → 400', async () => {
    const res = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'product', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('geçersiz kind → 400', async () => {
    const res = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'logo', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('S3 yapılandırılmamış → 503', async () => {
    s3.isS3Configured.mockReturnValue(false);
    const res = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'restaurant', contentType: 'image/jpeg' });
    expect(res.status).toBe(503);
  });

  it('restoran olmayan kullanıcı → 403', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'USER', isSuspended: false });
    const res = await request(app)
      .post(URL)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'restaurant', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);
  });
});
