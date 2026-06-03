'use strict';

// P3 — F6: hesap silmede S3 orphan temizliği · F7: menü yükleme boyut limiti

jest.mock('../../src/utils/prisma', () => ({
  user: { findUnique: jest.fn(), delete: jest.fn() },
  restaurantProfile: { findUnique: jest.fn() },
  restaurantMenu: { count: jest.fn(), create: jest.fn() },
}));

jest.mock('../../src/services/s3', () => ({
  isS3Configured: jest.fn(() => true),
  keyFromUrl: jest.fn((url) => `key-for-${url}`),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  ALLOWED_KINDS: ['restaurant', 'product'],
  ALLOWED_CONTENT_TYPES: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  createUploadUrl: jest.fn(),
  getObjectSize: jest.fn(),
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

const token = createTestToken('owner-1');

beforeEach(() => {
  jest.clearAllMocks();
  s3.isS3Configured.mockReturnValue(true);
  s3.keyFromUrl.mockImplementation((url) => `key-for-${url}`);
  prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'RESTAURANT', isSuspended: false, googleId: null });
});

describe('DELETE /api/auth/account — S3 orphan temizliği (F6)', () => {
  it('restoran hesabı silinince her galeri fotosu için deleteObject çağrılır', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({
      photos: [{ url: 'https://bucket/a.jpg' }, { url: 'https://bucket/b.jpg' }],
    });
    prisma.user.delete.mockResolvedValue({ id: 'owner-1' });

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(s3.deleteObject).toHaveBeenCalledTimes(2);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'owner-1' } });
  });

  it('restoran profili yoksa S3 silme çağrısı olmaz', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue(null);
    prisma.user.delete.mockResolvedValue({ id: 'owner-1' });

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(s3.deleteObject).not.toHaveBeenCalled();
  });

  it('S3 yapılandırılmamışsa profili sorgulamadan siler', async () => {
    s3.isS3Configured.mockReturnValue(false);
    prisma.user.delete.mockResolvedValue({ id: 'owner-1' });

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(prisma.restaurantProfile.findUnique).not.toHaveBeenCalled();
    expect(s3.deleteObject).not.toHaveBeenCalled();
  });
});

describe('POST /api/restaurant-account/menu — boyut limiti (F7)', () => {
  it('3MB üstü base64 data → 400', async () => {
    // ~4.2M base64 char → ~3.15MB decoded (>3MB) ama body 5mb limiti altında
    const big = 'A'.repeat(4_200_000);
    const res = await request(app)
      .post('/api/restaurant-account/menu')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: `data:image/jpeg;base64,${big}`, mimeType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/3 MB/);
    expect(prisma.restaurantMenu.create).not.toHaveBeenCalled();
  });

  it('normal boyutlu menü → 201 (regresyon yok)', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'r-1' });
    prisma.restaurantMenu.count.mockResolvedValue(0);
    prisma.restaurantMenu.create.mockResolvedValue({
      id: 'm-1', data: 'x', mimeType: 'image/jpeg', fileName: null, sortOrder: 0, uploadedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/restaurant-account/menu')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(prisma.restaurantMenu.create).toHaveBeenCalled();
  });
});
