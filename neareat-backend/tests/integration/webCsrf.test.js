'use strict';

/**
 * Web paneli CSRF + Origin, CORS/PUBLIC_WEB_ORIGIN ve oturum iptali — issue #525.
 */

process.env.PUBLIC_WEB_ORIGIN = 'https://panel.test';
process.env.ALLOWED_ORIGINS = 'https://baska-izinli.test';

const request = require('supertest');
const { createTestToken } = require('../helpers');
const { seedUser, extractSid, nextIp, VALID_PW } = require('../webTestUtils');

jest.mock('../../src/utils/prisma', () => require('../webTestUtils').createFakePrisma());
jest.mock('../../src/services/googleAuth', () => ({
  verifyGoogleIdToken: jest.fn().mockRejectedValue(new Error('invalid')),
  GOOGLE_WEB_CLIENT_ID: 'test-web-client-id',
}));
jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ getUserByEmail: jest.fn().mockRejectedValue({ code: 'auth/user-not-found' }), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));
jest.mock('../../src/services/logService', () => ({
  logRequest: jest.fn().mockResolvedValue(undefined),
  logActivity: jest.fn().mockResolvedValue(undefined),
  ACTIVITY_TYPES: {},
}));
jest.mock('../../src/services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
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

const prisma = require('../../src/utils/prisma');
const { hashToken } = require('../../src/utils/tokenHash');
const app = require('../../src/app');

const ORIGIN = 'https://panel.test';

async function webLogin(email) {
  const res = await request(app).post('/api/auth/web/login')
    .set('Origin', ORIGIN).set('X-Forwarded-For', nextIp())
    .send({ email, password: VALID_PW });
  expect(res.status).toBe(204);
  const sid = extractSid(res);
  const s = await request(app).get('/api/auth/web/session')
    .set('Cookie', `__Host-eatlas_sid=${sid}`).set('X-Forwarded-For', nextIp());
  return { sid, csrf: s.body.csrfToken, cookie: `__Host-eatlas_sid=${sid}` };
}

function sessionCount(userId) {
  return [...prisma.__sessions.values()].filter((s) => s.userId === userId).length;
}

const HOURS = { monday: { open: '09:00', close: '22:00' } };

beforeEach(() => {
  prisma.__users.clear();
  prisma.__sessions.clear();
  jest.clearAllMocks();
  seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
  prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'rp1', userId: 'r1', businessName: 'Test Lokanta' });
  prisma.restaurantProfile.update.mockResolvedValue({ id: 'rp1', openingHours: HOURS });
});

describe('CSRF + Origin (çerezle gelen yazma istekleri)', () => {
  it('doğru token + doğru Origin → işlem yapılır', async () => {
    const { cookie, csrf } = await webLogin('r1@test.com');
    const res = await request(app).put('/api/restaurant-account/hours')
      .set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf)
      .send({ openingHours: HOURS });
    expect(res.status).toBe(200);
    expect(prisma.restaurantProfile.update).toHaveBeenCalled();
  });

  it.each([
    ['token yok', undefined],
    ['token yanlış', 'yanlis-token'],
    ['token boş', ''],
  ])('%s → 403 CSRF_INVALID, işlem yapılmaz', async (_label, token) => {
    const { cookie } = await webLogin('r1@test.com');
    const req = request(app).put('/api/restaurant-account/hours')
      .set('Cookie', cookie).set('Origin', ORIGIN);
    if (token !== undefined) req.set('X-CSRF-Token', token);
    const res = await req.send({ openingHours: HOURS });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
    expect(prisma.restaurantProfile.update).not.toHaveBeenCalled();
  });

  it('başka bir oturumun token\'ı kabul edilmez', async () => {
    seedUser(prisma, { id: 'r2', email: 'r2@test.com' });
    const a = await webLogin('r1@test.com');
    const b = await webLogin('r2@test.com');
    const res = await request(app).put('/api/restaurant-account/hours')
      .set('Cookie', a.cookie).set('Origin', ORIGIN).set('X-CSRF-Token', b.csrf)
      .send({ openingHours: HOURS });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });

  it.each([
    ['yabancı Origin', 'https://kotu.example'],
    ['ALLOWED_ORIGINS\'teki başka bir origin', 'https://baska-izinli.test'],
    ['Origin yok', undefined],
  ])('%s → 403 ORIGIN_INVALID (geçerli token olsa bile)', async (_label, origin) => {
    const { cookie, csrf } = await webLogin('r1@test.com');
    const req = request(app).delete('/api/restaurant-account/discount/deactivate')
      .set('Cookie', cookie).set('X-CSRF-Token', csrf);
    if (origin) req.set('Origin', origin);
    const res = await req;
    // Yabancı origin CORS katmanında zaten reddedilir (mevcut davranış, 500); izinli
    // ama panel olmayan origin ve Origin'siz istek CSRF katmanında 403 alır.
    if (origin === 'https://kotu.example') {
      expect(res.status).not.toBe(200);
    } else {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ORIGIN_INVALID');
    }
    expect(prisma.restaurantProfile.update).not.toHaveBeenCalled();
  });

  it('POST de korunur', async () => {
    const { cookie } = await webLogin('r1@test.com');
    const res = await request(app).post('/api/restaurant-account/campaign')
      .set('Cookie', cookie).set('Origin', ORIGIN).send({});
    expect(res.status).toBe(403);
  });

  it('GET/HEAD/OPTIONS CSRF kontrolüne girmez', async () => {
    const { cookie } = await webLogin('r1@test.com');
    const get = await request(app).get('/api/restaurant-account/me').set('Cookie', cookie);
    expect(get.status).toBe(200);
    const head = await request(app).head('/api/restaurant-account/me').set('Cookie', cookie);
    expect(head.status).toBe(200);
    const options = await request(app).options('/api/restaurant-account/me')
      .set('Origin', ORIGIN).set('Access-Control-Request-Method', 'PUT');
    expect(options.status).toBe(204);
  });

  it('Bearer istekleri muaf — mobil: PUT /api/reservations/:id/status CSRF\'siz 200', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ status: 'active', expiresAt: new Date(Date.now() + 86400000) });
    prisma.reservation.findUnique.mockResolvedValue({
      id: 'res-1', restaurantId: 'rp1', userId: 'u9', status: 'PENDING', guestCount: 2, date: '2027-01-01', time: '19:00',
    });
    prisma.reservation.update.mockResolvedValue({ id: 'res-1', status: 'CONFIRMED', reservedSeats: 2 });

    const res = await request(app).put('/api/reservations/res-1/status')
      .set('Authorization', `Bearer ${createTestToken('r1')}`)
      .send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('Bearer + çerez + yabancı olmayan ama yanlış Origin → Bearer kazanır, CSRF uygulanmaz', async () => {
    const { cookie } = await webLogin('r1@test.com');
    const res = await request(app).put('/api/restaurant-account/hours')
      .set('Authorization', `Bearer ${createTestToken('r1')}`)
      .set('Cookie', cookie).set('Origin', 'https://baska-izinli.test')
      .send({ openingHours: HOURS });
    expect(res.status).toBe(200);
  });

  it('web/login ve web/google Origin ister, CSRF token istemez', async () => {
    const noOrigin = await request(app).post('/api/auth/web/login').set('X-Forwarded-For', nextIp())
      .send({ email: 'r1@test.com', password: VALID_PW });
    expect(noOrigin.status).toBe(403);
    expect(noOrigin.body.code).toBe('ORIGIN_INVALID');

    const wrong = await request(app).post('/api/auth/web/google').set('X-Forwarded-For', nextIp())
      .set('Origin', 'https://baska-izinli.test').send({ credential: 'x' });
    expect(wrong.status).toBe(403);

    const ok = await request(app).post('/api/auth/web/login').set('X-Forwarded-For', nextIp())
      .set('Origin', ORIGIN).send({ email: 'r1@test.com', password: VALID_PW });
    expect(ok.status).toBe(204);
  });
});

describe('CORS / PUBLIC_WEB_ORIGIN', () => {
  it('PUBLIC_WEB_ORIGIN otomatik izinli (kimlik bilgili CORS)', async () => {
    const res = await request(app).options('/api/auth/web/login')
      .set('Origin', ORIGIN).set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('ALLOWED_ORIGINS\'teki mevcut origin izinli kalır', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://baska-izinli.test');
    expect(res.headers['access-control-allow-origin']).toBe('https://baska-izinli.test');
  });

  it('listede olmayan origin → mevcut hata davranışı (izin başlığı yok, hata)', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://kotu.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.status).toBe(500);
  });

  it('Origin\'siz istek (mobil) eskisi gibi geçer', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${createTestToken('r1')}`);
    expect(res.status).toBe(200);
  });
});

describe('Web oturumlarının iptali', () => {
  it('başarılı şifre sıfırlama → kullanıcının bütün web oturumları silinir', async () => {
    await webLogin('r1@test.com');
    await webLogin('r1@test.com');
    expect(sessionCount('r1')).toBe(2);
    Object.assign(prisma.__users.get('r1'), {
      passwordResetToken: hashToken('reset-raw'),
      passwordResetExpiry: new Date(Date.now() + 3600000),
    });
    // Sahte findFirst `gt` operatörünü bilmez → bu testte açıkça döndür.
    prisma.user.findFirst.mockResolvedValueOnce({ ...prisma.__users.get('r1') });

    const res = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', nextIp())
      .send({ token: 'reset-raw', password: 'yeni-sifre-123' });
    expect(res.status).toBe(200);
    expect(sessionCount('r1')).toBe(0);
  });

  it('başarısız şifre sıfırlama oturumlara dokunmaz', async () => {
    await webLogin('r1@test.com');
    prisma.user.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/auth/reset-password').set('X-Forwarded-For', nextIp())
      .send({ token: 'gecersiz', password: 'yeni-sifre-123' });
    expect(res.status).toBe(400);
    expect(sessionCount('r1')).toBe(1);
  });

  it('admin hesabı askıya alınca → web oturumları silinir', async () => {
    seedUser(prisma, { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' });
    seedUser(prisma, { id: 'r2', email: 'r2@test.com' });
    await webLogin('r1@test.com');
    await webLogin('r2@test.com');

    const res = await request(app).post('/api/admin/users/r1/suspend')
      .set('Authorization', `Bearer ${createTestToken('admin-1')}`);
    expect(res.status).toBe(200);
    expect(sessionCount('r1')).toBe(0);
    expect(sessionCount('r2')).toBe(1);
  });

  it('hesap silme → web oturumları silinir', async () => {
    const { cookie, csrf } = await webLogin('r1@test.com');
    await webLogin('r1@test.com');
    prisma.restaurantProfile.findUnique.mockResolvedValue(null);

    const res = await request(app).delete('/api/auth/account').set('X-Forwarded-For', nextIp())
      .set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf);
    expect(res.status).toBe(200);
    expect(sessionCount('r1')).toBe(0);
    expect(prisma.__users.has('r1')).toBe(false);
  });

  it('hesap silme çerezle CSRF\'siz yapılamaz', async () => {
    const { cookie } = await webLogin('r1@test.com');
    const res = await request(app).delete('/api/auth/account').set('X-Forwarded-For', nextIp())
      .set('Cookie', cookie).set('Origin', ORIGIN);
    expect(res.status).toBe(403);
    expect(prisma.__users.has('r1')).toBe(true);
  });
});
