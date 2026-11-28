'use strict';

/**
 * Web paneli çerez oturumu — issue #524.
 *
 * Uçlar: POST /api/auth/web/login, /google, GET /session, POST /logout, /logout-all ve
 * `authenticate`'in çerez dalı. Sahte Prisma oturum satırlarını gerçekten sakladığı için
 * giriş → çerez → oturum → çıkış adımları birbirine bağlanır (tests/webTestUtils.js).
 */

process.env.PUBLIC_WEB_ORIGIN = 'https://panel.test';

const request = require('supertest');
const { createTestToken } = require('../helpers');
const { seedUser, extractSid, nextIp, VALID_PW } = require('../webTestUtils');

jest.mock('../../src/utils/prisma', () => require('../webTestUtils').createFakePrisma());
jest.mock('../../src/services/googleAuth', () => ({
  verifyGoogleIdToken: jest.fn(),
  GOOGLE_WEB_CLIENT_ID: 'test-web-client-id',
}));
jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ getUserByEmail: jest.fn(), deleteUser: jest.fn() }),
  getMessaging: () => ({ send: jest.fn() }),
}));
jest.mock('../../src/services/logService', () => ({
  logRequest: jest.fn().mockResolvedValue(undefined),
  logActivity: jest.fn().mockResolvedValue(undefined),
  ACTIVITY_TYPES: {},
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
const { verifyGoogleIdToken } = require('../../src/services/googleAuth');
const { sessionKey } = require('../../src/services/webSessionService');
const app = require('../../src/app');

const ORIGIN = 'https://panel.test';
const HOUR = 60 * 60 * 1000;

function login(email, password = VALID_PW, { ip = nextIp(), cookie } = {}) {
  const req = request(app).post('/api/auth/web/login')
    .set('Origin', ORIGIN).set('X-Forwarded-For', ip);
  if (cookie) req.set('Cookie', cookie);
  return req.send({ email, password });
}

function withSid(req, sid) {
  return req.set('Cookie', `__Host-eatlas_sid=${encodeURIComponent(sid)}`).set('X-Forwarded-For', nextIp());
}

async function loginAndGetSession(email) {
  const res = await login(email);
  expect(res.status).toBe(204);
  const sid = extractSid(res);
  const s = await withSid(request(app).get('/api/auth/web/session'), sid);
  expect(s.status).toBe(200);
  return { sid, csrf: s.body.csrfToken };
}

let nowSpy = null;
function freezeNow(ms) {
  nowSpy = jest.spyOn(Date, 'now').mockReturnValue(ms);
  return nowSpy;
}

beforeEach(() => {
  prisma.__users.clear();
  prisma.__sessions.clear();
  jest.clearAllMocks(); // yalnızca çağrı kayıtları — sahte DB implementasyonları kalır
});

afterEach(() => {
  if (nowSpy) nowSpy.mockRestore();
  nowSpy = null;
});

describe('POST /api/auth/web/login', () => {
  it('RESTAURANT doğru şifre → 204 + __Host- çerezi (HttpOnly; Secure; SameSite=Lax; Path=/)', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const res = await login('r1@test.com');

    expect(res.status).toBe(204);
    const cookie = [].concat(res.headers['set-cookie']).find((c) => c.startsWith('__Host-eatlas_sid='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('oturum tablosunda ham kimlik saklanmaz (yalnızca HMAC)', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const sid = extractSid(await login('r1@test.com'));

    const ids = [...prisma.__sessions.keys()];
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(sid);
    expect(ids[0]).toBe(sessionKey(sid));
    expect(JSON.stringify([...prisma.__sessions.values()])).not.toContain(sid);
  });

  it('USER ve ADMIN oturum açamaz; yanıt yanlış şifreyle birebir aynı', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    seedUser(prisma, { id: 'u1', email: 'u1@test.com', role: 'USER' });
    seedUser(prisma, { id: 'a1', email: 'a1@test.com', role: 'ADMIN' });

    const wrong = await login('r1@test.com', 'yanlis-sifre');
    const userRes = await login('u1@test.com');
    const adminRes = await login('a1@test.com');
    const unknown = await login('yok@test.com');

    for (const r of [userRes, adminRes, unknown]) {
      expect(r.status).toBe(wrong.status);
      expect(r.body).toEqual(wrong.body);
      expect(r.headers['set-cookie']).toBeUndefined();
    }
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({ error: 'E-posta veya şifre hatalı' });
    expect(prisma.__sessions.size).toBe(0);
  });

  it('askıya alınmış restoran → 403 mevcut askı mesajı, oturum yok', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com', isSuspended: true });
    const res = await login('r1@test.com');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Hesabınız askıya alınmıştır.' });
    expect(prisma.__sessions.size).toBe(0);
  });

  it('sabitleme: istekte gelen eski çerez yeniden kullanılmaz, silinir; yeni kimlik üretilir', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const first = extractSid(await login('r1@test.com'));
    const second = await login('r1@test.com', VALID_PW, { cookie: `__Host-eatlas_sid=${encodeURIComponent(first)}` });
    const secondSid = extractSid(second);

    expect(secondSid).toBeTruthy();
    expect(secondSid).not.toBe(first);
    expect(prisma.__sessions.has(sessionKey(first))).toBe(false);

    const old = await withSid(request(app).get('/api/auth/web/session'), first);
    expect(old.status).toBe(401);
  });

  it('saldırganın uydurduğu çerez değeri oturuma dönüşmez', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const res = await login('r1@test.com', VALID_PW, { cookie: '__Host-eatlas_sid=attacker-chosen-value' });
    expect(extractSid(res)).not.toBe('attacker-chosen-value');
    expect(prisma.__sessions.has(sessionKey('attacker-chosen-value'))).toBe(false);
  });

  it('eksik alan → 400 (validate middleware)', async () => {
    const res = await request(app).post('/api/auth/web/login')
      .set('Origin', ORIGIN).set('X-Forwarded-For', nextIp()).send({ email: 'x@test.com' });
    expect(res.status).toBe(400);
  });

  it('/api/auth 10 kb gövde sınırı web girişine de uygulanır → 413', async () => {
    const res = await request(app).post('/api/auth/web/login')
      .set('Origin', ORIGIN).set('X-Forwarded-For', nextIp())
      .send({ email: 'x@test.com', password: 'a'.repeat(11 * 1024) });
    expect(res.status).toBe(413);
  });

  it('authLimiter: aynı IP\'den 21. deneme 429', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const ip = nextIp();
    for (let i = 0; i < 20; i += 1) {
      const r = await login('r1@test.com', 'yanlis', { ip });
      expect(r.status).toBe(401);
    }
    const blocked = await login('r1@test.com', VALID_PW, { ip });
    expect(blocked.status).toBe(429);
    expect(prisma.__sessions.size).toBe(0);
  });
});

describe('POST /api/auth/web/google', () => {
  function google(credential = 'gis-credential') {
    return request(app).post('/api/auth/web/google')
      .set('Origin', ORIGIN).set('X-Forwarded-For', nextIp()).send({ credential });
  }

  it('googleId ile eşleşen RESTAURANT → 204 + oturum', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com', googleId: 'g-sub-1' });
    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-sub-1', email: 'r1@test.com', email_verified: true });
    const res = await google();
    expect(res.status).toBe(204);
    expect(extractSid(res)).toBeTruthy();
  });

  it('e-postası eşleşen RESTAURANT → Google kimliği bağlanır, oturum açılır', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-new', email: 'r1@test.com', email_verified: true });
    const res = await google();
    expect(res.status).toBe(204);
    expect(prisma.__users.get('r1').googleId).toBe('g-new');
  });

  it('eşleşen hesap yok → genel ret, HİÇBİR kullanıcı oluşturulmaz', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-x', email: 'yeni@test.com', email_verified: true, name: 'Yeni' });
    const before = prisma.__users.size;

    const res = await google();
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(prisma.__users.size).toBe(before);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.__sessions.size).toBe(0);
  });

  it('USER hesabı (googleId veya e-posta) → aynı genel ret, hesaba yazılmaz', async () => {
    seedUser(prisma, { id: 'u1', email: 'u1@test.com', role: 'USER', googleId: 'g-user' });
    seedUser(prisma, { id: 'u2', email: 'u2@test.com', role: 'USER' });

    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-x', email: 'yok@test.com', email_verified: true });
    const none = await google();
    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-user', email: 'u1@test.com', email_verified: true });
    const byId = await google();
    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-other', email: 'u2@test.com', email_verified: true });
    const byEmail = await google();

    for (const r of [byId, byEmail]) {
      expect(r.status).toBe(none.status);
      expect(r.body).toEqual(none.body);
    }
    expect(prisma.__users.get('u2').googleId).toBeNull();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.__sessions.size).toBe(0);
  });

  it('geçersiz/süresi dolmuş belge → 401', async () => {
    verifyGoogleIdToken.mockRejectedValue(new Error('Token used too late'));
    const res = await google();
    expect(res.status).toBe(401);
    expect(prisma.__sessions.size).toBe(0);
  });

  it('Google e-postası doğrulanmamış → ret, bağlama yapılmaz', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-new', email: 'r1@test.com', email_verified: false });
    const res = await google();
    expect(res.status).toBe(401);
    expect(prisma.__users.get('r1').googleId).toBeNull();
  });

  it('askıdaki RESTAURANT → 403 askı mesajı', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com', googleId: 'g-1', isSuspended: true });
    verifyGoogleIdToken.mockResolvedValue({ sub: 'g-1', email: 'r1@test.com', email_verified: true });
    const res = await google();
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Hesabınız askıya alınmıştır.');
  });

  it('credential yok → 400', async () => {
    const res = await request(app).post('/api/auth/web/google')
      .set('Origin', ORIGIN).set('X-Forwarded-For', nextIp()).send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/web/session', () => {
  it('geçerli çerez → { user (sanitizeUser), csrfToken, mfa:"none" }', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const sid = extractSid(await login('r1@test.com'));
    const res = await withSid(request(app).get('/api/auth/web/session'), sid);

    expect(res.status).toBe(200);
    expect(res.body.mfa).toBe('none');
    expect(typeof res.body.csrfToken).toBe('string');
    expect(res.body.csrfToken.length).toBeGreaterThanOrEqual(32);
    expect(res.body.user.id).toBe('r1');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.passwordResetToken).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('çerez yok / geçersiz → 401', async () => {
    const none = await request(app).get('/api/auth/web/session');
    expect(none.status).toBe(401);
    const bad = await withSid(request(app).get('/api/auth/web/session'), 'uydurma');
    expect(bad.status).toBe(401);
    expect(bad.body.code).toBe('WEB_SESSION_INVALID');
  });

  it('72 saat istek gelmezse oturum geçersiz (boşta kalma)', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const t0 = Date.now();
    freezeNow(t0);
    const sid = extractSid(await login('r1@test.com'));

    nowSpy.mockReturnValue(t0 + 71 * HOUR);
    expect((await withSid(request(app).get('/api/auth/web/session'), sid)).status).toBe(200);

    // 71. saatteki istek boşta kalma sayacını ileri itti → 71+72 = 143. saatten önce geçerli.
    nowSpy.mockReturnValue(t0 + 142 * HOUR);
    expect((await withSid(request(app).get('/api/auth/web/session'), sid)).status).toBe(200);

    nowSpy.mockReturnValue(t0 + 142 * HOUR + 72 * HOUR + 1);
    const expired = await withSid(request(app).get('/api/auth/web/session'), sid);
    expect(expired.status).toBe(401);
    expect(prisma.__sessions.size).toBe(0); // tembel temizlik
  });

  it('aktif kullanılsa bile 14 gün sonra geçersiz (mutlak)', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const t0 = Date.now();
    freezeNow(t0);
    const sid = extractSid(await login('r1@test.com'));

    for (let day = 1; day <= 13; day += 1) {
      nowSpy.mockReturnValue(t0 + day * 24 * HOUR);
      expect((await withSid(request(app).get('/api/auth/web/session'), sid)).status).toBe(200);
    }
    nowSpy.mockReturnValue(t0 + 14 * 24 * HOUR);
    expect((await withSid(request(app).get('/api/auth/web/session'), sid)).status).toBe(401);
  });

  it('lastSeenAt en çok 5 dakikada bir yazılır', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const t0 = Date.now();
    freezeNow(t0);
    const sid = extractSid(await login('r1@test.com'));
    prisma.webSession.update.mockClear();

    nowSpy.mockReturnValue(t0 + 60 * 1000);
    await withSid(request(app).get('/api/auth/web/session'), sid);
    nowSpy.mockReturnValue(t0 + 4 * 60 * 1000);
    await withSid(request(app).get('/api/auth/web/session'), sid);
    expect(prisma.webSession.update).not.toHaveBeenCalled();

    nowSpy.mockReturnValue(t0 + 5 * 60 * 1000);
    await withSid(request(app).get('/api/auth/web/session'), sid);
    expect(prisma.webSession.update).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/auth/web/logout ve /logout-all', () => {
  it('logout yalnızca o oturumu siler; eski çerezle istek 401', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const a = await loginAndGetSession('r1@test.com');
    const b = await loginAndGetSession('r1@test.com');

    const out = await withSid(request(app).post('/api/auth/web/logout'), a.sid)
      .set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
    expect(out.status).toBe(204);
    expect(String(out.headers['set-cookie'])).toMatch(/Max-Age=0/);

    expect((await withSid(request(app).get('/api/auth/web/session'), a.sid)).status).toBe(401);
    expect((await withSid(request(app).get('/api/auth/web/session'), b.sid)).status).toBe(200);
  });

  it('logout-all kullanıcının bütün web oturumlarını siler, başka kullanıcınınkine dokunmaz', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    seedUser(prisma, { id: 'r2', email: 'r2@test.com' });
    const a = await loginAndGetSession('r1@test.com');
    const b = await loginAndGetSession('r1@test.com');
    const other = await loginAndGetSession('r2@test.com');

    const out = await withSid(request(app).post('/api/auth/web/logout-all'), a.sid)
      .set('Origin', ORIGIN).set('X-CSRF-Token', a.csrf);
    expect(out.status).toBe(204);

    expect((await withSid(request(app).get('/api/auth/web/session'), a.sid)).status).toBe(401);
    expect((await withSid(request(app).get('/api/auth/web/session'), b.sid)).status).toBe(401);
    expect((await withSid(request(app).get('/api/auth/web/session'), other.sid)).status).toBe(200);
  });

  it('logout CSRF token\'ı olmadan oturumu silmez → 403', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const a = await loginAndGetSession('r1@test.com');
    const out = await withSid(request(app).post('/api/auth/web/logout'), a.sid).set('Origin', ORIGIN);
    expect(out.status).toBe(403);
    expect((await withSid(request(app).get('/api/auth/web/session'), a.sid)).status).toBe(200);
  });

  it('süresi dolmuş oturumla logout → 204 ve çerez temizlenir', async () => {
    const out = await withSid(request(app).post('/api/auth/web/logout'), 'eski-deger').set('Origin', ORIGIN);
    expect(out.status).toBe(204);
    expect(String(out.headers['set-cookie'])).toMatch(/Max-Age=0/);
  });
});

describe('authenticate çerez dalı', () => {
  it('çerezle restoran ucu çalışır; req.user Bearer ile aynı şekil', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    prisma.restaurantProfile.findUnique.mockResolvedValue({ id: 'rp1', userId: 'r1', businessName: 'X', menuItems: [] });
    const { sid } = await loginAndGetSession('r1@test.com');

    const viaCookie = await withSid(request(app).get('/api/auth/me'), sid);
    const viaBearer = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${createTestToken('r1')}`);
    expect(viaCookie.status).toBe(200);
    expect(viaBearer.status).toBe(200);
    expect(Object.keys(viaCookie.body.user).sort()).toEqual(Object.keys(viaBearer.body.user).sort());
    expect(viaCookie.body.user).toEqual(viaBearer.body.user);

    const me = await withSid(request(app).get('/api/restaurant-account/me'), sid);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe('rp1');
  });

  it('Bearer ve çerez birlikte → Bearer kullanılır', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    seedUser(prisma, { id: 'u1', email: 'u1@test.com', role: 'USER' });
    const { sid } = await loginAndGetSession('r1@test.com');

    const res = await withSid(request(app).get('/api/auth/me'), sid)
      .set('Authorization', `Bearer ${createTestToken('u1')}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('u1');

    // Geçersiz Bearer + geçerli çerez → çereze DÜŞÜLMEZ.
    verifyGoogleIdToken.mockRejectedValue(new Error('invalid'));
    const bad = await withSid(request(app).get('/api/auth/me'), sid).set('Authorization', 'Bearer bozuk');
    expect(bad.status).toBe(401);
  });

  it('oturum açıkken askıya alınan hesap → 403 ve oturumları iptal', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const { sid } = await loginAndGetSession('r1@test.com');
    prisma.__users.get('r1').isSuspended = true;

    const res = await withSid(request(app).get('/api/auth/me'), sid);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Hesabınız askıya alınmıştır.');
    expect(prisma.__sessions.size).toBe(0);
  });

  it('rolü RESTAURANT olmaktan çıkan hesabın oturumu geçersizdir', async () => {
    seedUser(prisma, { id: 'r1', email: 'r1@test.com' });
    const { sid } = await loginAndGetSession('r1@test.com');
    prisma.__users.get('r1').role = 'USER';
    expect((await withSid(request(app).get('/api/auth/me'), sid)).status).toBe(401);
  });

  it('mobil Bearer akışı değişmedi: çerezsiz Bearer → 200, başlıksız → 401 "Missing authorization token"', async () => {
    seedUser(prisma, { id: 'u1', email: 'u1@test.com', role: 'USER' });
    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${createTestToken('u1')}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['set-cookie']).toBeUndefined();
    const none = await request(app).get('/api/auth/me');
    expect(none.status).toBe(401);
    expect(none.body).toEqual({ error: 'Missing authorization token' });
    expect(prisma.webSession.findUnique).not.toHaveBeenCalled();
  });
});
