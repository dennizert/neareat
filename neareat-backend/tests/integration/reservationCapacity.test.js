'use strict';

jest.mock('../../src/utils/prisma', () => ({
  restaurantProfile: { findFirst: jest.fn(), update: jest.fn() },
  reservation: { findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
  user: { findUnique: jest.fn() },
  starEvent: { create: jest.fn() },
  notification: { create: jest.fn() },
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
  ACTIVITY_TYPES: { RESERVATION: 'RESERVATION' },
}));
jest.mock('../../src/utils/stars', () => ({
  awardStars: jest.fn().mockResolvedValue(undefined),
  deductStars: jest.fn().mockResolvedValue(undefined),
  STAR_AMOUNTS: { RESERVATION: 5 }, RESERVATION_NO_SHOW_PENALTY: 10,
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
const ownerToken = createTestToken({ id: 'owner-1', email: 'o@test.com', role: 'RESTAURANT' });

const validBody = { placeId: 'place-1', date: '2026-12-01', time: '19:00', guestCount: 2 };
const restaurant = { id: 'r-1', businessName: 'Test', userId: 'owner-1', placeName: 'Test', tableCount: 2 };

const createdReservation = {
  id: 'res-1', ...validBody, restaurantId: 'r-1', placeName: 'Test', status: 'PENDING',
  userId: 'u-1', guestCount: 2, occasion: null, specialRequests: null, attended: null,
  createdAt: new Date(), updatedAt: new Date(),
  restaurant: { businessName: 'Test', userId: 'owner-1' },
  user: { displayName: 'User', email: 'u@test.com' },
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'USER', isSuspended: false });
  prisma.restaurantProfile.findFirst.mockResolvedValue(restaurant);
  prisma.reservation.findFirst.mockResolvedValue(null);
  prisma.reservation.count.mockResolvedValue(0);
  prisma.reservation.create.mockResolvedValue(createdReservation);
});

describe('POST /api/reservations — kapasite kontrolü', () => {
  it('kapasite doluysa 409 döner', async () => {
    prisma.reservation.count.mockResolvedValue(2); // tableCount=2, dolu
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/dolu/);
  });

  it('kapasite dolmamışsa 201 döner', async () => {
    prisma.reservation.count.mockResolvedValue(1); // 1/2 → yer var
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(201);
  });

  it('tableCount null ise kontrol atlanır, count çağrılmaz', async () => {
    prisma.restaurantProfile.findFirst.mockResolvedValue({ ...restaurant, tableCount: null });
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(201);
    expect(prisma.reservation.count).not.toHaveBeenCalled();
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post('/api/reservations').send(validBody);
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/restaurant-account/info — tableCount güncelleme', () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 'owner-1', role: 'RESTAURANT', isSuspended: false });
    prisma.restaurantProfile.update.mockResolvedValue({ ...restaurant, tableCount: 5 });
  });

  it('geçerli tableCount güncellenir', async () => {
    const res = await request(app)
      .put('/api/restaurant-account/info')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ tableCount: 5 });
    expect(res.status).toBe(200);
    expect(res.body.tableCount).toBe(5);
  });

  it('tableCount=null → sınırsız (200)', async () => {
    prisma.restaurantProfile.update.mockResolvedValue({ ...restaurant, tableCount: null });
    const res = await request(app)
      .put('/api/restaurant-account/info')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ tableCount: null });
    expect(res.status).toBe(200);
  });

  it('tableCount=0 → 400', async () => {
    const res = await request(app)
      .put('/api/restaurant-account/info')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ tableCount: 0 });
    expect(res.status).toBe(400);
  });

  it('tableCount=501 → 400', async () => {
    const res = await request(app)
      .put('/api/restaurant-account/info')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ tableCount: 501 });
    expect(res.status).toBe(400);
  });
});
