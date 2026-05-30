'use strict';

/**
 * Sprint-8 #99 — Koleksiyon sıralama + unique constraint testleri.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const COL = { id: 'col-1', userId: 'u-1', name: 'Test', isPublic: false };
const ITEM_NEW = { id: 'item-1', collectionId: 'col-1', placeId: 'p1', placeName: 'Köşk', placeRating: 4.5, addedAt: new Date('2026-01-01') };
const ITEM_OLD = { id: 'item-2', collectionId: 'col-1', placeId: 'p2', placeName: 'Eski', placeRating: 3.8, addedAt: new Date('2025-06-01') };

const mockPrisma = {
  user: { findUnique: jest.fn() },
  collection: { findUnique: jest.fn(), update: jest.fn() },
  collectionItem: { findUnique: jest.fn(), upsert: jest.fn() },
  subscription: { findUnique: jest.fn() },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

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

jest.mock('../../src/services/notificationService', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const userId = 'u-1';
const token = createTestToken({ id: userId, email: 'u@test.com', role: 'USER' });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'User', starCount: 0, isSuspended: false,
  });
  mockPrisma.subscription.findUnique.mockResolvedValue({ status: 'active', expiresAt: new Date(Date.now() + 86400000) });
  mockPrisma.collection.update.mockResolvedValue({});
});

function mockCollectionWithItems(items) {
  mockPrisma.collection.findUnique.mockResolvedValue({
    ...COL,
    user: { id: userId, displayName: 'User', photoUrl: null },
    items,
    shares: [],
  });
}

describe('GET /api/collections/:id — sıralama', () => {
  const PATH = `/api/collections/col-1`;

  it('varsayılan sıralama addedAt desc', async () => {
    mockCollectionWithItems([ITEM_NEW, ITEM_OLD]);
    const res = await request(app).get(PATH).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items[0].placeId).toBe('p1');
  });

  it('?sortBy=addedAt_asc: eski önce', async () => {
    mockCollectionWithItems([ITEM_OLD, ITEM_NEW]);
    const res = await request(app).get(`${PATH}?sortBy=addedAt_asc`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Mock DB'yi simüle etmez; sorgu parametresinin orderBy'a iletildiğini doğrularız
    expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          items: { orderBy: { addedAt: 'asc' } },
        }),
      }),
    );
  });

  it('?sortBy=rating: placeRating desc', async () => {
    mockCollectionWithItems([ITEM_NEW, ITEM_OLD]);
    const res = await request(app).get(`${PATH}?sortBy=rating`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          items: { orderBy: { placeRating: 'desc' } },
        }),
      }),
    );
  });

  it('geçersiz sortBy varsayılana düşer', async () => {
    mockCollectionWithItems([ITEM_NEW]);
    const res = await request(app).get(`${PATH}?sortBy=invalid`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockPrisma.collection.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          items: { orderBy: { addedAt: 'desc' } },
        }),
      }),
    );
  });
});

describe('POST /api/collections/:id/items — duplicate', () => {
  const PATH = `/api/collections/col-1/items`;
  const BODY = { placeId: 'p1', placeName: 'Köşk', placeRating: 4.5 };

  it('yeni mekan → 201', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue({ ...COL, shares: [] });
    mockPrisma.collectionItem.findUnique.mockResolvedValue(null);
    mockPrisma.collectionItem.upsert.mockResolvedValue(ITEM_NEW);
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`).send(BODY);
    expect(res.status).toBe(201);
  });

  it('mevcut mekan → 200 (upsert, note güncellenir)', async () => {
    mockPrisma.collection.findUnique.mockResolvedValue({ ...COL, shares: [] });
    mockPrisma.collectionItem.findUnique.mockResolvedValue(ITEM_NEW);
    mockPrisma.collectionItem.upsert.mockResolvedValue({ ...ITEM_NEW, note: 'güncellendi' });
    const res = await request(app).post(PATH).set('Authorization', `Bearer ${token}`).send({ ...BODY, note: 'güncellendi' });
    expect(res.status).toBe(200);
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post(PATH).send(BODY);
    expect(res.status).toBe(401);
  });
});
