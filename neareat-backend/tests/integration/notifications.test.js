/**
 * NearEat API — Notifications Integration Tests
 *
 * Tested endpoints (from src/routes/notifications.js):
 *   GET  /api/notifications                  — getNotifications (paginated)
 *   GET  /api/notifications/unread-count     — getUnreadCount
 *   PUT  /api/notifications/:id/read         — markAsRead
 *   PUT  /api/notifications/read-all         — markAllAsRead
 *   PUT  /api/notifications/token            — updateFcmToken
 *   PUT  /api/notifications/preferences      — updatePreferences
 *
 * NOTE: Express evaluates routes in registration order.  In notifications.js,
 * PUT /read-all is registered *before* PUT /:id/read, so the literal segment
 * "read-all" is never captured as :id.  Tests for markAllAsRead must use the
 * exact path /api/notifications/read-all.
 */

const request = require('supertest');
const { createTestToken, randomId, createTestUser } = require('../helpers');

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  collection: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  collectionItem: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), count: jest.fn() },
  collectionShare: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
  notification: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  friendRequest: { findFirst: jest.fn(), findMany: jest.fn() },
  subscription: { findUnique: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};
jest.mock('../../src/utils/prisma', () => mockPrisma);
jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn().mockResolvedValue('msg-id') }),
}));
jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG'), incr: jest.fn().mockResolvedValue(1), pexpire: jest.fn() }),
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

const app = require('../../src/app');

// ─── Helpers ─────────────────────────────────────────────────────────────────

beforeAll(() => {
  // The notificationController calls prisma.user.update for FCM token.
  // Attach it to the existing user mock object.
  mockPrisma.user.update = jest.fn();
});

// Build a realistic notification record.
const makeNotification = (userId, overrides = {}) => ({
  id: `notif-${randomId()}`,
  userId,
  type: 'FRIEND_REQUEST',
  title: 'Yeni arkadaşlık isteği',
  body: 'User Two seni arkadaş olarak ekledi.',
  data: null,
  isRead: false,
  createdAt: new Date('2026-04-01T10:00:00Z'),
  ...overrides,
});

// ─── State ───────────────────────────────────────────────────────────────────

let testUser;
let testToken;
let testUser2;

beforeEach(() => {
  jest.clearAllMocks();

  testUser = createTestUser({ id: 'user-1', email: 'user1@test.com', displayName: 'User One' });
  testToken = createTestToken(testUser.id);

  testUser2 = createTestUser({ id: 'user-2', email: 'user2@test.com', displayName: 'User Two' });

  // Auth middleware: resolve the token owner via findUnique.
  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === testUser.id) return Promise.resolve(testUser);
    if (where.id === testUser2.id) return Promise.resolve(testUser2);
    return Promise.resolve(null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/notifications
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/notifications', () => {
  it('returns 200 with paginated notifications for the authenticated user', async () => {
    const notifs = [
      makeNotification(testUser.id, { id: 'notif-1', isRead: false }),
      makeNotification(testUser.id, { id: 'notif-2', isRead: true }),
    ];
    mockPrisma.notification.findMany.mockResolvedValue(notifs);
    mockPrisma.notification.count.mockResolvedValue(2);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.notifications[0].id).toBe('notif-1');
  });

  it('returns 200 with an empty list when user has no notifications', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.hasMore).toBe(false);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('respects page and limit query params', async () => {
    const notifs = [makeNotification(testUser.id, { id: 'notif-page2' })];
    mockPrisma.notification.findMany.mockResolvedValue(notifs);
    mockPrisma.notification.count.mockResolvedValue(25);

    const res = await request(app)
      .get('/api/notifications?page=2&limit=10')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    // 25 total, page 2 of 10 → skip=10, take=10, skip+limit=20 < 25 → hasMore true.
    expect(res.body.hasMore).toBe(true);
    // Verify findMany was called with correct skip/take.
    const findManyCall = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(findManyCall.skip).toBe(10);
    expect(findManyCall.take).toBe(10);
  });

  it('clamps limit to a maximum of 50', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    await request(app)
      .get('/api/notifications?limit=200')
      .set('Authorization', `Bearer ${testToken}`);

    const findManyCall = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(50);
  });

  it('defaults page to 1 when page param is invalid', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    await request(app)
      .get('/api/notifications?page=-5')
      .set('Authorization', `Bearer ${testToken}`);

    const findManyCall = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(findManyCall.skip).toBe(0); // page=1 → skip=0
  });

  it('only returns notifications belonging to the requesting user', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${testToken}`);

    const findManyCall = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(findManyCall.where.userId).toBe(testUser.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/notifications/unread-count
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/notifications/unread-count', () => {
  it('returns 200 with the count of unread notifications', async () => {
    mockPrisma.notification.count.mockResolvedValue(7);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 7 });
  });

  it('returns count 0 when there are no unread notifications', async () => {
    mockPrisma.notification.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('queries only the requesting user\'s unread notifications', async () => {
    mockPrisma.notification.count.mockResolvedValue(3);

    await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${testToken}`);

    const countCall = mockPrisma.notification.count.mock.calls[0][0];
    expect(countCall.where.userId).toBe(testUser.id);
    expect(countCall.where.isRead).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/notifications/:id/read
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/notifications/:id/read', () => {
  it('returns 200 and marks a notification as read for its owner', async () => {
    const notif = makeNotification(testUser.id, { id: 'notif-abc', isRead: false });
    mockPrisma.notification.findUnique.mockResolvedValue(notif);
    mockPrisma.notification.update.mockResolvedValue({ ...notif, isRead: true });

    const res = await request(app)
      .put('/api/notifications/notif-abc/read')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-abc' },
      data: { isRead: true },
    });
  });

  it('returns 404 when the notification belongs to another user', async () => {
    // Notification belongs to testUser2, request comes from testUser.
    const notif = makeNotification(testUser2.id, { id: 'notif-other' });
    mockPrisma.notification.findUnique.mockResolvedValue(notif);

    const res = await request(app)
      .put('/api/notifications/notif-other/read')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    // update must not have been called.
    expect(mockPrisma.notification.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the notification does not exist', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/notifications/ghost-notif/read')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
    expect(mockPrisma.notification.update).not.toHaveBeenCalled();
  });

  it('returns 200 even when the notification was already read', async () => {
    const notif = makeNotification(testUser.id, { id: 'notif-already-read', isRead: true });
    mockPrisma.notification.findUnique.mockResolvedValue(notif);
    mockPrisma.notification.update.mockResolvedValue(notif);

    const res = await request(app)
      .put('/api/notifications/notif-already-read/read')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/notifications/notif-abc/read');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/notifications/read-all
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/notifications/read-all', () => {
  it('returns 200 and marks all unread notifications as read', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: testUser.id, isRead: false },
      data: { isRead: true },
    });
  });

  it('returns 200 when there are no unread notifications (count 0)', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
  });

  it('only marks notifications for the requesting user', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 });

    await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${testToken}`);

    const updateManyCall = mockPrisma.notification.updateMany.mock.calls[0][0];
    expect(updateManyCall.where.userId).toBe(testUser.id);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).put('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/notifications/token
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/notifications/token', () => {
  it('returns 200 and updates the FCM token', async () => {
    mockPrisma.user.update.mockResolvedValue({ ...testUser, fcmToken: 'new-fcm-token-abc' });

    const res = await request(app)
      .put('/api/notifications/token')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ fcmToken: 'new-fcm-token-abc' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: testUser.id },
      data: { fcmToken: 'new-fcm-token-abc' },
    });
  });

  it('returns 400 when fcmToken is missing from the request body', async () => {
    const res = await request(app)
      .put('/api/notifications/token')
      .set('Authorization', `Bearer ${testToken}`)
      .send({}); // no fcmToken field

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 400 when fcmToken is an empty string', async () => {
    const res = await request(app)
      .put('/api/notifications/token')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ fcmToken: '' });

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .put('/api/notifications/token')
      .send({ fcmToken: 'some-token' });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/notifications/preferences
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/notifications/preferences', () => {
  it('returns 200 for an authenticated user (stub implementation)', async () => {
    const res = await request(app)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ friendRequests: true, messages: false });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .put('/api/notifications/preferences')
      .send({ friendRequests: true });

    expect(res.status).toBe(401);
  });
});
