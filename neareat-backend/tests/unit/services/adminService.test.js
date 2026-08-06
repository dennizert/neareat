'use strict';

/**
 * adminService birim testleri (S23-3).
 *
 * Bu, kod tabanındaki EN YÜKSEK YETKİLİ yüzey. Testler refactor sırasında sessizce
 * bozulabilecek koruma ve yan etkileri hedefler: brute-force sayacı, adminin kendini
 * kilitleyememesi, restoran onayındaki 15 günlük trial yan etkisi (S19-1), manuel job
 * tetikleyicilerinin kilitsiz çalışması ve vergi levhasının listede sızmaması.
 */

jest.mock('../../../src/utils/prisma', () => ({
  user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  restaurantProfile: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  review: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), delete: jest.fn() },
  favorite: { count: jest.fn() },
  recommendation: { count: jest.fn() },
  subscription: { count: jest.fn() },
  userReport: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  $queryRaw: jest.fn(),
}));
jest.mock('../../../src/services/redis', () => ({
  cacheGet: jest.fn(), cacheSet: jest.fn().mockResolvedValue(undefined), cacheDel: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/restaurantSubscription', () => ({ startTrialForRestaurant: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/services/notificationService', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../src/middleware/securityLogger', () => ({
  logSecurityEvent: jest.fn(),
  EVENTS: { AUTH_FAILED: 'AUTH_FAILED', ADMIN_LOGIN_LOCKED: 'ADMIN_LOGIN_LOCKED' },
}));
jest.mock('../../../src/jobs/friendSuggestions', () => ({ runFriendSuggestionsJob: jest.fn() }));
jest.mock('../../../src/jobs/notificationCleanup', () => ({ runNotificationCleanup: jest.fn() }));
jest.mock('../../../src/jobs/seasonReset', () => ({ runSeasonResetJob: jest.fn() }));
jest.mock('../../../src/services/metrics', () => ({ snapshot: jest.fn(() => ({ requests: {} })), evaluateAlarms: jest.fn(() => []) }));
jest.mock('../../../src/utils/jwt', () => ({ signToken: jest.fn(() => 'tok') }));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn().mockResolvedValue('hashed') }));

const bcrypt = require('bcryptjs');
const prisma = require('../../../src/utils/prisma');
const { cacheGet, cacheSet, cacheDel } = require('../../../src/services/redis');
const { startTrialForRestaurant } = require('../../../src/services/restaurantSubscription');
const { logSecurityEvent } = require('../../../src/middleware/securityLogger');
const { runFriendSuggestionsJob } = require('../../../src/jobs/friendSuggestions');
const { runSeasonResetJob } = require('../../../src/jobs/seasonReset');
const svc = require('../../../src/services/adminService');
const { HttpError } = require('../../../src/utils/httpError');

const ADMIN_ID = 'admin-1';
const CTX = { ip: '1.2.3.4', requestId: 'req-1' };

beforeEach(() => {
  jest.clearAllMocks();
  cacheGet.mockResolvedValue(0);
});

async function expectHttpError(promise, status, bodyMatch) {
  const err = await promise.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(HttpError);
  expect(err.status).toBe(status);
  if (bodyMatch) expect(err.body).toMatchObject(bodyMatch);
  return err;
}

describe('adminLogin — brute-force koruması (S12-6)', () => {
  it('eşik aşıldığında 429 döner ve DB\'ye hiç gidilmez', async () => {
    cacheGet.mockResolvedValue(svc.ADMIN_LOGIN_MAX_FAILS);
    await expectHttpError(svc.adminLogin({ email: 'a@b.c', password: 'x' }, CTX), 429);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(logSecurityEvent).toHaveBeenCalledWith('ADMIN_LOGIN_LOCKED', expect.objectContaining({ ip: CTX.ip }));
  });

  it('yanlış şifrede sayaç artar ve güvenlik olayı loglanır', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u', role: 'ADMIN', passwordHash: 'h' });
    bcrypt.compare.mockResolvedValue(false);

    await expectHttpError(svc.adminLogin({ email: 'a@b.c', password: 'yanlis' }, CTX), 401);

    expect(cacheSet).toHaveBeenCalledWith(expect.stringContaining('admin-login-fail'), 1, expect.any(Number));
    expect(logSecurityEvent).toHaveBeenCalledWith('AUTH_FAILED', expect.objectContaining({ reason: 'admin_login_failed' }));
  });

  it('ADMIN olmayan kullanıcı aynı hatayı alır (rol sızdırılmaz)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u', role: 'USER', passwordHash: 'h' });
    const err = await expectHttpError(svc.adminLogin({ email: 'a@b.c', password: 'x' }, CTX), 401);
    expect(err.body.error).toBe('Geçersiz kimlik bilgileri');
  });

  it('kilit anahtarı IP + e-posta içerir (farklı IP global kilitleyemez)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expectHttpError(svc.adminLogin({ email: 'A@B.c', password: 'x' }, CTX), 401);
    expect(cacheSet).toHaveBeenCalledWith('admin-login-fail:1.2.3.4:a@b.c', 1, expect.any(Number));
  });

  it('başarılı girişte sayaç sıfırlanır ve token döner', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u', role: 'ADMIN', passwordHash: 'h', email: 'a@b.c', displayName: 'A' });
    bcrypt.compare.mockResolvedValue(true);

    const result = await svc.adminLogin({ email: 'a@b.c', password: 'dogru' }, CTX);

    expect(cacheDel).toHaveBeenCalled();
    expect(result.token).toBe('tok');
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});

describe('kullanıcı askıya alma', () => {
  it('admin KENDİNİ askıya alamaz (kilitlenme koruması)', async () => {
    await expectHttpError(svc.suspendUser(ADMIN_ID, ADMIN_ID), 400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('başka kullanıcıyı askıya alır', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u-2', isSuspended: true });
    await svc.suspendUser(ADMIN_ID, 'u-2');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-2' }, data: { isSuspended: true } }),
    );
  });
});

describe('restoran onayı — S19-1 trial yan etkisi', () => {
  it('onayda 15 günlük trial başlatılır', async () => {
    prisma.restaurantProfile.update.mockResolvedValue({ id: 'p1', businessName: 'T', user: { id: 'owner-1' } });
    await svc.approveRestaurant(ADMIN_ID, 'p1');
    expect(startTrialForRestaurant).toHaveBeenCalledWith('owner-1');
  });

  it('onaylayan admin damgalanır ve red nedeni temizlenir', async () => {
    prisma.restaurantProfile.update.mockResolvedValue({ id: 'p1', user: { id: 'o' } });
    await svc.approveRestaurant(ADMIN_ID, 'p1');
    expect(prisma.restaurantProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED', reviewedByAdminId: ADMIN_ID, rejectionReason: null,
        }),
      }),
    );
  });

  it('trial başlatma hatası onayı BOZMAZ (best-effort)', async () => {
    prisma.restaurantProfile.update.mockResolvedValue({ id: 'p1', user: { id: 'owner-1' } });
    startTrialForRestaurant.mockRejectedValue(new Error('abonelik servisi kapalı'));
    await expect(svc.approveRestaurant(ADMIN_ID, 'p1')).resolves.toMatchObject({ id: 'p1' });
  });

  it('red için gerekçe zorunlu', async () => {
    await expectHttpError(svc.rejectRestaurant(ADMIN_ID, 'p1', { rejectionReason: '   ' }), 400);
    expect(prisma.restaurantProfile.update).not.toHaveBeenCalled();
  });
});

describe('vergi levhası gizliliği', () => {
  it('detay yanıtında ham veri YOK, yalnızca varlık bayrağı', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({
      id: 'p1', businessName: 'T', taxCertificateData: 'base64-gizli-veri',
    });
    const result = await svc.getRestaurantDetail('p1');
    expect(result).not.toHaveProperty('taxCertificateData');
    expect(result.hasTaxCertificate).toBe(true);
  });

  it('levha yoksa ayrı uçtan 404', async () => {
    prisma.restaurantProfile.findUnique.mockResolvedValue({ taxCertificateData: null });
    await expectHttpError(svc.getTaxCertificate('p1'), 404);
  });
});

describe('şikayet işleme', () => {
  const report = { id: 'rep-1', reportedId: 'u-2', reporterId: 'u-3', reported: { id: 'u-2', displayName: 'Kötü' } };

  beforeEach(() => {
    prisma.userReport.findUnique.mockResolvedValue(report);
    prisma.userReport.update.mockResolvedValue({});
    prisma.user.update.mockResolvedValue({});
  });

  it('geçersiz işlem reddedilir', async () => {
    await expectHttpError(svc.handleReport('rep-1', { action: 'ban' }), 400);
  });

  it('suspend → kullanıcı askıya alınır, şikayet RESOLVED olur', async () => {
    await svc.handleReport('rep-1', { action: 'suspend' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u-2' }, data: { isSuspended: true } }),
    );
    expect(prisma.userReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RESOLVED' }) }),
    );
  });

  it('dismiss → DISMISSED olur, kullanıcı askıya ALINMAZ', async () => {
    await svc.handleReport('rep-1', { action: 'dismiss' });
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.userReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DISMISSED' }) }),
    );
  });

  it('olmayan şikayet 404', async () => {
    prisma.userReport.findUnique.mockResolvedValue(null);
    await expectHttpError(svc.handleReport('yok', { action: 'dismiss' }), 404);
  });
});

describe('manuel job tetikleyicileri', () => {
  it('sezon sıfırlama FORCE ile çalışır (süre kontrolü atlanır)', async () => {
    runSeasonResetJob.mockResolvedValue({ action: 'reset' });
    await svc.triggerSeasonReset();
    expect(runSeasonResetJob).toHaveBeenCalledWith({ force: true });
  });

  it('job hatası 500 olarak bildirilir', async () => {
    runFriendSuggestionsJob.mockResolvedValue({ error: 'redis down' });
    await expectHttpError(svc.triggerFriendSuggestions(), 500, { detail: 'redis down' });
  });

  it('başarılı job sonucu gövdeye yayılır', async () => {
    runFriendSuggestionsJob.mockResolvedValue({ stored: 42 });
    const { body } = await svc.triggerFriendSuggestions();
    expect(body).toMatchObject({ stored: 42 });
  });
});

describe('metrikler', () => {
  it('pg_stat_activity erişilemezse activeConnections null olur (sessiz geçer)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('izin yok'));
    const result = await svc.getMetrics();
    expect(result.db.activeConnections).toBeNull();
    expect(result).toHaveProperty('alarms');
  });

  it('bağlantı sayısı okunabiliyorsa yanıta girer', async () => {
    prisma.$queryRaw.mockResolvedValue([{ active: 7 }]);
    const result = await svc.getMetrics();
    expect(result.db.activeConnections).toBe(7);
  });
});

describe('seedAdmin', () => {
  it('admin zaten varsa 409', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'mevcut' });
    await expectHttpError(svc.seedAdmin({ email: 'a@b.c', password: 'p', displayName: 'A' }), 409);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('eksik alan 400', async () => {
    await expectHttpError(svc.seedAdmin({ email: 'a@b.c' }), 400);
  });
});
