'use strict';

/**
 * Sprint-7 #91 — Check-in endpoint testleri.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers');

const mockPrisma = {
  user: { findUnique: jest.fn() },
  subscription: { findUnique: jest.fn() },
  friendRequest: { findMany: jest.fn().mockResolvedValue([]) },
  checkIn: {
    create: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  activityEvent: { create: jest.fn().mockResolvedValue({}) },
  notification: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
};
jest.mock('../../src/utils/prisma', () => mockPrisma);

const mockCreateNotificationsForUsers = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  createNotificationsForUsers: (...args) => mockCreateNotificationsForUsers(...args),
}));

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

// S18-3 devamı — check-in konum doğrulaması Google Places geometry'sine bakıyor.
const mockGetPlaceDetails = jest.fn();
jest.mock('../../src/services/googlePlaces', () => ({
  getPlaceDetails: (...args) => mockGetPlaceDetails(...args),
}));

jest.mock('../../src/jobs/reservationReminders', () => ({ scheduleReservationReminders: jest.fn() }));
jest.mock('../../src/jobs/smartNotifications', () => ({ scheduleSmartNotifications: jest.fn() }));
jest.mock('../../src/jobs/feedbackAggregator', () => ({ scheduleFeedbackAggregation: jest.fn() }));
jest.mock('../../src/jobs/friendSuggestions', () => ({ scheduleFriendSuggestions: jest.fn(), runFriendSuggestionsJob: jest.fn() }));

const app = require('../../src/app');

const userId = 'u-1';
const friendA = 'fa';
const friendB = 'fb';
const token = createTestToken({ id: userId, email: 'u@test.com', role: 'USER' });

function flushMicrotasks() {
  return new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    id: userId, email: 'u@test.com', role: 'USER', displayName: 'Ali', starCount: 0, isSuspended: false,
  });
  mockPrisma.checkIn.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.checkIn.create.mockImplementation(({ data, select }) => Promise.resolve({
    id: 'ci-1',
    placeId: data.placeId,
    placeName: data.placeName,
    expiresAt: data.expiresAt,
    createdAt: new Date(),
    verified: data.verified,
    distanceMeters: data.distanceMeters,
  }));
  mockPrisma.activityEvent.create.mockResolvedValue({});
  // Köşk Kebap ≈ Taksim Meydanı
  mockGetPlaceDetails.mockResolvedValue({ geometry: { location: { lat: 41.0370, lng: 28.9850 } } });
});

describe('POST /api/checkin', () => {
  it('placeId yoksa 400', async () => {
    const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
      .send({ placeName: 'Test' });
    expect(res.status).toBe(400);
  });

  it('placeName yoksa 400', async () => {
    const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1' });
    expect(res.status).toBe(400);
  });

  it('başarılı check-in: 201, eski yürürlükten kalkar, yeni oluşur, expiresAt ~3h sonra', async () => {
    const res = await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'Köşk Kebap' });
    expect(res.status).toBe(201);
    // Önceki AKTİF check-in SİLİNMEZ, süresi doldurulur: satır ziyaret kanıtıdır
    // (starGuards.hasVerifiedVisit). Silinseydi A'ya gidip 1 saat sonra B'ye check-in
    // yapan kullanıcı A'daki gerçek ziyaretinin kanıtını kaybederdi.
    expect(mockPrisma.checkIn.updateMany).toHaveBeenCalledWith({
      where: { userId, expiresAt: { gt: expect.any(Date) } },
      data: { expiresAt: expect.any(Date) },
    });
    expect(mockPrisma.checkIn.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.checkIn.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId, placeId: 'p1', placeName: 'Köşk Kebap' }),
    }));
    const sent = mockPrisma.checkIn.create.mock.calls[0][0].data;
    const ttlMs = sent.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(2.9 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThan(3.1 * 60 * 60 * 1000);
  });

  it('arkadaşlara CHECKIN bildirimi gider (FCM)', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([
      { fromUserId: userId, toUserId: friendA },
      { fromUserId: friendB, toUserId: userId },
    ]);
    await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'Köşk Kebap' });
    await flushMicrotasks();
    expect(mockCreateNotificationsForUsers).toHaveBeenCalledWith(
      expect.arrayContaining([friendA, friendB]),
      'CHECKIN',
      expect.stringContaining('Ali'),
      expect.stringContaining('Köşk Kebap'),
      expect.objectContaining({ userId, placeId: 'p1', placeName: 'Köşk Kebap' }),
    );
  });

  it('arkadaş yoksa FCM çağrısı atlanır', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([]);
    await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'X' });
    await flushMicrotasks();
    expect(mockCreateNotificationsForUsers).not.toHaveBeenCalled();
  });

  it('ActivityEvent (CHECKIN) yazılır', async () => {
    await request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'X' });
    await flushMicrotasks();
    expect(mockPrisma.activityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId, type: 'CHECKIN', placeId: 'p1' }),
    });
  });

  it('auth yoksa 401', async () => {
    const res = await request(app).post('/api/checkin').send({ placeId: 'p1', placeName: 'X' });
    expect(res.status).toBe(401);
  });
});

/**
 * S18-3 devamı — konum doğrulaması.
 *
 * Kritik tasarım kararı: doğrulama BAŞARISIZ olsa bile check-in 201 döner ve sosyal
 * özellik (arkadaş bildirimi) çalışır. Yalnızca `verified: false` yazılır, o da satırı
 * `starGuards.hasVerifiedVisit` gözünde ziyaret kanıtı olmaktan çıkarır. Böylece eski
 * mobil sürümler BOZULMAZ, sadece yıldız kazanamaz.
 */
describe('POST /api/checkin — konum doğrulaması', () => {
  function post(body) {
    return request(app).post('/api/checkin').set('Authorization', `Bearer ${token}`)
      .send({ placeId: 'p1', placeName: 'Köşk Kebap', ...body });
  }
  const written = () => mockPrisma.checkIn.create.mock.calls[0][0].data;

  it('mekânın yanındaysa verified:true yazılır', async () => {
    const res = await post({ lat: 41.0370, lng: 28.9850 });
    expect(res.status).toBe(201);
    expect(written()).toMatchObject({ verified: true, distanceMeters: 0, lat: 41.037, mocked: false });
    expect(res.body.verified).toBe(true);
  });

  // ASIL AÇIK: koordinatsız istek (eski istemci veya doğrudan curl) artık yıldız
  // kazandıran ziyaret kanıtı üretemez.
  it('koordinat yoksa 201 ama verified:false', async () => {
    const res = await post({});
    expect(res.status).toBe(201);
    expect(written()).toMatchObject({ verified: false, lat: null, lng: null, distanceMeters: null });
    expect(mockGetPlaceDetails).not.toHaveBeenCalled();
  });

  it('uzaktan gelen istek verified:false, mesafe denetim için yazılır', async () => {
    const res = await post({ lat: 40.9900, lng: 29.0300 }); // Kadıköy ≈ 5 km
    expect(res.status).toBe(201);
    const d = written();
    expect(d.verified).toBe(false);
    expect(d.distanceMeters).toBeGreaterThan(4000);
    expect(d.lat).toBe(40.99); // reddedilen deneme de kaydedilir
  });

  it('sahte konum bayrağı verified:false yapar ve kaydedilir', async () => {
    await post({ lat: 41.0370, lng: 28.9850, mocked: true });
    expect(written()).toMatchObject({ verified: false, mocked: true });
  });

  // FAIL-CLOSED: Google çökerse doğrulayamadığımız ziyaret yıldız kazandırmamalı,
  // ama check-in'in kendisi de düşmemeli.
  it('Google Places hatası check-in\'i düşürmez, verified:false kalır', async () => {
    mockGetPlaceDetails.mockRejectedValue(new Error('OVER_QUERY_LIMIT'));
    const res = await post({ lat: 41.0370, lng: 28.9850 });
    expect(res.status).toBe(201);
    expect(written().verified).toBe(false);
  });

  it('doğrulama başarısız olsa da arkadaş bildirimi gider (sosyal özellik bozulmaz)', async () => {
    mockPrisma.friendRequest.findMany.mockResolvedValue([{ fromUserId: userId, toUserId: friendA }]);
    await post({}); // koordinatsız → doğrulanmaz
    await flushMicrotasks();
    expect(mockCreateNotificationsForUsers).toHaveBeenCalled();
  });
});

describe('GET /api/checkin/me', () => {
  it('aktif check-in döner', async () => {
    const exp = new Date(Date.now() + 60 * 60 * 1000);
    mockPrisma.checkIn.findFirst.mockResolvedValue({
      id: 'ci-1', placeId: 'p1', placeName: 'Köşk', createdAt: new Date(), expiresAt: exp,
    });
    const res = await request(app).get('/api/checkin/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ci-1');
    expect(mockPrisma.checkIn.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId, expiresAt: { gt: expect.any(Date) } }),
    }));
  });

  it('aktif yoksa null', async () => {
    mockPrisma.checkIn.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/checkin/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe('DELETE /api/checkin', () => {
  it('aktif check-in silinir', async () => {
    mockPrisma.checkIn.deleteMany.mockResolvedValue({ count: 1 });
    const res = await request(app).delete('/api/checkin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 1 });
  });

  it('yalnızca aktif kaydı siler — geçmiş ziyaret kanıtı korunur', async () => {
    mockPrisma.checkIn.deleteMany.mockResolvedValue({ count: 1 });
    await request(app).delete('/api/checkin').set('Authorization', `Bearer ${token}`);
    expect(mockPrisma.checkIn.deleteMany).toHaveBeenCalledWith({
      where: { userId, expiresAt: { gt: expect.any(Date) } },
    });
  });
});
