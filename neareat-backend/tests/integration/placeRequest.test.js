'use strict';

jest.mock('../../src/utils/prisma', () => ({
  placeRequest: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
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

const token = createTestToken({ id: 'u-1', email: 'u@test.com', role: 'USER' });
const adminToken = createTestToken({ id: 'admin-1', email: 'a@test.com', role: 'ADMIN' });

const validBody = { placeId: 'place-1', placeName: 'Test Bistro', placeAddress: 'Kadıköy, İstanbul' };

const mockRequest = {
  id: 'req-1', ...validBody, note: null, status: 'PENDING',
  createdAt: new Date(),
  user: { id: 'u-1', displayName: 'Ali', email: 'u@test.com' },
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'USER', isSuspended: false });
  prisma.placeRequest.findUnique.mockResolvedValue(null);
  prisma.placeRequest.create.mockResolvedValue(mockRequest);
  prisma.placeRequest.findMany.mockResolvedValue([mockRequest]);
  prisma.placeRequest.count.mockResolvedValue(1);
  prisma.placeRequest.update.mockResolvedValue({ ...mockRequest, status: 'REVIEWED' });
});

describe('POST /api/place-requests', () => {
  it('geçerli talep → 201', async () => {
    const res = await request(app)
      .post('/api/place-requests')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.placeName).toBe('Test Bistro');
  });

  it('placeId eksik → 400', async () => {
    const res = await request(app)
      .post('/api/place-requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ placeName: 'Bir yer' });
    expect(res.status).toBe(400);
  });

  it('mükerrer talep → 409', async () => {
    prisma.placeRequest.findUnique.mockResolvedValue(mockRequest);
    const res = await request(app)
      .post('/api/place-requests')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(409);
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post('/api/place-requests').send(validBody);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/place-requests/my', () => {
  it('kendi taleplerini döner', async () => {
    const res = await request(app)
      .get('/api/place-requests/my')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Admin — GET /api/admin/place-requests', () => {
  it('admin tüm talepleri görebilir', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', isSuspended: false });
    const res = await request(app)
      .get('/api/admin/place-requests')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requests');
    expect(res.body).toHaveProperty('total');
  });

  it('user admin endpointe erisemez 403', async () => {
    const res = await request(app)
      .get('/api/admin/place-requests')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('Admin — PATCH /api/admin/place-requests/:id/review', () => {
  it('admin talebi REVIEWED yapar', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', isSuspended: false });
    prisma.placeRequest.findUnique.mockResolvedValue(mockRequest);
    const res = await request(app)
      .patch('/api/admin/place-requests/req-1/review')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REVIEWED');
  });

  it('bulunamayan talep → 404', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', isSuspended: false });
    prisma.placeRequest.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .patch('/api/admin/place-requests/nonexistent/review')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
