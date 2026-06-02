'use strict';

// S10-3 — Restoran/ürün foto galerileri CRUD
// POST /photos, GET /photos?kind=, DELETE /photos/:id

jest.mock('../../src/utils/prisma', () => ({
  restaurantProfile: { findUnique: jest.fn() },
  restaurantPhoto: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  user: { findUnique: jest.fn() },
}));

jest.mock('../../src/services/s3', () => ({
  isS3Configured: jest.fn(() => true),
  keyFromUrl: jest.fn(() => 'restaurants/r-1/restaurant/uuid.jpg'),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  ALLOWED_KINDS: ['restaurant', 'product'],
  ALLOWED_CONTENT_TYPES: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  createUploadUrl: jest.fn(),
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
const BASE = '/api/restaurant-account/photos';

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'RESTAURANT', isSuspended: false });
  prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'r-1' });
  s3.isS3Configured.mockReturnValue(true);
});

describe('POST /api/restaurant-account/photos (S10-3)', () => {
  it('kind=RESTAURANT geçerli url → 201, kayıt oluşturur', async () => {
    prisma.restaurantPhoto.count.mockResolvedValue(0);
    prisma.restaurantPhoto.create.mockResolvedValue({
      id: 'p-1', kind: 'RESTAURANT', url: 'https://cdn.example/a.jpg', sortOrder: 0, createdAt: new Date(),
    });

    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'RESTAURANT', url: 'https://cdn.example/a.jpg' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('p-1');
    expect(prisma.restaurantPhoto.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ restaurantProfileId: 'r-1', kind: 'RESTAURANT', sortOrder: 0 }),
    }));
  });

  it('galeride 8 foto varken 9.yu ekle → 409', async () => {
    prisma.restaurantPhoto.count.mockResolvedValue(8);
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'PRODUCT', url: 'https://cdn.example/x.jpg' });

    expect(res.status).toBe(409);
    expect(prisma.restaurantPhoto.create).not.toHaveBeenCalled();
  });

  it('geçersiz kind → 400', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'LOGO', url: 'https://cdn.example/x.jpg' });
    expect(res.status).toBe(400);
  });

  it('geçersiz url → 400', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ kind: 'RESTAURANT', url: 'not-a-url' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/restaurant-account/photos (S10-3)', () => {
  it('?kind=PRODUCT → yalnızca ürün fotoları sortOrder sırasıyla', async () => {
    prisma.restaurantPhoto.findMany.mockResolvedValue([
      { id: 'p-1', kind: 'PRODUCT', url: 'https://cdn.example/1.jpg', sortOrder: 0, createdAt: new Date() },
      { id: 'p-2', kind: 'PRODUCT', url: 'https://cdn.example/2.jpg', sortOrder: 1, createdAt: new Date() },
    ]);

    const res = await request(app)
      .get(`${BASE}?kind=PRODUCT`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(prisma.restaurantPhoto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { restaurantProfileId: 'r-1', kind: 'PRODUCT' },
    }));
  });

  it('geçersiz kind query → 400', async () => {
    const res = await request(app)
      .get(`${BASE}?kind=LOGO`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/restaurant-account/photos/:id (S10-3)', () => {
  it('kendi fotosunu sil → 200, S3 nesnesi de temizlenir', async () => {
    prisma.restaurantPhoto.findUnique.mockResolvedValue({
      id: 'p-1', restaurantProfileId: 'r-1', url: 'https://bucket.s3.eu-central-1.amazonaws.com/restaurants/r-1/restaurant/uuid.jpg',
    });
    prisma.restaurantPhoto.delete.mockResolvedValue({});

    const res = await request(app)
      .delete(`${BASE}/p-1`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(prisma.restaurantPhoto.delete).toHaveBeenCalledWith({ where: { id: 'p-1' } });
    expect(s3.deleteObject).toHaveBeenCalled();
  });

  it('başkasının fotosunu sil → 404', async () => {
    prisma.restaurantPhoto.findUnique.mockResolvedValue({
      id: 'p-9', restaurantProfileId: 'other-profile', url: 'https://cdn.example/x.jpg',
    });
    const res = await request(app)
      .delete(`${BASE}/p-9`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
    expect(prisma.restaurantPhoto.delete).not.toHaveBeenCalled();
  });

  it('olmayan id sil → 404', async () => {
    prisma.restaurantPhoto.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .delete(`${BASE}/nope`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });
});
