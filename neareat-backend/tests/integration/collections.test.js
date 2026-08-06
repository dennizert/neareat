/**
 * NearEat API — Collections Integration Tests
 *
 * Tested endpoints:
 *   GET    /api/collections                      — listMyCollections
 *   GET    /api/collections/shared-with-me       — listSharedWithMe
 *   GET    /api/collections/shared-by/:userId    — listSharedByUser
 *   GET    /api/collections/:id                  — getCollection
 *   POST   /api/collections                      — createCollection (Premium required)
 *   PUT    /api/collections/:id                  — updateCollection
 *   DELETE /api/collections/:id                  — deleteCollection
 *   POST   /api/collections/:id/items            — addItem (upsert)
 *   DELETE /api/collections/:id/items/:placeId   — removeItem
 *   POST   /api/collections/:id/share/:friendId  — shareWithFriend
 *   DELETE /api/collections/:id/share/:friendId  — unshareWithFriend
 */

const request = require('supertest');
const { createTestToken, createTestUser } = require('../helpers');

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

// ─── Helpers — the controller uses prisma.collectionItem.upsert and
//     prisma.collectionShare.upsert / deleteMany / collectionItem.deleteMany
//     which are not in the shared mockPrisma spec above. We attach them here
//     so individual tests can set them up with jest.fn(). ────────────────────

beforeAll(() => {
  // Extend mock objects with methods the controller actually calls but that
  // are absent from the minimal shared spec.
  mockPrisma.collectionItem.upsert = jest.fn();
  mockPrisma.collectionItem.deleteMany = jest.fn();
  mockPrisma.collectionShare.upsert = jest.fn();
  mockPrisma.collectionShare.deleteMany = jest.fn();
});

// ─── State ───────────────────────────────────────────────────────────────────

let testUser;
let testToken;
let testUser2;
let testToken2;

// A reusable collection owned by testUser.
const makeCollection = (overrides = {}) => ({
  id: 'col-1',
  userId: 'user-1',
  name: 'My Favourites',
  description: 'A test collection',
  isPublic: false,
  _count: { items: 2, shares: 1 },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  ...overrides,
});

// A reusable collection item.
const makeItem = (overrides = {}) => ({
  id: 'item-1',
  collectionId: 'col-1',
  placeId: 'ChIJplace1',
  placeName: 'Lezzet Durağı',
  placeAddress: 'Kadıköy, İstanbul',
  placePhotoUrl: 'https://example.com/photo.jpg',
  placeRating: 4.5,
  note: 'Great köfte',
  addedAt: new Date('2026-01-01T10:00:00Z'),
  ...overrides,
});

// A share record.
const makeShare = (sharedWithId = 'user-2', overrides = {}) => ({
  id: 'share-1',
  collectionId: 'col-1',
  sharedWithId,
  createdAt: new Date('2026-01-03T00:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();

  testUser = createTestUser({ id: 'user-1', email: 'user1@test.com', displayName: 'User One' });
  testToken = createTestToken(testUser.id);

  testUser2 = createTestUser({ id: 'user-2', email: 'user2@test.com', displayName: 'User Two' });
  testToken2 = createTestToken(testUser2.id);

  // Auth middleware: resolve the token owner.
  mockPrisma.user.findUnique.mockImplementation(({ where }) => {
    if (where.id === testUser.id) return Promise.resolve(testUser);
    if (where.id === testUser2.id) return Promise.resolve(testUser2);
    return Promise.resolve(null);
  });

  // Default subscription: no premium (most tests need this to be overridden for POST).
  mockPrisma.subscription.findUnique.mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/collections
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/collections', () => {
  it('returns 200 with the calling user\'s collections', async () => {
    const cols = [
      makeCollection({ _count: { items: 3, shares: 0 } }),
      makeCollection({ id: 'col-2', name: 'Weekend Picks', _count: { items: 1, shares: 2 } }),
    ];
    mockPrisma.collection.findMany.mockResolvedValue(cols);

    const res = await request(app)
      .get('/api/collections')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].itemCount).toBe(3);
    expect(res.body[0].shareCount).toBe(0);
    expect(res.body[1].name).toBe('Weekend Picks');
    // Sensitive internal fields must not leak.
    expect(res.body[0]).not.toHaveProperty('_count');
    expect(res.body[0]).not.toHaveProperty('userId');
  });

  it('returns 200 with empty array when user has no collections', async () => {
    mockPrisma.collection.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/collections')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/collections');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/collections/shared-with-me
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/collections/shared-with-me', () => {
  it('returns 200 with collections shared with the authenticated user', async () => {
    const shares = [
      {
        id: 'share-1',
        createdAt: new Date('2026-02-01T00:00:00Z'),
        collection: {
          id: 'col-99',
          name: 'Ali\'s Picks',
          description: 'By Ali',
          _count: { items: 5 },
          user: { id: 'user-3', displayName: 'Ali', photoUrl: null },
        },
      },
    ];
    mockPrisma.collectionShare.findMany.mockResolvedValue(shares);

    const res = await request(app)
      .get('/api/collections/shared-with-me')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].shareId).toBe('share-1');
    expect(res.body[0].collection.name).toBe('Ali\'s Picks');
    expect(res.body[0].collection.owner.displayName).toBe('Ali');
    expect(res.body[0].collection.itemCount).toBe(5);
  });

  it('returns 200 with empty array when nothing is shared with user', async () => {
    mockPrisma.collectionShare.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/collections/shared-with-me')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/collections/shared-with-me');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/collections/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/collections/:id', () => {
  it('returns 200 with full collection data for the owner', async () => {
    const col = {
      ...makeCollection(),
      user: { id: testUser.id, displayName: 'User One', photoUrl: null },
      items: [makeItem()],
      shares: [],
    };
    mockPrisma.collection.findUnique.mockResolvedValue(col);

    const res = await request(app)
      .get('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('col-1');
    expect(res.body.isOwner).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].placeName).toBe('Lezzet Durağı');
    // Owner can see sharedWith list.
    expect(Array.isArray(res.body.sharedWith)).toBe(true);
  });

  it('returns 200 when the collection is shared with the requesting user', async () => {
    const col = {
      ...makeCollection({ userId: testUser2.id, isPublic: false }),
      user: { id: testUser2.id, displayName: 'User Two', photoUrl: null },
      items: [],
      shares: [{ sharedWithId: testUser.id, sharedWith: { id: testUser.id, displayName: 'User One', photoUrl: null } }],
    };
    mockPrisma.collection.findUnique.mockResolvedValue(col);

    const res = await request(app)
      .get('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isOwner).toBe(false);
    // Non-owner should not see sharedWith list.
    expect(res.body.sharedWith).toEqual([]);
  });

  it('returns 200 for a public collection belonging to another user', async () => {
    const col = {
      ...makeCollection({ userId: testUser2.id, isPublic: true }),
      user: { id: testUser2.id, displayName: 'User Two', photoUrl: null },
      items: [],
      shares: [],
    };
    mockPrisma.collection.findUnique.mockResolvedValue(col);

    const res = await request(app)
      .get('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isOwner).toBe(false);
  });

  it('returns 403 for a private collection owned by another user with no share', async () => {
    const col = {
      ...makeCollection({ userId: testUser2.id, isPublic: false }),
      user: { id: testUser2.id, displayName: 'User Two', photoUrl: null },
      items: [],
      shares: [], // testUser is not in the share list
    };
    mockPrisma.collection.findUnique.mockResolvedValue(col);

    const res = await request(app)
      .get('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for a non-existent collection', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/collections/does-not-exist')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/collections
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/collections', () => {
  // S18-2: liste oluşturma yıldız SEVİYESİNE bağlı (premium kaldırıldı). L1 oluşturamaz,
  // L2+ sınırsız oluşturur. Seviyeyi starCount ile ayarlayan yardımcı (auth + getUserAccess
  // aynı user.findUnique'i okur).
  function setStarCount(stars) {
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === testUser.id) return Promise.resolve({ ...testUser, starCount: stars });
      if (where.id === testUser2.id) return Promise.resolve(testUser2);
      return Promise.resolve(null);
    });
  }

  it('returns 201 and the new collection for an L2+ user', async () => {
    setStarCount(50); // L2
    const created = makeCollection({ id: 'col-new', name: 'Best Brunch Spots', description: null, isPublic: false });
    mockPrisma.collection.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ name: 'Best Brunch Spots' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Best Brunch Spots');
    expect(res.body.itemCount).toBe(0);
    expect(res.body.shareCount).toBe(0);
  });

  it('returns 201 for an L2+ user creating multiple collections (no count limit)', async () => {
    setStarCount(50); // L2 → sınırsız liste
    const created = makeCollection({ id: 'col-free-1', name: 'İkinci Listem', description: null });
    mockPrisma.collection.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ name: 'İkinci Listem' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('İkinci Listem');
  });

  it('returns 403 LEVEL_REQUIRED for an L1 user creating a collection', async () => {
    setStarCount(5); // L1 → liste oluşturamaz

    const res = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ name: 'İlk Liste Denemesi' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LEVEL_REQUIRED');
    expect(res.body.requiredLevel).toBe(2);
  });

  it('returns 400 when name is missing', async () => {
    setStarCount(50);

    const res = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ description: 'No name provided' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/zorunlu/i);
  });

  it('returns 400 when name is only whitespace', async () => {
    setStarCount(50);

    const res = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ name: '   ' });

    expect(res.status).toBe(400);
  });

  it('truncates names longer than 100 characters and still returns 201', async () => {
    setStarCount(50);
    const longName = 'A'.repeat(120);
    const created = makeCollection({ id: 'col-trunc', name: 'A'.repeat(100) });
    mockPrisma.collection.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/collections')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ name: longName });

    expect(res.status).toBe(201);
    // The name passed to prisma create must have been sliced to ≤ 100 chars.
    const createCall = mockPrisma.collection.create.mock.calls[0][0];
    expect(createCall.data.name.length).toBeLessThanOrEqual(100);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/collections')
      .send({ name: 'Unauthorised' });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/collections/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/collections/:id', () => {
  it('returns 200 with the updated collection when called by the owner', async () => {
    const original = makeCollection();
    const updated = { ...original, name: 'Renamed Collection' };
    mockPrisma.collection.findUnique.mockResolvedValue(original);
    mockPrisma.collection.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ name: 'Renamed Collection' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Collection');
  });

  it('returns 403 when a non-owner attempts to update', async () => {
    // Collection belongs to testUser, but testUser2 is making the request.
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection({ userId: testUser.id }));

    const res = await request(app)
      .put('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken2}`)
      .send({ name: 'Hijack Attempt' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('returns 404 for a non-existent collection', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/collections/ghost-col')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ name: 'Doesn\'t matter' });

    expect(res.status).toBe(404);
  });

  it('allows partial updates (only isPublic)', async () => {
    const original = makeCollection({ isPublic: false });
    const updated = { ...original, isPublic: true };
    mockPrisma.collection.findUnique.mockResolvedValue(original);
    mockPrisma.collection.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ isPublic: true });

    expect(res.status).toBe(200);
    expect(res.body.isPublic).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/collections/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/collections/:id', () => {
  it('returns 200 and deletes the collection for the owner', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());
    mockPrisma.collection.delete.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.collection.delete).toHaveBeenCalledWith({ where: { id: 'col-1' } });
  });

  it('returns 403 when a non-owner attempts to delete', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection({ userId: testUser.id }));

    const res = await request(app)
      .delete('/api/collections/col-1')
      .set('Authorization', `Bearer ${testToken2}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.collection.delete).not.toHaveBeenCalled();
  });

  it('returns 404 for a non-existent collection', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/collections/ghost-col')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/collections/:id/items
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/collections/:id/items', () => {
  const validItemPayload = {
    placeId: 'ChIJplace1',
    placeName: 'Lezzet Durağı',
    placeAddress: 'Kadıköy, İstanbul',
    placePhotoUrl: 'https://example.com/photo.jpg',
    placeRating: 4.5,
    note: 'Great köfte',
  };

  it('returns 201 and the upserted item for the collection owner', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());
    mockPrisma.collectionItem.upsert.mockResolvedValue(makeItem());
    mockPrisma.collection.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/collections/col-1/items')
      .set('Authorization', `Bearer ${testToken}`)
      .send(validItemPayload);

    expect(res.status).toBe(201);
    expect(res.body.placeId).toBe('ChIJplace1');
    expect(res.body.placeName).toBe('Lezzet Durağı');
    // collection.update should be called to refresh updatedAt.
    expect(mockPrisma.collection.update).toHaveBeenCalledTimes(1);
  });

  it('handles duplicate item gracefully via upsert (returns 201 on re-add)', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());
    // Upsert returns the existing item with an updated note — same as the first add.
    mockPrisma.collectionItem.upsert.mockResolvedValue(makeItem({ note: 'Updated note' }));
    mockPrisma.collection.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/collections/col-1/items')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ ...validItemPayload, note: 'Updated note' });

    expect(res.status).toBe(201);
    expect(res.body.note).toBe('Updated note');
  });

  it('returns 400 when placeId is missing', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());

    const res = await request(app)
      .post('/api/collections/col-1/items')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ placeName: 'Some Place' }); // no placeId

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/placeId/);
  });

  it('returns 400 when placeName is missing', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());

    const res = await request(app)
      .post('/api/collections/col-1/items')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ placeId: 'ChIJplace1' }); // no placeName

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/placeName/);
  });

  it('returns 403 when a non-owner tries to add an item', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection({ userId: testUser.id }));

    const res = await request(app)
      .post('/api/collections/col-1/items')
      .set('Authorization', `Bearer ${testToken2}`)
      .send(validItemPayload);

    expect(res.status).toBe(403);
  });

  it('returns 404 when the collection does not exist', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/collections/ghost-col/items')
      .set('Authorization', `Bearer ${testToken}`)
      .send(validItemPayload);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/collections/:id/items/:placeId
// ═══════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/collections/:id/items/:placeId', () => {
  it('returns 200 and removes the item for the owner', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());
    mockPrisma.collectionItem.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete('/api/collections/col-1/items/ChIJplace1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.collectionItem.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: 'col-1', placeId: 'ChIJplace1' },
    });
  });

  it('returns 403 when a non-owner tries to remove an item', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection({ userId: testUser.id }));

    const res = await request(app)
      .delete('/api/collections/col-1/items/ChIJplace1')
      .set('Authorization', `Bearer ${testToken2}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.collectionItem.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the collection does not exist', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/collections/ghost-col/items/ChIJplace1')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 even when the item did not exist (deleteMany count 0)', async () => {
    // deleteMany is idempotent — the controller does not check the count.
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());
    mockPrisma.collectionItem.deleteMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .delete('/api/collections/col-1/items/non-existent-place')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/collections/:id/share/:friendId
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/collections/:id/share/:friendId', () => {
  const acceptedFriendship = { id: 'fr-1', status: 'ACCEPTED' };

  it('returns 201 when sharing with an accepted friend', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());
    mockPrisma.friendRequest.findFirst.mockResolvedValue(acceptedFriendship);
    const share = makeShare(testUser2.id);
    mockPrisma.collectionShare.upsert.mockResolvedValue(share);

    const res = await request(app)
      .post(`/api/collections/col-1/share/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(201);
    expect(res.body.sharedWithId).toBe(testUser2.id);
  });

  it('returns 403 when the target is not an accepted friend', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());
    mockPrisma.friendRequest.findFirst.mockResolvedValue(null); // no friendship

    const res = await request(app)
      .post(`/api/collections/col-1/share/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/arkadaş/i);
  });

  it('returns 400 when trying to share with yourself', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());

    const res = await request(app)
      .post(`/api/collections/col-1/share/${testUser.id}`) // self
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/kendinizle/i);
  });

  it('returns 403 when a non-owner tries to share the collection', async () => {
    // Collection belongs to testUser, request comes from testUser2.
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection({ userId: testUser.id }));

    const res = await request(app)
      .post(`/api/collections/col-1/share/user-3`)
      .set('Authorization', `Bearer ${testToken2}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when the collection does not exist', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/collections/ghost-col/share/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/collections/:id/share/:friendId
// ═══════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/collections/:id/share/:friendId', () => {
  it('returns 200 and removes the share for the owner', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection());
    mockPrisma.collectionShare.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete(`/api/collections/col-1/share/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(mockPrisma.collectionShare.deleteMany).toHaveBeenCalledWith({
      where: { collectionId: 'col-1', sharedWithId: testUser2.id },
    });
  });

  it('returns 403 when a non-owner tries to unshare', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(makeCollection({ userId: testUser.id }));

    const res = await request(app)
      .delete(`/api/collections/col-1/share/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken2}`);

    expect(res.status).toBe(403);
    expect(mockPrisma.collectionShare.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the collection does not exist', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/collections/ghost-col/share/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/collections/shared-by/:userId
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/collections/shared-by/:userId', () => {
  const acceptedFriendship = { id: 'fr-1', status: 'ACCEPTED' };

  it('returns 200 with collections that userId shared with the viewer', async () => {
    mockPrisma.friendRequest.findFirst.mockResolvedValue(acceptedFriendship);

    const shares = [
      {
        collection: {
          id: 'col-42',
          name: 'Ali\'s Hidden Gems',
          description: 'By Ali',
          isPublic: false,
          _count: { items: 7 },
          createdAt: new Date('2026-03-01T00:00:00Z'),
          updatedAt: new Date('2026-03-10T00:00:00Z'),
        },
      },
    ];
    mockPrisma.collectionShare.findMany.mockResolvedValue(shares);

    const res = await request(app)
      .get(`/api/collections/shared-by/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('col-42');
    expect(res.body[0].itemCount).toBe(7);
  });

  it('returns 403 when the target user is not a friend', async () => {
    mockPrisma.friendRequest.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/collections/shared-by/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with empty array when friend has not shared anything', async () => {
    mockPrisma.friendRequest.findFirst.mockResolvedValue(acceptedFriendship);
    mockPrisma.collectionShare.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/collections/shared-by/${testUser2.id}`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
