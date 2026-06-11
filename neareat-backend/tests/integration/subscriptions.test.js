/**
 * NearEat Subscription API — Integration Tests
 *
 * Covers:
 * - GET  /api/subscriptions           — happy path, stale active guard
 * - POST /api/subscriptions/verify/android — happy path, expired rejection, upsert
 * - POST /webhooks/google-play        — RTDN RENEWED, EXPIRED, CANCELED, missing data
 *
 * Prisma and googleapis are fully mocked — no real DB or Google API calls.
 */

const request = require('supertest');
const { createTestToken, randomId, createTestUser } = require('../helpers');

// ─── Mocks (must come before require('../../src/app')) ───────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
};

jest.mock('../../src/utils/prisma', () => mockPrisma);
const mockCacheStore = {};
jest.mock('../../src/services/redis', () => ({
  getRedis: () => ({ ping: jest.fn().mockResolvedValue('PONG'), quit: jest.fn() }),
  cacheGet: jest.fn(async (key) => (key in mockCacheStore ? mockCacheStore[key] : null)),
  cacheSet: jest.fn(async (key, value) => { mockCacheStore[key] = value; }),
  cacheDel: jest.fn(async (key) => { delete mockCacheStore[key]; }),
}));
jest.mock('../../src/services/firebase', () => ({ verifyFirebaseToken: jest.fn() }));
jest.mock('../../src/services/emailService', () => ({ sendEmail: jest.fn() }));

// googleapis mock — kontrol edilebilir subscriptions.get factory
const mockSubscriptionsGet = jest.fn();
jest.mock('googleapis', () => {
  const GoogleAuth = jest.fn().mockImplementation(() => ({}));
  const androidpublisher = jest.fn().mockReturnValue({
    purchases: {
      subscriptions: {
        get: mockSubscriptionsGet,
      },
    },
  });
  return { google: { auth: { GoogleAuth }, androidpublisher } };
});

// ─── App (loaded after mocks) ─────────────────────────────────────────────────

const app = require('../../src/app');

// ─── Test ortamı ─────────────────────────────────────────────────────────────

const userId = randomId();
const token = createTestToken(userId);
const user = createTestUser({ id: userId });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue(user);
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: 'service_account' });
  process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.eatlas.mobile';
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscriptions
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/subscriptions', () => {
  it('aktif ve geçerli aboneliği döndürür', async () => {
    const sub = {
      id: randomId(), userId, planType: 'yearly', status: 'active',
      expiresAt: new Date(Date.now() + 86400_000), storeTransactionId: 'tok_1',
    };
    mockPrisma.subscription.findUnique.mockResolvedValue(sub);

    const res = await request(app)
      .get('/api/subscriptions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('süresi dolmuş aktif aboneliği expired olarak günceller', async () => {
    const stale = {
      id: randomId(), userId, planType: 'monthly', status: 'active',
      expiresAt: new Date(Date.now() - 86400_000), // geçmişte
    };
    const updated = { ...stale, status: 'expired' };
    mockPrisma.subscription.findUnique.mockResolvedValue(stale);
    mockPrisma.subscription.update.mockResolvedValue(updated);

    const res = await request(app)
      .get('/api/subscriptions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('expired');
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'expired' } }),
    );
  });

  it('abonelik yoksa null döndürür', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/subscriptions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('auth olmadan 401 döndürür', async () => {
    const res = await request(app).get('/api/subscriptions');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriptions/verify/android
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/subscriptions/verify/android', () => {
  const purchaseToken = 'gpa.test-token-abc123';
  const productId = 'premium_yearly';
  const futureExpiry = String(Date.now() + 30 * 86400_000);

  it('geçerli satın almayı doğrular ve aboneliği aktifleştirir', async () => {
    mockSubscriptionsGet.mockResolvedValue({
      data: { expiryTimeMillis: futureExpiry, autoRenewing: true },
    });
    const created = {
      id: randomId(), userId, planType: 'yearly', status: 'active',
      expiresAt: new Date(parseInt(futureExpiry)), storeTransactionId: purchaseToken,
    };
    mockPrisma.subscription.upsert.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.planType).toBe('yearly');
    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: 'active', storeTransactionId: purchaseToken }),
      }),
    );
  });

  it('süresi dolmuş satın almayı reddeder (400)', async () => {
    mockSubscriptionsGet.mockResolvedValue({
      data: { expiryTimeMillis: String(Date.now() - 86400_000) },
    });

    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/geçersiz|süresi/i);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('aylık plan için planType monthly olarak kaydeder', async () => {
    mockSubscriptionsGet.mockResolvedValue({
      data: { expiryTimeMillis: futureExpiry },
    });
    mockPrisma.subscription.upsert.mockResolvedValue({
      id: randomId(), userId, planType: 'monthly', status: 'active',
      expiresAt: new Date(parseInt(futureExpiry)), storeTransactionId: purchaseToken,
    });

    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId: 'premium_monthly' });

    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ planType: 'monthly' }),
      }),
    );
  });

  it('purchaseToken eksikse 400 döndürür', async () => {
    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId });

    expect(res.status).toBe(400);
    expect(mockSubscriptionsGet).not.toHaveBeenCalled();
  });

  it('GOOGLE_PLAY env yoksa 503 döndürür', async () => {
    const orig = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;

    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(res.status).toBe(503);
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = orig;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /webhooks/google-play (RTDN)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /webhooks/google-play', () => {
  function encodedMessage(payload) {
    return {
      message: {
        data: Buffer.from(JSON.stringify(payload)).toString('base64'),
        messageId: '123456',
      },
    };
  }

  const purchaseToken = 'gpa.rtdn-token';

  it('RENEWED (type=2) bildirimi → Play\'den yeniler ve 200 döndürür', async () => {
    mockSubscriptionsGet.mockResolvedValue({
      data: { expiryTimeMillis: String(Date.now() + 30 * 86400_000) },
    });
    const sub = { id: randomId(), storeTransactionId: purchaseToken };
    mockPrisma.subscription.findFirst.mockResolvedValue(sub);
    mockPrisma.subscription.update.mockResolvedValue({ ...sub, status: 'active' });

    const payload = {
      packageName: 'com.eatlas.mobile',
      subscriptionNotification: { notificationType: 2, purchaseToken, subscriptionId: 'premium_yearly' },
    };

    const res = await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage(payload));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockPrisma.subscription.update).toHaveBeenCalled();
  });

  it('EXPIRED (type=13) bildirimi → status expired olarak günceller', async () => {
    const sub = { id: randomId(), storeTransactionId: purchaseToken };
    mockPrisma.subscription.findFirst.mockResolvedValue(sub);
    mockPrisma.subscription.update.mockResolvedValue({ ...sub, status: 'expired' });

    const payload = {
      packageName: 'com.eatlas.mobile',
      subscriptionNotification: { notificationType: 13, purchaseToken, subscriptionId: 'premium_yearly' },
    };

    const res = await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage(payload));

    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'expired' } }),
    );
  });

  it('CANCELED (type=3) bildirimi → status cancelled olarak günceller', async () => {
    const sub = { id: randomId(), storeTransactionId: purchaseToken };
    mockPrisma.subscription.findFirst.mockResolvedValue(sub);
    mockPrisma.subscription.update.mockResolvedValue({ ...sub, status: 'cancelled' });

    const payload = {
      packageName: 'com.eatlas.mobile',
      subscriptionNotification: { notificationType: 3, purchaseToken, subscriptionId: 'premium_yearly' },
    };

    const res = await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage(payload));

    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'cancelled' } }),
    );
  });

  it('data alanı eksik mesaj için 200 döndürür (hata değil)', async () => {
    const res = await request(app)
      .post('/webhooks/google-play')
      .send({ message: {} });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('yanlış packageName olan bildirimi yoksayar', async () => {
    const payload = {
      packageName: 'com.fake.app',
      subscriptionNotification: { notificationType: 2, purchaseToken, subscriptionId: 'premium_yearly' },
    };

    const res = await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage(payload));

    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('geçersiz base64 veri için 200 döndürür (hata değil)', async () => {
    const res = await request(app)
      .post('/webhooks/google-play')
      .send({ message: { data: 'bu-gecersiz-base64!!!' } });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RTDN teşhisi — GET /webhooks/google-play/last
// ─────────────────────────────────────────────────────────────────────────────

describe('RTDN teşhisi: /webhooks/google-play/last', () => {
  function encodedMessage(payload) {
    return { message: { data: Buffer.from(JSON.stringify(payload)).toString('base64'), messageId: '1' } };
  }

  beforeEach(() => {
    for (const k of Object.keys(mockCacheStore)) delete mockCacheStore[k];
  });

  it('hiç bildirim yokken last=null döner', async () => {
    const res = await request(app).get('/webhooks/google-play/last');
    expect(res.status).toBe(200);
    expect(res.body.last).toBeNull();
  });

  it('test bildirimi alınınca last type=test olarak kaydedilir', async () => {
    await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage({ packageName: 'com.eatlas.mobile', testNotification: { version: '1.0' } }));

    const res = await request(app).get('/webhooks/google-play/last');
    expect(res.status).toBe(200);
    expect(res.body.last).toMatchObject({ type: 'test', packageName: 'com.eatlas.mobile', count: 1 });
    expect(typeof res.body.last.at).toBe('string');
  });

  it('abonelik bildirimi type=subscription:N olarak kaydeder + sayacı artırır', async () => {
    mockSubscriptionsGet.mockResolvedValue({ data: { expiryTimeMillis: String(Date.now() + 86400_000) } });
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: randomId(), storeTransactionId: 't' });
    mockPrisma.subscription.update.mockResolvedValue({});

    await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage({ packageName: 'com.eatlas.mobile', testNotification: { version: '1.0' } }));
    await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage({ packageName: 'com.eatlas.mobile', subscriptionNotification: { notificationType: 2, purchaseToken: 't', subscriptionId: 'user_premium' } }));

    const res = await request(app).get('/webhooks/google-play/last');
    expect(res.body.last).toMatchObject({ type: 'subscription:2', count: 2 });
  });

  it('hassas veri sızdırmaz (token/userId yok)', async () => {
    await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage({ packageName: 'com.eatlas.mobile', subscriptionNotification: { notificationType: 3, purchaseToken: 'secret-token', subscriptionId: 'user_premium' } }));

    const res = await request(app).get('/webhooks/google-play/last');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('secret-token');
    expect(res.body.last.purchaseToken).toBeUndefined();
  });
});
