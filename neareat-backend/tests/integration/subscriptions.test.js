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
  purchaseEvent: { create: jest.fn().mockResolvedValue({}) }, // S14-B4 ledger
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

// google-auth-library mock — Pub/Sub OIDC doğrulaması (S12-4) için kontrol edilebilir verifyIdToken.
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

// googleapis mock — kontrol edilebilir subscriptions.get + acknowledge factory
const mockSubscriptionsGet = jest.fn();
const mockSubscriptionsAck = jest.fn().mockResolvedValue({});
jest.mock('googleapis', () => {
  const GoogleAuth = jest.fn().mockImplementation(() => ({}));
  const androidpublisher = jest.fn().mockReturnValue({
    purchases: {
      subscriptions: {
        get: mockSubscriptionsGet,
        acknowledge: mockSubscriptionsAck,
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

// Admin teşhis ucu (S13-2) için admin kullanıcı + token.
const adminId = randomId();
const adminToken = createTestToken(adminId);
const adminUser = createTestUser({ id: adminId, role: 'ADMIN' });

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

  // ─── S12-3: token yeniden kullanımı / hesap bağlama ───
  it('token başka bir hesaba bağlıysa 409 döner ve aboneliğe dokunmaz', async () => {
    mockSubscriptionsGet.mockResolvedValue({ data: { expiryTimeMillis: futureExpiry } });
    mockPrisma.subscription.findFirst.mockResolvedValue({
      id: randomId(), userId: 'baska-kullanici', storeTransactionId: purchaseToken,
    });

    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PURCHASE_TOKEN_ALREADY_USED');
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('token zaten aynı kullanıcıya bağlıysa idempotent çalışır (200)', async () => {
    mockSubscriptionsGet.mockResolvedValue({ data: { expiryTimeMillis: futureExpiry } });
    mockPrisma.subscription.findFirst.mockResolvedValue({
      id: randomId(), userId, storeTransactionId: purchaseToken,
    });
    mockPrisma.subscription.upsert.mockResolvedValue({
      id: randomId(), userId, planType: 'yearly', status: 'active',
      expiresAt: new Date(parseInt(futureExpiry)), storeTransactionId: purchaseToken,
    });

    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
  });

  it('obfuscatedExternalAccountId istek sahibiyle eşleşmezse 409 döner', async () => {
    mockSubscriptionsGet.mockResolvedValue({
      data: { expiryTimeMillis: futureExpiry, obfuscatedExternalAccountId: 'baska-userid' },
    });
    mockPrisma.subscription.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PURCHASE_ACCOUNT_MISMATCH');
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('acknowledgementState=0 ise acknowledge çağrılır; acknowledge hatası 200\'ü bozmaz', async () => {
    mockSubscriptionsGet.mockResolvedValue({
      data: { expiryTimeMillis: futureExpiry, acknowledgementState: 0 },
    });
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockPrisma.subscription.upsert.mockResolvedValue({
      id: randomId(), userId, planType: 'yearly', status: 'active',
      expiresAt: new Date(parseInt(futureExpiry)), storeTransactionId: purchaseToken,
    });
    mockSubscriptionsAck.mockRejectedValueOnce(new Error('ack failed'));

    const res = await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(res.status).toBe(200);
    expect(mockSubscriptionsAck).toHaveBeenCalledWith(
      expect.objectContaining({ token: purchaseToken }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscriptions/verify/appstore  (S12-1: fail-closed)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/subscriptions/verify/appstore', () => {
  const body = { transactionId: 'tx_1', planType: 'yearly', expiresAt: '2099-12-31T00:00:00.000Z' };

  afterEach(() => { delete process.env.IOS_IAP_ENABLED; });

  it('iOS IAP kapalıyken 503 döner ve aboneliğe DOKUNMAZ (client expiresAt\'e güvenmez)', async () => {
    delete process.env.IOS_IAP_ENABLED;

    const res = await request(app)
      .post('/api/subscriptions/verify/appstore')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('IOS_IAP_NOT_CONFIGURED');
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('iOS IAP açık olsa bile (doğrulama yok) 501 döner ve premium AÇMAZ', async () => {
    process.env.IOS_IAP_ENABLED = 'true';

    const res = await request(app)
      .post('/api/subscriptions/verify/appstore')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(res.status).toBe(501);
    expect(res.body.error).toBe('IOS_IAP_VERIFICATION_NOT_IMPLEMENTED');
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
  });

  it('eksik alanlarla 400 döner', async () => {
    const res = await request(app)
      .post('/api/subscriptions/verify/appstore')
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionId: 'tx_1' });

    expect(res.status).toBe(400);
    expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it('auth olmadan 401 döner', async () => {
    const res = await request(app)
      .post('/api/subscriptions/verify/appstore')
      .send(body);

    expect(res.status).toBe(401);
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
// S12-4: RTDN webhook Pub/Sub OIDC doğrulaması
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /webhooks/google-play — Pub/Sub OIDC doğrulaması', () => {
  function encodedMessage(payload) {
    return { message: { data: Buffer.from(JSON.stringify(payload)).toString('base64'), messageId: '1' } };
  }
  const purchaseToken = 'gpa.rtdn-secure';
  const renewedPayload = {
    packageName: 'com.eatlas.mobile',
    subscriptionNotification: { notificationType: 2, purchaseToken, subscriptionId: 'premium_yearly' },
  };

  afterEach(() => {
    delete process.env.GOOGLE_PUBSUB_AUDIENCE;
    delete process.env.GOOGLE_PUBSUB_SA_EMAIL;
  });

  it('audience set + Authorization header yok → 401, bildirim işlenmez', async () => {
    process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://api.example.com/webhooks/google-play';

    const res = await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage(renewedPayload));

    expect(res.status).toBe(401);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('audience set + geçersiz token (verifyIdToken throw) → 401, işlenmez', async () => {
    process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://api.example.com/webhooks/google-play';
    mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid signature'));

    const res = await request(app)
      .post('/webhooks/google-play')
      .set('Authorization', 'Bearer fake-token')
      .send(encodedMessage(renewedPayload));

    expect(res.status).toBe(401);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('audience set + SA email beklenir ama payload farklı → 401', async () => {
    process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://api.example.com/webhooks/google-play';
    process.env.GOOGLE_PUBSUB_SA_EMAIL = 'pusher@proj.iam.gserviceaccount.com';
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'someone-else@evil.com', email_verified: true }),
    });

    const res = await request(app)
      .post('/webhooks/google-play')
      .set('Authorization', 'Bearer t')
      .send(encodedMessage(renewedPayload));

    expect(res.status).toBe(401);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  });

  it('audience set + geçerli token (+ doğru SA email) → 200, bildirim işlenir', async () => {
    process.env.GOOGLE_PUBSUB_AUDIENCE = 'https://api.example.com/webhooks/google-play';
    process.env.GOOGLE_PUBSUB_SA_EMAIL = 'pusher@proj.iam.gserviceaccount.com';
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'pusher@proj.iam.gserviceaccount.com', email_verified: true }),
    });
    mockSubscriptionsGet.mockResolvedValue({ data: { expiryTimeMillis: String(Date.now() + 86400_000) } });
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: randomId(), storeTransactionId: purchaseToken });
    mockPrisma.subscription.update.mockResolvedValue({});

    const res = await request(app)
      .post('/webhooks/google-play')
      .set('Authorization', 'Bearer valid')
      .send(encodedMessage(renewedPayload));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockPrisma.subscription.update).toHaveBeenCalled();
  });

  it('audience set DEĞİL → mevcut davranış korunur (200, doğrulama atlanır)', async () => {
    mockSubscriptionsGet.mockResolvedValue({ data: { expiryTimeMillis: String(Date.now() + 86400_000) } });
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: randomId(), storeTransactionId: purchaseToken });
    mockPrisma.subscription.update.mockResolvedValue({});

    const res = await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage(renewedPayload));

    expect(res.status).toBe(200);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
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
    // Teşhis ucu admin auth arkasında (S13-2) — auth middleware admin'i bulsun.
    mockPrisma.user.findUnique.mockResolvedValue(adminUser);
  });

  it('auth olmadan 401 döner (S13-2)', async () => {
    const res = await request(app).get('/webhooks/google-play/last');
    expect(res.status).toBe(401);
  });

  it('normal kullanıcı token\'ı ile 403 döner (S13-2)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user); // role: USER
    const res = await request(app)
      .get('/webhooks/google-play/last')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('hiç bildirim yokken last=null döner', async () => {
    const res = await request(app)
      .get('/webhooks/google-play/last')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.last).toBeNull();
  });

  it('test bildirimi alınınca last type=test olarak kaydedilir', async () => {
    await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage({ packageName: 'com.eatlas.mobile', testNotification: { version: '1.0' } }));

    const res = await request(app)
      .get('/webhooks/google-play/last')
      .set('Authorization', `Bearer ${adminToken}`);
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

    const res = await request(app)
      .get('/webhooks/google-play/last')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.last).toMatchObject({ type: 'subscription:2', count: 2 });
  });

  it('hassas veri sızdırmaz (token/userId yok)', async () => {
    await request(app)
      .post('/webhooks/google-play')
      .send(encodedMessage({ packageName: 'com.eatlas.mobile', subscriptionNotification: { notificationType: 3, purchaseToken: 'secret-token', subscriptionId: 'user_premium' } }));

    const res = await request(app)
      .get('/webhooks/google-play/last')
      .set('Authorization', `Bearer ${adminToken}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('secret-token');
    expect(res.body.last.purchaseToken).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S14-B4: IAP purchase ledger (append-only PurchaseEvent)
// ─────────────────────────────────────────────────────────────────────────────

describe('S14-B4: purchase ledger', () => {
  const purchaseToken = 'gpa.ledger-token';
  const productId = 'premium_yearly';
  const futureExpiry = String(Date.now() + 30 * 86400_000);

  it('geçerli android satın alma → ledger verified yazar (token hash, ham değil)', async () => {
    mockSubscriptionsGet.mockResolvedValue({ data: { expiryTimeMillis: futureExpiry } });
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockPrisma.subscription.upsert.mockResolvedValue({ id: randomId(), userId, status: 'active' });

    await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(mockPrisma.purchaseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'android', status: 'verified', userId }),
      }),
    );
    const data = mockPrisma.purchaseEvent.create.mock.calls.at(-1)[0].data;
    expect(data.tokenHash).toBeTruthy();
    expect(data.tokenHash).not.toBe(purchaseToken); // ham token saklanmaz
  });

  it('token reuse reddi → ledger reuse_rejected yazar', async () => {
    mockSubscriptionsGet.mockResolvedValue({ data: { expiryTimeMillis: futureExpiry } });
    mockPrisma.subscription.findFirst.mockResolvedValue({ id: randomId(), userId: 'baska', storeTransactionId: purchaseToken });

    await request(app)
      .post('/api/subscriptions/verify/android')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseToken, productId });

    expect(mockPrisma.purchaseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'reuse_rejected' }) }),
    );
  });

  it('RTDN EXPIRED (13) → ledger expired yazar', async () => {
    const sub = { id: randomId(), storeTransactionId: purchaseToken };
    mockPrisma.subscription.findFirst.mockResolvedValue(sub);
    mockPrisma.subscription.update.mockResolvedValue({ ...sub, status: 'expired' });
    const payload = {
      packageName: 'com.eatlas.mobile',
      subscriptionNotification: { notificationType: 13, purchaseToken, subscriptionId: productId },
    };

    await request(app)
      .post('/webhooks/google-play')
      .send({ message: { data: Buffer.from(JSON.stringify(payload)).toString('base64'), messageId: '1' } });

    expect(mockPrisma.purchaseEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'rtdn', status: 'expired' }) }),
    );
  });
});
