/**
 * NearEat Admin API — Integration Tests
 *
 * Covers:
 * - POST /api/admin/login
 * - GET  /api/admin/stats
 * - GET  /api/admin/restaurants
 * - POST /api/admin/restaurants/:id/approve
 * - POST /api/admin/restaurants/:id/reject
 * - GET  /api/admin/users
 * - POST /api/admin/users/:id/suspend
 * - POST /api/admin/users/:id/unsuspend
 * - GET  /api/admin/reviews
 * - DELETE /api/admin/reviews/:id
 * - GET  /api/admin/reports
 * - PUT  /api/admin/reports/:id
 * - POST /api/admin/seed
 *
 * Prisma, Firebase, Redis and Google Places are mocked — no real DB required.
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');
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
  restaurantProfile: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  review: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  userReport: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  userLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  favorite: { count: jest.fn() },
  recommendation: { count: jest.fn() },
  subscription: { count: jest.fn(), findUnique: jest.fn() },
  notification: { create: jest.fn(), createMany: jest.fn() },
  starEvent: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  reward: { findMany: jest.fn() },
  userReward: { findMany: jest.fn(), create: jest.fn() },
  friendRequest: { findMany: jest.fn(), count: jest.fn() },
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

let testAdminUser;
let adminToken;
let testRegularUser;
let userToken;

beforeEach(() => {
  jest.clearAllMocks();

  testAdminUser = createTestUser({
    id: 'admin-user-1',
    email: 'admin@neareat.com',
    displayName: 'Admin User',
    role: 'ADMIN',
    isSuspended: false,
    passwordHash: '$2a$12$hashedpassword', // bcrypt hash placeholder
  });
  adminToken = createTestToken(testAdminUser.id);

  testRegularUser = createTestUser({
    id: 'regular-user-1',
    email: 'user@neareat.com',
    displayName: 'Regular User',
    role: 'USER',
    isSuspended: false,
  });
  userToken = createTestToken(testRegularUser.id);

  // Default auth middleware resolver
  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === testAdminUser.id) return Promise.resolve(testAdminUser);
    if (where.id === testRegularUser.id) return Promise.resolve(testRegularUser);
    if (where.email === testAdminUser.email) return Promise.resolve(testAdminUser);
    if (where.email === testRegularUser.email) return Promise.resolve(testRegularUser);
    return Promise.resolve(null);
  });

  // logService uses prisma.userLog.create — silence it
  mockPrisma.userLog.create.mockResolvedValue({});
  // notification create — silence it
  mockPrisma.notification.create.mockResolvedValue({});
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/login
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/login', () => {
  it('should return token on valid admin credentials', async () => {
    const plainPassword = 'admin-password-123';
    const passwordHash = await bcrypt.hash(plainPassword, 4); // low cost for tests
    const adminWithHash = { ...testAdminUser, passwordHash };

    mockPrisma.user.findUnique.mockResolvedValueOnce(adminWithHash);

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: testAdminUser.email, password: plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('should return 401 on wrong password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const adminWithHash = { ...testAdminUser, passwordHash };

    mockPrisma.user.findUnique.mockResolvedValueOnce(adminWithHash);

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: testAdminUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should return 401 for non-admin user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(testRegularUser);

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: testRegularUser.email, password: 'any-password' });

    expect(res.status).toBe(401);
  });

  it('should return 400 when email or password is missing', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'admin@neareat.com' }); // no password

    expect(res.status).toBe(400);
  });

  it('should return 401 when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'nobody@neareat.com', password: 'whatever' });

    expect(res.status).toBe(401);
  });

  // ─── S12-6: brute-force koruması (hesap kilidi) ───
  const redisMock = require('../../src/services/redis');

  it('eşik aşıldığında 429 döner ve prisma sorgulanmaz (hesap kilidi)', async () => {
    redisMock.cacheGet.mockResolvedValueOnce(5); // ADMIN_LOGIN_MAX_FAILS

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: testAdminUser.email, password: 'whatever' });

    expect(res.status).toBe(429);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('başarısız girişte başarısızlık sayacı kaydedilir (cacheSet)', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...testAdminUser, passwordHash });

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: testAdminUser.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(redisMock.cacheSet).toHaveBeenCalledWith(
      expect.stringContaining('admin-login-fail:'),
      1,
      expect.any(Number),
    );
  });

  it('başarılı girişte sayaç sıfırlanır (cacheDel)', async () => {
    const plainPassword = 'admin-password-123';
    const passwordHash = await bcrypt.hash(plainPassword, 4);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...testAdminUser, passwordHash });

    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: testAdminUser.email, password: plainPassword });

    expect(res.status).toBe(200);
    expect(redisMock.cacheDel).toHaveBeenCalledWith(expect.stringContaining('admin-login-fail:'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/stats
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/stats', () => {
  const statsCountMock = () => {
    // getPlatformStats fires 12 Promise.all count calls
    mockPrisma.user.count.mockResolvedValue(100);
    mockPrisma.restaurantProfile.count.mockResolvedValue(25);
    mockPrisma.review.count.mockResolvedValue(300);
    mockPrisma.favorite.count.mockResolvedValue(500);
    mockPrisma.recommendation.count.mockResolvedValue(200);
    mockPrisma.subscription.count.mockResolvedValue(50);
  };

  it('should return platform stats for admin user', async () => {
    statsCountMock();

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeDefined();
    expect(res.body.totalRestaurants).toBeDefined();
    expect(res.body.approvedRestaurants).toBeDefined();
    expect(res.body.pendingRestaurants).toBeDefined();
    expect(res.body.totalReviews).toBeDefined();
    expect(res.body.newUsersToday).toBeDefined();
    expect(res.body.activeUsersToday).toBeDefined();
  });

  it('should return 403 for non-admin USER token', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 401 without any token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/restaurants
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/restaurants', () => {
  it('should return paginated list of pending restaurants for admin', async () => {
    const mockProfiles = [
      {
        id: 'profile-1',
        businessName: 'Test Restaurant',
        ownerName: 'Owner',
        status: 'PENDING',
        createdAt: new Date(),
        user: { id: 'user-r1', email: 'rest@test.com', displayName: 'Rest User' },
      },
    ];
    mockPrisma.restaurantProfile.findMany.mockResolvedValue(mockProfiles);
    mockPrisma.restaurantProfile.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/admin/restaurants')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profiles).toBeDefined();
    expect(Array.isArray(res.body.profiles)).toBe(true);
    expect(res.body.total).toBe(1);
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/restaurants')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('should support status filter via query param', async () => {
    mockPrisma.restaurantProfile.findMany.mockResolvedValue([]);
    mockPrisma.restaurantProfile.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/admin/restaurants?status=APPROVED')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profiles).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/restaurants/:id/approve
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/restaurants/:id/approve', () => {
  it('should approve a restaurant and return updated profile', async () => {
    const profileId = 'profile-pending-1';
    const updatedProfile = {
      id: profileId,
      businessName: 'Good Restaurant',
      status: 'APPROVED',
      approvedAt: new Date(),
      user: { id: 'user-r1', email: 'rest@test.com', displayName: 'Owner' },
    };
    mockPrisma.restaurantProfile.update.mockResolvedValue(updatedProfile);

    const res = await request(app)
      .post(`/api/admin/restaurants/${profileId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(mockPrisma.restaurantProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: profileId },
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .post('/api/admin/restaurants/some-id/approve')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/restaurants/:id/reject
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/restaurants/:id/reject', () => {
  it('should reject a restaurant with a reason', async () => {
    const profileId = 'profile-pending-2';
    const updatedProfile = {
      id: profileId,
      businessName: 'Bad Restaurant',
      status: 'REJECTED',
      rejectionReason: 'Belgeler eksik',
      user: { id: 'user-r2', email: 'rest2@test.com', displayName: 'Owner 2' },
    };
    mockPrisma.restaurantProfile.update.mockResolvedValue(updatedProfile);

    const res = await request(app)
      .post(`/api/admin/restaurants/${profileId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'Belgeler eksik' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.rejectionReason).toBe('Belgeler eksik');
  });

  it('should return 400 when rejectionReason is missing', async () => {
    const res = await request(app)
      .post('/api/admin/restaurants/profile-1/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when rejectionReason is blank whitespace', async () => {
    const res = await request(app)
      .post('/api/admin/restaurants/profile-1/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: '   ' });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/users', () => {
  it('should return paginated user list for admin', async () => {
    const mockUsers = [
      {
        id: 'u1', email: 'alice@test.com', displayName: 'Alice',
        role: 'USER', isSuspended: false, starCount: 10, createdAt: new Date(),
        subscription: null,
      },
    ];
    mockPrisma.user.findMany.mockResolvedValue(mockUsers);
    mockPrisma.user.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });

  it('should support search query param', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/admin/users?search=alice')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/users/:id/suspend
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/users/:id/suspend', () => {
  it('should suspend a user and return updated record', async () => {
    const targetUserId = 'target-user-99';
    const suspendedUser = {
      id: targetUserId, email: 'bad@test.com', displayName: 'Bad Actor', isSuspended: true,
    };
    mockPrisma.user.update.mockResolvedValue(suspendedUser);

    const res = await request(app)
      .post(`/api/admin/users/${targetUserId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuspended).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetUserId },
        data: { isSuspended: true },
      }),
    );
  });

  it('should return 400 if admin tries to suspend themselves', async () => {
    const res = await request(app)
      .post(`/api/admin/users/${testAdminUser.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .post('/api/admin/users/some-user/suspend')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/users/:id/unsuspend
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/users/:id/unsuspend', () => {
  it('should unsuspend a user', async () => {
    const targetUserId = 'suspended-user-1';
    const unsuspendedUser = {
      id: targetUserId, email: 'reformed@test.com', displayName: 'Reformed User', isSuspended: false,
    };
    mockPrisma.user.update.mockResolvedValue(unsuspendedUser);

    const res = await request(app)
      .post(`/api/admin/users/${targetUserId}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isSuspended).toBe(false);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: targetUserId },
        data: { isSuspended: false },
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/reviews
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/reviews', () => {
  it('should return recent reviews for moderation', async () => {
    const mockReviews = [
      {
        id: 'rev-1', placeId: 'place-1', rating: 1, body: 'Terrible!',
        user: { id: 'u1', displayName: 'User One', email: 'u1@test.com' },
        reply: null,
        createdAt: new Date(),
      },
    ];
    mockPrisma.review.findMany.mockResolvedValue(mockReviews);

    const res = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe('rev-1');
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/reviews/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/admin/reviews/:id', () => {
  it('should delete a review by id', async () => {
    const reviewId = 'review-to-delete-1';
    const mockReview = { id: reviewId, placeId: 'place-1', rating: 1, body: 'Bad review' };

    mockPrisma.review.findUnique.mockResolvedValue(mockReview);
    mockPrisma.review.delete.mockResolvedValue(mockReview);

    const res = await request(app)
      .delete(`/api/admin/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.review.delete).toHaveBeenCalledWith({ where: { id: reviewId } });
  });

  it('should return 404 if review does not exist', async () => {
    mockPrisma.review.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/admin/reviews/nonexistent-review')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .delete('/api/admin/reviews/rev-1')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/reports
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/admin/reports', () => {
  it('should return paginated pending reports', async () => {
    const mockReports = [
      {
        id: 'report-1',
        reason: 'Spam',
        status: 'PENDING',
        reporter: { id: 'u1', displayName: 'Reporter', email: 'r@test.com' },
        reported: { id: 'u2', displayName: 'Reported', email: 'b@test.com', isSuspended: false, role: 'USER' },
        createdAt: new Date(),
      },
    ];
    mockPrisma.userReport.findMany.mockResolvedValue(mockReports);
    mockPrisma.userReport.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reports).toBeDefined();
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(res.body.total).toBe(1);
  });

  it('should support status=ALL query param', async () => {
    mockPrisma.userReport.findMany.mockResolvedValue([]);
    mockPrisma.userReport.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/admin/reports?status=ALL')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/reports/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/admin/reports/:id', () => {
  const reportId = 'report-to-handle-1';
  const mockReport = {
    id: reportId,
    status: 'PENDING',
    reporterId: 'reporter-user-1',
    reportedId: 'reported-user-1',
    reporter: { id: 'reporter-user-1' },
    reported: { id: 'reported-user-1', displayName: 'Bad Actor' },
  };

  it('should handle report with action=dismiss', async () => {
    mockPrisma.userReport.findUnique.mockResolvedValue(mockReport);
    mockPrisma.userReport.update.mockResolvedValue({ ...mockReport, status: 'DISMISSED' });

    const res = await request(app)
      .put(`/api/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'dismiss' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.userReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: reportId },
        data: expect.objectContaining({ status: 'DISMISSED' }),
      }),
    );
  });

  it('should handle report with action=suspend and also suspend the reported user', async () => {
    mockPrisma.userReport.findUnique.mockResolvedValue(mockReport);
    mockPrisma.user.update.mockResolvedValue({ id: mockReport.reportedId, isSuspended: true });
    mockPrisma.userReport.update.mockResolvedValue({ ...mockReport, status: 'RESOLVED' });

    const res = await request(app)
      .put(`/api/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'suspend' });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isSuspended: true } }),
    );
  });

  it('should handle report with action=warn', async () => {
    mockPrisma.userReport.findUnique.mockResolvedValue(mockReport);
    mockPrisma.userReport.update.mockResolvedValue({ ...mockReport, status: 'RESOLVED' });

    const res = await request(app)
      .put(`/api/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'warn', actionNote: 'Uyarı verildi' });

    expect(res.status).toBe(200);
  });

  it('should return 400 for invalid action', async () => {
    const res = await request(app)
      .put(`/api/admin/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'delete' }); // not a valid action

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 404 when report does not exist', async () => {
    mockPrisma.userReport.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/admin/reports/nonexistent-report')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'dismiss' });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/seed
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/seed', () => {
  const SEED_SECRET = 'test-seed-secret-value';

  beforeEach(() => {
    process.env.ADMIN_SEED_SECRET = SEED_SECRET;
  });

  afterEach(() => {
    delete process.env.ADMIN_SEED_SECRET;
  });

  it('should create admin if no admin exists and secret is valid', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null); // no admin yet
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-admin-id',
      email: 'newadmin@neareat.com',
      displayName: 'New Admin',
      role: 'ADMIN',
    });

    const res = await request(app)
      .post('/api/admin/seed')
      .set('x-seed-secret', SEED_SECRET)
      .send({ email: 'newadmin@neareat.com', password: 'SecurePass123!', displayName: 'New Admin' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('ADMIN');
    expect(res.body.email).toBe('newadmin@neareat.com');
  });

  it('should return 409 if admin already exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(testAdminUser); // admin exists

    const res = await request(app)
      .post('/api/admin/seed')
      .set('x-seed-secret', SEED_SECRET)
      .send({ email: 'anyadmin@neareat.com', password: 'SecurePass123!', displayName: 'Any Admin' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();
  });

  it('should return 403 when wrong seed secret is provided', async () => {
    const res = await request(app)
      .post('/api/admin/seed')
      .set('x-seed-secret', 'wrong-secret')
      .send({ email: 'admin@neareat.com', password: 'SecurePass123!', displayName: 'Admin' });

    expect(res.status).toBe(403);
  });

  it('should return 503 when ADMIN_SEED_SECRET env var is not set', async () => {
    delete process.env.ADMIN_SEED_SECRET;

    const res = await request(app)
      .post('/api/admin/seed')
      .set('x-seed-secret', 'any-secret')
      .send({ email: 'admin@neareat.com', password: 'SecurePass123!', displayName: 'Admin' });

    expect(res.status).toBe(503);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/admin/seed')
      .set('x-seed-secret', SEED_SECRET)
      .send({ email: 'admin@neareat.com' }); // missing password and displayName

    expect(res.status).toBe(400);
  });
});
