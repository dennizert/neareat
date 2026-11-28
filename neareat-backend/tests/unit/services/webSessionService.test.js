'use strict';

jest.mock('../../../src/utils/prisma', () => require('../../webTestUtils').createFakePrisma());

const prisma = require('../../../src/utils/prisma');
const svc = require('../../../src/services/webSessionService');
const { seedUser } = require('../../webTestUtils');

const HOUR = 60 * 60 * 1000;
let nowSpy;

beforeEach(() => {
  prisma.__users.clear();
  prisma.__sessions.clear();
  jest.clearAllMocks();
  nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 28, 12));
  delete process.env.WEB_SESSION_IDLE_HOURS;
  delete process.env.WEB_SESSION_ABSOLUTE_DAYS;
});

afterEach(() => nowSpy.mockRestore());

describe('getSessionDurations', () => {
  it('varsayılan 72 saat / 14 gün', () => {
    expect(svc.getSessionDurations()).toEqual({ idleMs: 72 * HOUR, absoluteMs: 14 * 24 * HOUR });
  });
  it('env ile ayarlanır; geçersiz değer varsayılana düşer', () => {
    process.env.WEB_SESSION_IDLE_HOURS = '1';
    process.env.WEB_SESSION_ABSOLUTE_DAYS = 'abc';
    expect(svc.getSessionDurations()).toEqual({ idleMs: HOUR, absoluteMs: 14 * 24 * HOUR });
  });
});

describe('isSessionLive (saf)', () => {
  const at = new Date(Date.UTC(2026, 0, 1));
  const future = new Date(at.getTime() + 1000);
  const past = new Date(at.getTime() - 1);
  it.each([
    [{ idleExpiresAt: future, absoluteExpiresAt: future, revokedAt: null }, true],
    [{ idleExpiresAt: past, absoluteExpiresAt: future, revokedAt: null }, false],
    [{ idleExpiresAt: future, absoluteExpiresAt: past, revokedAt: null }, false],
    [{ idleExpiresAt: future, absoluteExpiresAt: future, revokedAt: past }, false],
    [{ idleExpiresAt: at, absoluteExpiresAt: future, revokedAt: null }, false],
    [null, false],
  ])('%#', (s, expected) => {
    expect(svc.isSessionLive(s, at)).toBe(expected);
  });
});

describe('createWebSession / resolveWebSession', () => {
  it('ham kimlik ve CSRF token 32 bayt rastgele; DB anahtarı HMAC', async () => {
    seedUser(prisma, { id: 'r1' });
    const a = await svc.createWebSession('r1');
    const b = await svc.createWebSession('r1');
    expect(a.rawId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.rawId).not.toBe(b.rawId);
    expect(prisma.__sessions.has(svc.sessionKey(a.rawId))).toBe(true);
    expect(prisma.__sessions.has(a.rawId)).toBe(false);
    expect(a.maxAgeSeconds).toBe(14 * 24 * 3600);
  });

  it('resolve: user + session döner; user tam kayıttır', async () => {
    seedUser(prisma, { id: 'r1' });
    const { rawId, csrfToken } = await svc.createWebSession('r1');
    const out = await svc.resolveWebSession(rawId);
    expect(out.user.id).toBe('r1');
    expect(out.user.passwordHash).toBeDefined(); // DTO filtresi çağıranın işi
    expect(out.session.csrfSecret).toBe(csrfToken);
    expect(out.session.user).toBeUndefined();
  });

  it.each([null, '', 'x'.repeat(200), 123])('kullanılamaz kimlik (%p) DB\'ye gitmez', async (raw) => {
    expect(await svc.resolveWebSession(raw)).toBeNull();
    expect(prisma.webSession.findUnique).not.toHaveBeenCalled();
  });

  it('previousRawId verilirse eski satır silinir', async () => {
    seedUser(prisma, { id: 'r1' });
    const old = await svc.createWebSession('r1');
    await svc.createWebSession('r1', { previousRawId: old.rawId });
    expect(prisma.__sessions.has(svc.sessionKey(old.rawId))).toBe(false);
    expect(prisma.__sessions.size).toBe(1);
  });

  it('ADMIN/USER rolündeki oturum satırı geçersiz sayılır ve silinir', async () => {
    seedUser(prisma, { id: 'a1', role: 'ADMIN' });
    const { rawId } = await svc.createWebSession('a1');
    expect(await svc.resolveWebSession(rawId)).toBeNull();
    expect(prisma.__sessions.size).toBe(0);
  });

  it('boşta kalma süresi mutlak bitişi aşamaz', async () => {
    process.env.WEB_SESSION_IDLE_HOURS = String(24 * 30); // 30 gün > 14 gün
    seedUser(prisma, { id: 'r1' });
    const { rawId } = await svc.createWebSession('r1');
    const row = prisma.__sessions.get(svc.sessionKey(rawId));
    expect(row.idleExpiresAt.getTime()).toBe(row.absoluteExpiresAt.getTime());
  });
});

describe('revoke', () => {
  it('revokeAllWebSessions yalnızca o kullanıcının satırlarını siler', async () => {
    seedUser(prisma, { id: 'r1' });
    seedUser(prisma, { id: 'r2' });
    await svc.createWebSession('r1');
    await svc.createWebSession('r1');
    await svc.createWebSession('r2');
    expect(await svc.revokeAllWebSessions('r1', 'test')).toBe(2);
    expect(prisma.__sessions.size).toBe(1);
  });

  it('DB hatasında fırlatmaz, null döner', async () => {
    prisma.webSession.deleteMany.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.revokeAllWebSessions('r1', 'test')).resolves.toBeNull();
  });

  it('revokeWebSession tek satırı siler', async () => {
    seedUser(prisma, { id: 'r1' });
    const a = await svc.createWebSession('r1');
    await svc.createWebSession('r1');
    expect(await svc.revokeWebSession(a.rawId)).toBe(1);
    expect(await svc.revokeWebSession(null)).toBe(0);
    expect(prisma.__sessions.size).toBe(1);
  });
});

describe('csrfTokenMatches', () => {
  const session = { csrfSecret: 'gizli-token-degeri' };
  it.each([
    ['gizli-token-degeri', true],
    ['gizli-token-degerX', false],
    ['kisa', false],
    ['', false],
    [undefined, false],
    [['gizli-token-degeri'], false],
  ])('%p → %p', (provided, expected) => {
    expect(svc.csrfTokenMatches(session, provided)).toBe(expected);
  });
  it('oturum yoksa false', () => {
    expect(svc.csrfTokenMatches(null, 'x')).toBe(false);
  });
});
