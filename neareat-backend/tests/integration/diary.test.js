'use strict';

/**
 * Sprint-7 #93 — Diary endpoint integration testleri.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  subscription: { findUnique: jest.fn() },
  diaryEntry: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ verifyIdToken: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));

jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
}));

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
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'U', starCount: 0, isSuspended: false,
  });
  mockPrisma.diaryEntry.count.mockResolvedValue(0);
  mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
  mockPrisma.diaryEntry.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.diaryEntry.create.mockImplementation(({ data }) => Promise.resolve({
    id: 'd-1', ...data,
  }));
});

describe('POST /api/diary', () => {
  it('placeId yoksa 400', async () => {
    const res = await request(app).post('/api/diary').set('Authorization', `Bearer ${token}`)
      .send({ placeName: 'Test' });
    expect(res.status).toBe(400);
  });

  it('placeName yoksa 400', async () => {
    const res = await request(app).post('/api/diary').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1' });
    expect(res.status).toBe(400);
  });

  it('visitedAt geçersizse 400', async () => {
    const res = await request(app).post('/api/diary').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'X', visitedAt: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('başarılı ekleme: 201, varsayılan visitedAt now', async () => {
    const res = await request(app).post('/api/diary').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'Köşk Kebap', note: 'Harika kebap' });
    expect(res.status).toBe(201);
    expect(mockPrisma.diaryEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId, placeId: 'p1', placeName: 'Köşk Kebap', note: 'Harika kebap',
      }),
    }));
    const visitedAt = mockPrisma.diaryEntry.create.mock.calls[0][0].data.visitedAt;
    expect(visitedAt).toBeInstanceOf(Date);
  });

  it('placeTypes en fazla 20 ile sınırlı', async () => {
    const tooMany = Array.from({ length: 50 }, (_, i) => `t${i}`);
    await request(app).post('/api/diary').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'X', placeTypes: tooMany });
    const stored = mockPrisma.diaryEntry.create.mock.calls[0][0].data.placeTypes;
    expect(stored).toHaveLength(20);
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post('/api/diary').send({ placeId: 'p1', placeName: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/diary', () => {
  it('kullanıcının kayıtlarını visitedAt desc sırada döner', async () => {
    mockPrisma.diaryEntry.findMany.mockResolvedValue([
      { id: 'd1', placeName: 'A', visitedAt: new Date('2026-05-30') },
      { id: 'd2', placeName: 'B', visitedAt: new Date('2026-05-20') },
    ]);
    mockPrisma.diaryEntry.count.mockResolvedValue(2);
    const res = await request(app).get('/api/diary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(mockPrisma.diaryEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId },
      orderBy: { visitedAt: 'desc' },
    }));
  });

  it('sayfalama', async () => {
    await request(app).get('/api/diary?page=3&limit=10').set('Authorization', `Bearer ${token}`);
    expect(mockPrisma.diaryEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20, take: 10,
    }));
  });
});

describe('DELETE /api/diary/:id', () => {
  it('sahibi olduğu kayıtsa 204', async () => {
    mockPrisma.diaryEntry.deleteMany.mockResolvedValue({ count: 1 });
    const res = await request(app).delete('/api/diary/d1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
    expect(mockPrisma.diaryEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: 'd1', userId },
    });
  });

  it('başkasına ait → 404', async () => {
    mockPrisma.diaryEntry.deleteMany.mockResolvedValue({ count: 0 });
    const res = await request(app).delete('/api/diary/d1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/diary/stats', () => {
  it('boş listede sıfır + boş arrayler', async () => {
    mockPrisma.diaryEntry.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/diary/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalEntries).toBe(0);
    expect(res.body.uniquePlaces).toBe(0);
  });

  it('agregeli özet döner', async () => {
    mockPrisma.diaryEntry.findMany.mockResolvedValue([
      { placeId: 'p1', placeName: 'Antep Kebap', placeTypes: ['restaurant'], visitedAt: new Date('2026-05-30') },
      { placeId: 'p1', placeName: 'Antep Kebap', placeTypes: ['restaurant'], visitedAt: new Date('2026-05-20') },
      { placeId: 'p2', placeName: 'Pizza Roma', placeTypes: ['restaurant'], visitedAt: new Date('2026-04-15') },
    ]);
    const res = await request(app).get('/api/diary/stats').set('Authorization', `Bearer ${token}`);
    expect(res.body.totalEntries).toBe(3);
    expect(res.body.uniquePlaces).toBe(2);
    expect(res.body.topPlaces[0]).toEqual({ placeId: 'p1', placeName: 'Antep Kebap', count: 2 });
    expect(res.body.topCuisineTags.map((t) => t.tag)).toEqual(expect.arrayContaining(['Kebap', 'Pizza']));
  });
});
