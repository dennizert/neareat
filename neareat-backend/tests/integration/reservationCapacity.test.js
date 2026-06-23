'use strict';

jest.mock('../../src/utils/prisma', () => ({
  restaurantProfile: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  reservation: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
  user: { findUnique: jest.fn() },
  subscription: { findUnique: jest.fn() },
  starEvent: { create: jest.fn() },
  notification: { create: jest.fn() },
  $transaction: jest.fn(),
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
  // S18-2: levelAccess getLevel'i buradan okur — eşiklerle uyumlu mock.
  getLevel: (s) => ({
    level: s >= 250 ? 5 : s >= 150 ? 4 : s >= 100 ? 3 : s >= 50 ? 2 : 1,
    badge: '', badgeIcon: '',
  }),
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
  // S18-2: kapasite testleri L5 (sınırsız rezervasyon) kullanıcıyla çalışır → seviye gate
  // atlanır, yalnızca kapasite kontrolü test edilir. Seviye limiti ayrı describe'da.
  prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'USER', isSuspended: false, starCount: 250 });
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

describe('POST /api/reservations — L1 seviye rezervasyon kısıtı (S18-2)', () => {
  beforeEach(() => {
    // L1 kullanıcı (starCount düşük) → yalnızca İLK (onboarding) rezervasyon
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'USER', isSuspended: false, starCount: 5 });
  });

  it('ilk rezervasyon (geçmişte 0) → 201 (onboarding herkese açık)', async () => {
    prisma.reservation.count.mockResolvedValue(0);
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(201);
  });

  it('ikinci rezervasyon (geçmişte 1) → 403 LEVEL_REQUIRED (Seviye 2 gerekir)', async () => {
    prisma.reservation.count.mockResolvedValue(1);
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LEVEL_REQUIRED');
    expect(res.body.requiredLevel).toBe(2);
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

// ─────────────────────────────────────────────────────────────────────────────
// fix/#161 — PUT /api/reservations/:id yeni slot kapasite kontrolü
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/reservations/:id — güncelleme sırasında kapasite kontrolü', () => {
  const existingReservation = {
    id: 'res-1', userId: 'u-1', restaurantId: 'r-1', placeId: 'place-1',
    placeName: 'Test', date: '2026-12-01', time: '19:00', guestCount: 2,
    status: 'PENDING',
    restaurant: { userId: 'owner-1', businessName: 'Test' },
  };
  const newReservation = {
    id: 'res-2', userId: 'u-1', restaurantId: 'r-1', placeId: 'place-1',
    placeName: 'Test', date: '2026-12-02', time: '20:00', guestCount: 2,
    status: 'PENDING',
    restaurant: { userId: 'owner-1', businessName: 'Test' },
    user: { id: 'u-1', displayName: 'User', photoUrl: null },
  };

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', role: 'USER', isSuspended: false });
    prisma.reservation.findUnique.mockResolvedValue(existingReservation);
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'r-1', tableCount: 2 });
    prisma.reservation.count.mockResolvedValue(0);
    prisma.$transaction.mockResolvedValue([{ ...existingReservation, status: 'CANCELLED' }, newReservation]);
  });

  it('yeni slot doluysa 409 döner', async () => {
    prisma.reservation.count.mockResolvedValue(2); // tableCount=2, dolu
    const res = await request(app)
      .put('/api/reservations/res-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-12-02', time: '20:00', guestCount: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/dolu/);
  });

  it('yeni slot dolmamışsa güncelleme başarılı 201', async () => {
    prisma.reservation.count.mockResolvedValue(1); // 1/2 → yer var
    const res = await request(app)
      .put('/api/reservations/res-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-12-02', time: '20:00', guestCount: 2 });
    expect(res.status).toBe(201);
  });

  it('tableCount=null ise kapasite kontrolü atlanır', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'r-1', tableCount: null });
    const res = await request(app)
      .put('/api/reservations/res-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-12-02', time: '20:00', guestCount: 2 });
    expect(res.status).toBe(201);
    expect(prisma.reservation.count).not.toHaveBeenCalled();
  });
});
