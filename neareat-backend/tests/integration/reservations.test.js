/**
 * NearEat Reservations API — Integration Tests
 *
 * Covers:
 * - POST   /api/reservations              — create reservation
 * - GET    /api/reservations/me           — user's own reservations
 * - GET    /api/reservations/restaurant   — restaurant's reservation list
 * - GET    /api/reservations/:id          — reservation detail
 * - DELETE /api/reservations/:id          — cancel reservation
 * - PUT    /api/reservations/:id          — update (edit) reservation
 * - PUT    /api/reservations/:id/status   — restaurant confirms / rejects
 *
 * Prisma, Firebase, Redis and Google Places are mocked — no real DB required.
 */

const request = require('supertest');
const { createTestToken, randomId, createTestUser } = require('../helpers');

// ─── Mocks (must come before require('../src/app')) ───────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  reservation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  restaurantProfile: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  reservationMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    createMany: jest.fn(),
  },
  userLog: {
    create: jest.fn(),
  },
  review: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  favorite: { count: jest.fn() },
  recommendation: { count: jest.fn() },
  subscription: { count: jest.fn(), findUnique: jest.fn() },
  starEvent: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  reward: { findMany: jest.fn() },
  userReward: { findMany: jest.fn(), create: jest.fn() },
  friendRequest: { findMany: jest.fn(), count: jest.fn() },
  message: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

jest.mock('../../src/utils/prisma', () => mockPrisma);

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid', email: 'test@test.com', name: 'Test' }),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  }),
  getMessaging: () => ({
    send: jest.fn().mockResolvedValue('message-id'),
  }),
}));

jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    incr: jest.fn(),
    pexpire: jest.fn(),
  }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/googlePlaces', () => ({
  getNearbyRestaurants: jest.fn().mockResolvedValue([]),
  getPlaceDetails: jest.fn().mockResolvedValue({}),
  getPhotoUrl: jest.fn().mockReturnValue('https://example.com/photo.jpg'),
}));

jest.mock('../../src/jobs/reservationReminders', () => ({
  scheduleReservationReminders: jest.fn(),
}));

// ─── App ─────────────────────────────────────────────────────────────────────

const app = require('../../src/app');

// ─── Test state ──────────────────────────────────────────────────────────────

let testUser;
let userToken;
let testRestaurantUser;
let restaurantToken;
let testOtherUser;
let otherUserToken;

// Shared mock data
const PLACE_ID = 'ChIJtest12345';
const FUTURE_DATE = '2027-06-15';
const PAST_DATE = '2020-01-01';
const VALID_TIME = '19:00';

const mockRestaurantProfile = {
  id: 'restaurant-profile-1',
  businessName: 'Test Restaurant',
  placeName: 'Test Restaurant',
  placeId: PLACE_ID,
  status: 'APPROVED',
  acceptsReservations: true,
  userId: 'restaurant-user-1',
};

const mockReservation = {
  id: 'reservation-1',
  userId: 'user-1',
  restaurantId: mockRestaurantProfile.id,
  placeId: PLACE_ID,
  placeName: 'Test Restaurant',
  date: FUTURE_DATE,
  time: VALID_TIME,
  guestCount: 2,
  occasion: null,
  specialRequests: null,
  status: 'PENDING',
  rejectionReason: null,
  attended: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 'user-1', displayName: 'Test User', photoUrl: null },
  restaurant: {
    id: mockRestaurantProfile.id,
    businessName: 'Test Restaurant',
    placePhotoUrl: null,
    userId: 'restaurant-user-1',
  },
};

beforeEach(() => {
  jest.clearAllMocks();

  testUser = createTestUser({
    id: 'user-1',
    email: 'user@neareat.com',
    displayName: 'Test User',
    role: 'USER',
    isSuspended: false,
  });
  userToken = createTestToken(testUser.id);

  testRestaurantUser = createTestUser({
    id: 'restaurant-user-1',
    email: 'restaurant@neareat.com',
    displayName: 'Restaurant Owner',
    role: 'RESTAURANT',
    isSuspended: false,
  });
  restaurantToken = createTestToken(testRestaurantUser.id);

  testOtherUser = createTestUser({
    id: 'other-user-1',
    email: 'other@neareat.com',
    displayName: 'Other User',
    role: 'USER',
    isSuspended: false,
  });
  otherUserToken = createTestToken(testOtherUser.id);

  // Default auth middleware resolver
  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === testUser.id) return Promise.resolve(testUser);
    if (where.id === testRestaurantUser.id) return Promise.resolve(testRestaurantUser);
    if (where.id === testOtherUser.id) return Promise.resolve(testOtherUser);
    return Promise.resolve(null);
  });

  // Silence side-effect mocks
  mockPrisma.userLog.create.mockResolvedValue({});
  mockPrisma.notification.create.mockResolvedValue({});
  mockPrisma.starEvent.create.mockResolvedValue({ id: 'se-1', amount: 10 });
  mockPrisma.reward.findMany.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation((ops) => Promise.all(ops));
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/reservations — Create
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/reservations', () => {
  it('should create a reservation for authenticated user → 201', async () => {
    mockPrisma.restaurantProfile.findFirst.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findFirst.mockResolvedValue(null); // no duplicate
    mockPrisma.reservation.create.mockResolvedValue(mockReservation);
    // awardStars side-effect mocks
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === testUser.id) return Promise.resolve(testUser);
      return Promise.resolve(null);
    });
    mockPrisma.$transaction.mockResolvedValue([
      { id: 'se-1', amount: 10 },
      { starCount: 10 },
    ]);

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        placeId: PLACE_ID,
        date: FUTURE_DATE,
        time: VALID_TIME,
        guestCount: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.placeName).toBe('Test Restaurant');
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: PLACE_ID, date: FUTURE_DATE }); // missing time and guestCount

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when guestCount is 0 (falsy → treated as missing)', async () => {
    // guestCount: 0 is falsy — the controller's !guestCount guard fires first,
    // returning the "required fields" error before the range check.
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: PLACE_ID, date: FUTURE_DATE, time: VALID_TIME, guestCount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when guestCount is negative', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: PLACE_ID, date: FUTURE_DATE, time: VALID_TIME, guestCount: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1-50/);
  });

  it('should return 400 when guestCount exceeds maximum (>50)', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: PLACE_ID, date: FUTURE_DATE, time: VALID_TIME, guestCount: 51 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1-50/);
  });

  it('should return 400 when date format is invalid', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: PLACE_ID, date: '15-06-2027', time: VALID_TIME, guestCount: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/YYYY-MM-DD/);
  });

  it('should return 400 when time format is invalid', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: PLACE_ID, date: FUTURE_DATE, time: '7pm', guestCount: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/HH:MM/);
  });

  it('should return 400 when restaurant does not accept reservations', async () => {
    mockPrisma.restaurantProfile.findFirst.mockResolvedValue(null); // not found / not accepting

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: 'nonexistent-place', date: FUTURE_DATE, time: VALID_TIME, guestCount: 2 });

    expect(res.status).toBe(400);
  });

  it('should return 409 when a duplicate reservation exists', async () => {
    mockPrisma.restaurantProfile.findFirst.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findFirst.mockResolvedValue(mockReservation); // duplicate exists

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ placeId: PLACE_ID, date: FUTURE_DATE, time: VALID_TIME, guestCount: 2 });

    expect(res.status).toBe(409);
  });

  it('should return 401 without token', async () => {
    const res = await request(app)
      .post('/api/reservations')
      .send({ placeId: PLACE_ID, date: FUTURE_DATE, time: VALID_TIME, guestCount: 2 });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/reservations/me — User's own reservations
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/reservations/me', () => {
  it('should return user\'s own reservations → 200', async () => {
    const reservations = [mockReservation, { ...mockReservation, id: 'reservation-2', status: 'CONFIRMED' }];
    mockPrisma.reservation.findMany.mockResolvedValue(reservations);

    const res = await request(app)
      .get('/api/reservations/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('should return empty array when user has no reservations', async () => {
    mockPrisma.reservation.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/reservations/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/reservations/me');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/reservations/:id — Reservation detail
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/reservations/:id', () => {
  it('should return reservation detail when accessed by the reservation owner → 200', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);

    const res = await request(app)
      .get(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(mockReservation.id);
  });

  it('should return reservation detail when accessed by the restaurant owner → 200', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);

    const res = await request(app)
      .get(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${restaurantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(mockReservation.id);
  });

  it('should return 403 when accessed by an unrelated user', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(mockReservation);

    const res = await request(app)
      .get(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 404 when reservation does not exist', async () => {
    mockPrisma.reservation.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/reservations/nonexistent-id')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/reservations/:id — Cancel reservation
// ═══════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/reservations/:id', () => {
  it('should cancel a PENDING reservation for its owner → 200', async () => {
    const pendingReservation = { ...mockReservation, status: 'PENDING' };
    mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
    mockPrisma.reservation.update.mockResolvedValue({ ...pendingReservation, status: 'CANCELLED' });

    const res = await request(app)
      .delete(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } }),
    );
  });

  it('should cancel a CONFIRMED reservation for its owner → 200', async () => {
    const confirmedReservation = { ...mockReservation, status: 'CONFIRMED' };
    mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);
    mockPrisma.reservation.update.mockResolvedValue({ ...confirmedReservation, status: 'CANCELLED' });

    const res = await request(app)
      .delete(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
  });

  it('should return 400 when trying to cancel an already CANCELLED reservation', async () => {
    const cancelledReservation = { ...mockReservation, status: 'CANCELLED' };
    mockPrisma.reservation.findUnique.mockResolvedValue(cancelledReservation);

    const res = await request(app)
      .delete(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when trying to cancel a COMPLETED reservation', async () => {
    const completedReservation = { ...mockReservation, status: 'COMPLETED' };
    mockPrisma.reservation.findUnique.mockResolvedValue(completedReservation);

    const res = await request(app)
      .delete(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
  });

  it('should return 404 when another user tries to cancel the reservation', async () => {
    const reservation = { ...mockReservation, userId: testUser.id };
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    const res = await request(app)
      .delete(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    // userId mismatch → 404 (controller returns 404 for ownership check)
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/reservations/:id — Update reservation
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/reservations/:id', () => {
  it('should update a PENDING reservation → 201 with new reservation', async () => {
    const pendingReservation = {
      ...mockReservation,
      status: 'PENDING',
      restaurant: { userId: testRestaurantUser.id, businessName: 'Test Restaurant' },
    };
    const newReservation = {
      ...mockReservation,
      id: 'reservation-new',
      date: '2027-07-20',
      time: '20:00',
      guestCount: 4,
      status: 'PENDING',
    };

    mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
    // $transaction returns [cancelled, newReservation]
    mockPrisma.$transaction.mockResolvedValue([
      { ...pendingReservation, status: 'CANCELLED' },
      newReservation,
    ]);

    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ date: '2027-07-20', time: '20:00', guestCount: 4 });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('reservation-new');
    expect(res.body.status).toBe('PENDING');
  });

  it('should return 400 when updating a REJECTED reservation', async () => {
    const rejectedReservation = {
      ...mockReservation,
      status: 'REJECTED',
      restaurant: { userId: testRestaurantUser.id, businessName: 'Test Restaurant' },
    };
    mockPrisma.reservation.findUnique.mockResolvedValue(rejectedReservation);

    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ date: FUTURE_DATE, time: VALID_TIME, guestCount: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ date: FUTURE_DATE }); // missing time and guestCount

    expect(res.status).toBe(400);
  });

  it('should return 400 when date format is invalid', async () => {
    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ date: '2027/07/20', time: VALID_TIME, guestCount: 2 });

    expect(res.status).toBe(400);
  });

  it('should return 404 when another user tries to update the reservation', async () => {
    const reservation = { ...mockReservation, userId: testUser.id };
    mockPrisma.reservation.findUnique.mockResolvedValue(reservation);

    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ date: FUTURE_DATE, time: VALID_TIME, guestCount: 2 });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/reservations/:id/status — Restaurant confirms or rejects
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/reservations/:id/status', () => {
  it('should confirm a PENDING reservation → 200', async () => {
    const pendingReservation = { ...mockReservation, status: 'PENDING', restaurantId: mockRestaurantProfile.id };
    const confirmedReservation = { ...pendingReservation, status: 'CONFIRMED' };

    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
    mockPrisma.reservation.update.mockResolvedValue(confirmedReservation);

    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}/status`)
      .set('Authorization', `Bearer ${restaurantToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('should reject a PENDING reservation with a reason → 200', async () => {
    const pendingReservation = { ...mockReservation, status: 'PENDING', restaurantId: mockRestaurantProfile.id };
    const rejectedReservation = {
      ...pendingReservation,
      status: 'REJECTED',
      rejectionReason: 'Tam kapasiteyiz',
    };

    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findUnique.mockResolvedValue(pendingReservation);
    mockPrisma.reservation.update.mockResolvedValue(rejectedReservation);

    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}/status`)
      .set('Authorization', `Bearer ${restaurantToken}`)
      .send({ status: 'REJECTED', rejectionReason: 'Tam kapasiteyiz' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.rejectionReason).toBe('Tam kapasiteyiz');
  });

  it('should return 400 when rejecting without a rejectionReason', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findUnique.mockResolvedValue({ ...mockReservation, status: 'PENDING', restaurantId: mockRestaurantProfile.id });

    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}/status`)
      .set('Authorization', `Bearer ${restaurantToken}`)
      .send({ status: 'REJECTED' }); // missing rejectionReason

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 for invalid status value', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(mockRestaurantProfile);

    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}/status`)
      .set('Authorization', `Bearer ${restaurantToken}`)
      .send({ status: 'CANCELLED' }); // only CONFIRMED and REJECTED are valid here

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when reservation is not PENDING', async () => {
    const confirmedReservation = { ...mockReservation, status: 'CONFIRMED', restaurantId: mockRestaurantProfile.id };

    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findUnique.mockResolvedValue(confirmedReservation);

    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}/status`)
      .set('Authorization', `Bearer ${restaurantToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(400);
  });

  it('should return 403 for regular USER accessing restaurant-only endpoint', async () => {
    const res = await request(app)
      .put(`/api/reservations/${mockReservation.id}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/reservations/restaurant — Restaurant's reservation list
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/reservations/restaurant', () => {
  it('should return all reservations for the authenticated restaurant → 200', async () => {
    const reservations = [
      mockReservation,
      { ...mockReservation, id: 'reservation-2', status: 'CONFIRMED' },
    ];
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findMany.mockResolvedValue(reservations);

    const res = await request(app)
      .get('/api/reservations/restaurant')
      .set('Authorization', `Bearer ${restaurantToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('should support status filter via query param', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findMany.mockResolvedValue([
      { ...mockReservation, status: 'PENDING' },
    ]);

    const res = await request(app)
      .get('/api/reservations/restaurant?status=PENDING')
      .set('Authorization', `Bearer ${restaurantToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].status).toBe('PENDING');
  });

  it('should support date filter via query param', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(mockRestaurantProfile);
    mockPrisma.reservation.findMany.mockResolvedValue([mockReservation]);

    const res = await request(app)
      .get(`/api/reservations/restaurant?date=${FUTURE_DATE}`)
      .set('Authorization', `Bearer ${restaurantToken}`);

    expect(res.status).toBe(200);
  });

  it('should return 404 when the user has no restaurant profile', async () => {
    mockPrisma.restaurantProfile.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/reservations/restaurant')
      .set('Authorization', `Bearer ${restaurantToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 for regular USER (not RESTAURANT role)', async () => {
    const res = await request(app)
      .get('/api/reservations/restaurant')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/reservations/restaurant');
    expect(res.status).toBe(401);
  });
});
