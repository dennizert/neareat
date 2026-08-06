'use strict';

/**
 * Admin iş mantığı (S23-3): admin girişi (brute-force korumalı), restoran başvuru
 * onay/ret akışı, platform istatistikleri, kullanıcı yönetimi, yorum moderasyonu,
 * kullanıcı şikayetleri, manuel job tetikleme ve metrikler.
 *
 * S22-1 konvansiyonunu izler. Bu dosyaya özgü iki kural:
 *
 *  1. YETKİLENDİRME BURADA DEĞİL. `requireAdmin` middleware'i route seviyesinde kalır —
 *     yetki kontrolünü servise taşımak, servisi doğrudan çağıran bir yol açıldığında
 *     (cron, başka controller) kontrolün sessizce atlanabilmesi demektir. Route seviyesinde
 *     kalması, korumanın uç noktaya bağlı kalmasını garanti eder.
 *
 *  2. Manuel job tetikleyicileri `withCronLock` ile SARILMAZ. Kilit, çok replikalı
 *     ortamda zamanlanmış tetiği tekilleştirmek içindir (S16-6); admin elle tetiklediğinde
 *     "başka replika çalıştırıyor" diye sessizce atlanması istenmeyen bir davranış olurdu.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { HttpError } = require('../utils/httpError');
const { signToken } = require('../utils/jwt');
const { runFriendSuggestionsJob } = require('../jobs/friendSuggestions');
const { runNotificationCleanup } = require('../jobs/notificationCleanup');
const { runSeasonResetJob } = require('../jobs/seasonReset');
const { startTrialForRestaurant } = require('./restaurantSubscription');
const { createNotification } = require('./notificationService');
const { cacheGet, cacheSet, cacheDel } = require('./redis');
const { logSecurityEvent, EVENTS } = require('../middleware/securityLogger');
const { snapshot, evaluateAlarms } = require('./metrics'); // S16-2

// Admin login brute-force koruması (S12-6): IP+e-posta başına başarısız deneme
// sayacı. Eşik aşılınca o IP+e-posta geçici kilitlenir. IP'yi de anahtara katarak
// saldırganın farklı IP'den gerçek admini global kilitlemesi önlenir.
const ADMIN_LOGIN_MAX_FAILS = 5;
const ADMIN_LOGIN_LOCK_SECONDS = 15 * 60;

function adminFailKey(ip, email) {
  return `admin-login-fail:${ip}:${String(email).toLowerCase()}`;
}

async function registerAdminFail(key, currentFails, { ip, requestId }) {
  // Redis hatası girişi tamamen bloke etmemeli (fail-open sayaç).
  await cacheSet(key, currentFails + 1, ADMIN_LOGIN_LOCK_SECONDS).catch(() => {});
  logSecurityEvent(EVENTS.AUTH_FAILED, {
    ip,
    requestId,
    reason: 'admin_login_failed',
    count: currentFails + 1,
  });
}

// Onay listelerinde dönen restoran profili alanları (vergi levhası verisi hariç).
const PROFILE_SUMMARY = {
  id: true, businessName: true, ownerName: true, taxNumber: true,
  taxOffice: true, phone: true, contactEmail: true, address: true,
  businessCategory: true, placeId: true, placeName: true, placeAddress: true,
  placePhotoUrl: true, status: true, rejectionReason: true, approvedAt: true,
  createdAt: true,
  user: { select: { id: true, email: true, displayName: true } },
};

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * @param {{ email: string, password: string }} credentials
 * @param {{ ip: string, requestId: string }} context güvenlik logu + kilit anahtarı için
 */
async function adminLogin({ email, password }, context) {
  if (!email || !password) throw new HttpError(400, { error: 'email ve password gerekli' });

  const key = adminFailKey(context.ip, email);
  const fails = Number(await cacheGet(key).catch(() => 0)) || 0;
  if (fails >= ADMIN_LOGIN_MAX_FAILS) {
    logSecurityEvent(EVENTS.ADMIN_LOGIN_LOCKED, {
      ip: context.ip,
      requestId: context.requestId,
      email: String(email).toLowerCase(),
    });
    throw new HttpError(429, {
      error: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
    });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
    await registerAdminFail(key, fails, context);
    throw new HttpError(401, { error: 'Geçersiz kimlik bilgileri' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await registerAdminFail(key, fails, context);
    throw new HttpError(401, { error: 'Geçersiz kimlik bilgileri' });
  }

  // Başarılı giriş → başarısızlık sayacını sıfırla.
  await cacheDel(key).catch(() => {});
  const token = signToken(user.id);
  return { token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } };
}

async function seedAdmin({ email, password, displayName }) {
  if (!email || !password || !displayName) throw new HttpError(400, { error: 'Tüm alanlar gerekli' });

  const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existing) throw new HttpError(409, { error: 'Admin hesabı zaten mevcut' });

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: { email: email.toLowerCase(), displayName, passwordHash, authProvider: 'email', role: 'ADMIN' },
    select: { id: true, email: true, displayName: true, role: true },
  });
}

// ─── Restoran başvuruları ────────────────────────────────────────────────────

async function getPendingRestaurants({ status = 'PENDING', page = '1', limit = '20' }) {
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [profiles, total] = await Promise.all([
    prisma.restaurantProfile.findMany({
      where: { status },
      select: PROFILE_SUMMARY,
      orderBy: { createdAt: 'asc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.restaurantProfile.count({ where: { status } }),
  ]);

  return { profiles, total, page: parseInt(page), limit: parseInt(limit) };
}

async function getRestaurantDetail(id) {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, displayName: true, createdAt: true } },
      menuItems: { select: { id: true, mimeType: true, fileName: true, uploadedAt: true } },
    },
  });
  if (!profile) throw new HttpError(404, { error: 'Bulunamadı' });

  // Vergi levhası verisi listede GÖNDERİLMEZ — yalnızca varlık bayrağı.
  const { taxCertificateData, ...rest } = profile;
  return { ...rest, hasTaxCertificate: !!taxCertificateData };
}

async function getTaxCertificate(id) {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { id },
    select: { taxCertificateData: true, taxNumber: true },
  });
  if (!profile || !profile.taxCertificateData) {
    throw new HttpError(404, { error: 'Vergi levhası bulunamadı' });
  }
  return { data: profile.taxCertificateData };
}

async function approveRestaurant(adminId, id) {
  const profile = await prisma.restaurantProfile.update({
    where: { id },
    data: { status: 'APPROVED', approvedAt: new Date(), reviewedByAdminId: adminId, rejectionReason: null },
    select: PROFILE_SUMMARY,
  });
  // S19-1: onayda 15 günlük ücretsiz trial başlat (aboneliği yoksa). Best-effort —
  // trial açılamazsa onay yine geçerlidir.
  if (profile.user?.id) startTrialForRestaurant(profile.user.id).catch(() => {});
  return profile;
}

async function rejectRestaurant(adminId, id, { rejectionReason }) {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new HttpError(400, { error: 'Red nedeni zorunludur' });
  }
  return prisma.restaurantProfile.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: rejectionReason.trim(), reviewedByAdminId: adminId },
    select: PROFILE_SUMMARY,
  });
}

// ─── Platform istatistikleri ─────────────────────────────────────────────────

async function getPlatformStats() {
  // Gün başlangıcı (yerel) — "bugün" filtrelerinin alt sınırı.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers, totalRestaurants, approvedRestaurants, pendingRestaurants,
    totalReviews, totalFavorites, totalRecommendations,
    activePremium, newUsersToday, newRestaurantsToday,
    activeUsersToday, activeRestaurantsToday,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.restaurantProfile.count(),
    prisma.restaurantProfile.count({ where: { status: 'APPROVED' } }),
    prisma.restaurantProfile.count({ where: { status: 'PENDING' } }),
    prisma.review.count(),
    prisma.favorite.count(),
    prisma.recommendation.count(),
    prisma.subscription.count({ where: { status: 'active', expiresAt: { gt: new Date() } } }),
    prisma.user.count({ where: { role: 'USER', createdAt: { gte: today } } }),
    prisma.restaurantProfile.count({ where: { createdAt: { gte: today } } }),
    // Daily active: users/restaurants who logged in today
    prisma.user.count({ where: { role: 'USER', lastLoginAt: { gte: today } } }),
    prisma.user.count({ where: { role: 'RESTAURANT', lastLoginAt: { gte: today } } }),
  ]);

  return {
    totalUsers, totalRestaurants, approvedRestaurants, pendingRestaurants,
    totalReviews, totalFavorites, totalRecommendations, activePremium,
    newUsersToday, newRestaurantsToday, activeUsersToday, activeRestaurantsToday,
  };
}

// ─── Kullanıcı yönetimi ──────────────────────────────────────────────────────

async function getUsers({ search = '', page = '1', limit = '30', role = 'USER' }) {
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    role,
    ...(search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, displayName: true, role: true,
        isSuspended: true, starCount: true, createdAt: true,
        subscription: { select: { status: true, expiresAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page: parseInt(page) };
}

async function suspendUser(adminId, id) {
  // Adminin kendini kilitlemesini engelle.
  if (id === adminId) throw new HttpError(400, { error: 'Kendi hesabınızı askıya alamazsınız' });

  return prisma.user.update({
    where: { id },
    data: { isSuspended: true },
    select: { id: true, email: true, displayName: true, isSuspended: true },
  });
}

async function unsuspendUser(id) {
  return prisma.user.update({
    where: { id },
    data: { isSuspended: false },
    select: { id: true, email: true, displayName: true, isSuspended: true },
  });
}

// ─── Yorum moderasyonu ───────────────────────────────────────────────────────

async function deleteReview(id) {
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) throw new HttpError(404, { error: 'Yorum bulunamadı' });

  await prisma.review.delete({ where: { id } });
  return { review, body: { message: 'Yorum silindi' } };
}

async function getFlaggedReviews() {
  // Return latest reviews for moderation (no flag system yet — show recent)
  return prisma.review.findMany({
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      reply: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

// ─── Kullanıcı şikayetleri ───────────────────────────────────────────────────

async function getReports({ status = 'PENDING', page = '1', limit = '20' }) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = status === 'ALL' ? {} : { status };

  const [reports, total] = await Promise.all([
    prisma.userReport.findMany({
      where,
      include: {
        reporter: { select: { id: true, displayName: true, email: true } },
        reported: { select: { id: true, displayName: true, email: true, isSuspended: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.userReport.count({ where }),
  ]);

  return { reports, total, page: parseInt(page), limit: parseInt(limit) };
}

async function handleReport(id, { action, actionNote }) {
  if (!['suspend', 'dismiss', 'warn'].includes(action)) {
    throw new HttpError(400, { error: 'Geçersiz işlem. suspend | dismiss | warn olmalı.' });
  }

  const report = await prisma.userReport.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true } },
      reported: { select: { id: true, displayName: true } },
    },
  });
  if (!report) throw new HttpError(404, { error: 'Şikayet bulunamadı.' });

  let actionTaken = actionNote?.trim() || null;
  const notifTitle = 'Şikayetiniz İncelendi';
  let notifBody = '';

  if (action === 'suspend') {
    await prisma.user.update({ where: { id: report.reportedId }, data: { isSuspended: true } });
    actionTaken = actionTaken || `${report.reported.displayName} hesabı askıya alındı.`;
    notifBody = 'Şikayet ettiğiniz kullanıcı için hesap askıya alma işlemi yapıldı.';
  } else if (action === 'dismiss') {
    actionTaken = actionTaken || 'Şikayet geçersiz sayıldı.';
    notifBody = 'Şikayetiniz incelendi ancak kural ihlali tespit edilmedi.';
  } else if (action === 'warn') {
    actionTaken = actionTaken || `${report.reported.displayName} kullanıcısına uyarı verildi.`;
    notifBody = 'Şikayet ettiğiniz kullanıcı hakkında gerekli uyarı işlemi yapıldı.';
  }

  await prisma.userReport.update({
    where: { id },
    data: { status: action === 'dismiss' ? 'DISMISSED' : 'RESOLVED', actionTaken },
  });

  // Şikayet edene bildirim gönder (fire-and-forget)
  createNotification(report.reporterId, 'REPORT_RESOLVED', notifTitle, notifBody, { reportId: id, action }).catch(() => {});

  return { report, body: { message: 'Şikayet işlemi tamamlandı.' } };
}

// ─── Manuel job tetikleyicileri ──────────────────────────────────────────────
// Kasıtlı olarak `withCronLock`'suz: kilit zamanlanmış tetiği replikalar arasında
// tekilleştirmek içindir (S16-6); admin elle çalıştırdığında ATLANMAMALI.

async function triggerFriendSuggestions() {
  const result = await runFriendSuggestionsJob();
  if (result.error) {
    throw new HttpError(500, { error: 'Job çalışırken hata oluştu', detail: result.error });
  }
  return { result, body: { message: 'Arkadaş önerileri yeniden hesaplandı.', ...result } };
}

async function triggerSeasonReset() {
  // S18-4: süre kontrolünü atlayarak (force) sıfırlamayı çalıştırır; test/operasyon için.
  const result = await runSeasonResetJob({ force: true });
  if (result.error) {
    throw new HttpError(500, { error: 'Job çalışırken hata oluştu', detail: result.error });
  }
  return { result, body: { message: 'Sezon sıfırlama çalıştırıldı.', ...result } };
}

async function triggerNotificationCleanup() {
  const deleted = await runNotificationCleanup();
  return { deleted, body: { message: 'Bildirim temizliği tamamlandı.', deleted } };
}

// ─── Metrikler (S16-2) ───────────────────────────────────────────────────────

async function getMetrics() {
  const snap = snapshot();
  // DB havuz göstergesi — admin endpoint'inde anlık sorgu (istek başına değil).
  let dbActiveConnections = null;
  try {
    const rows = await prisma.$queryRaw`SELECT count(*)::int AS active FROM pg_stat_activity WHERE datname = current_database()`;
    dbActiveConnections = Array.isArray(rows) && rows[0] ? Number(rows[0].active) : null;
  } catch {
    dbActiveConnections = null; // pg_stat_activity erişilemezse sessiz geç
  }
  return { ...snap, db: { activeConnections: dbActiveConnections }, alarms: evaluateAlarms(snap) };
}

module.exports = {
  adminLogin, seedAdmin,
  getPendingRestaurants, getRestaurantDetail, getTaxCertificate,
  approveRestaurant, rejectRestaurant,
  getPlatformStats,
  getUsers, suspendUser, unsuspendUser,
  deleteReview, getFlaggedReviews,
  getReports, handleReport,
  triggerFriendSuggestions, triggerNotificationCleanup, triggerSeasonReset,
  getMetrics,
  ADMIN_LOGIN_MAX_FAILS, PROFILE_SUMMARY,
};
