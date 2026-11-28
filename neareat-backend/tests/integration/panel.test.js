'use strict';

/**
 * /panel — web paneli statik servis + SPA fallback + panel CSP (issue #526).
 * `web/dist` yerine `tests/fixtures/panel-dist` kullanılır (WEB_DIST_DIR).
 */

const path = require('path');
const request = require('supertest');

jest.mock('../../src/utils/prisma', () => require('../webTestUtils').createFakePrisma());
jest.mock('../../src/services/firebase', () => ({
  getAuth: () => ({ getUserByEmail: jest.fn(), deleteUser: jest.fn() }),
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

const FIXTURE_DIST = path.join(__dirname, '..', 'fixtures', 'panel-dist');

function loadApp(distDir) {
  let app;
  process.env.WEB_DIST_DIR = distDir;
  jest.isolateModules(() => {
    app = require('../../src/app');
  });
  delete process.env.WEB_DIST_DIR;
  return app;
}

describe('web/dist mevcut', () => {
  const app = loadApp(FIXTURE_DIST);

  it.each(['/panel', '/panel/', '/panel/rezervasyonlar', '/panel/a/b/c?x=1'])(
    'GET %s → index.html, 200, Cache-Control: no-cache',
    async (url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Eatlas Panel');
      expect(res.headers['cache-control']).toBe('no-cache');
    },
  );

  it('GET /panel/index.html da önbelleğe alınmaz', async () => {
    const res = await request(app).get('/panel/index.html');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('GET /panel/assets/<dosya> → dosya, 1 yıl immutable', async () => {
    const res = await request(app).get('/panel/assets/index-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('olmayan varlık → 404, index.html\'e düşmez', async () => {
    const res = await request(app).get('/panel/assets/yok-999.js');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('Eatlas Panel');
  });

  it('kök statik dosya (favicon) servis edilir', async () => {
    const res = await request(app).get('/panel/favicon.svg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/svg/);
  });

  it('panel CSP: self + GIS + Google Fonts; frame-ancestors none', async () => {
    const res = await request(app).get('/panel/giris');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self' https:\/\/accounts\.google\.com\/gsi\/client/);
    expect(csp).toMatch(/style-src 'self' https:\/\/accounts\.google\.com\/gsi\/style https:\/\/fonts\.googleapis\.com/);
    expect(csp).toContain('font-src \'self\' https://fonts.gstatic.com');
    expect(csp).toMatch(/connect-src 'self' https:\/\/accounts\.google\.com\/gsi\//);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  });

  it('varlık yanıtları da CSP taşır', async () => {
    const res = await request(app).get('/panel/assets/index-abc123.js');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it.each(['/health', '/reset-password?token=t', '/verify-email?token=t', '/api/auth/me'])(
    'CSP %s yanıtına uygulanmaz',
    async (url) => {
      const res = await request(app).get(url);
      expect(res.headers['content-security-policy']).toBeUndefined();
    },
  );

  it('/panel dışı yollar davranışını korur (/reset-password ara sayfası)', async () => {
    const res = await request(app).get('/reset-password?token=abc');
    expect(res.status).toBe(200);
    expect(res.text).toContain('neareat://reset-password?token=abc');
  });

  it('/panelx gibi benzer yollar panele düşmez', async () => {
    const res = await request(app).get('/panelx');
    expect(res.status).toBe(404);
  });

  it('POST /panel → 404 (yalnızca GET servis edilir)', async () => {
    const res = await request(app).post('/panel/giris');
    expect(res.status).toBe(404);
  });
});

describe('web/dist yok', () => {
  const app = loadApp(path.join(__dirname, '..', 'fixtures', 'olmayan-dist'));

  it('backend açılır; /health çalışır', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it.each(['/panel', '/panel/rezervasyonlar'])('GET %s → 503 anlaşılır mesaj', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(503);
    expect(res.text).toMatch(/derlenmedi/);
  });

  it('varlık isteği → 404', async () => {
    const res = await request(app).get('/panel/assets/index-abc123.js');
    expect(res.status).toBe(404);
  });
});

describe('buildPanelCspDirectives', () => {
  const { buildPanelCspDirectives, photoStoreOrigin } = require('../../src/routes/panel');

  it('foto deposu yapılandırılmışsa img/connect listesine eklenir', () => {
    const env = { AWS_S3_BUCKET: 'eatlas-photos', AWS_REGION: 'eu-central-1' };
    const d = buildPanelCspDirectives(env);
    const store = 'https://eatlas-photos.s3.eu-central-1.amazonaws.com';
    expect(photoStoreOrigin(env)).toBe(store);
    expect(d.connectSrc).toContain(store);
    expect(d.imgSrc).toContain(store);
  });

  it('yapılandırılmamışsa eklenmez', () => {
    const d = buildPanelCspDirectives({});
    expect(d.connectSrc).toEqual(["'self'", 'https://accounts.google.com/gsi/']);
  });
});
