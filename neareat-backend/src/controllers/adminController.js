// Admin controller'ı: admin girişi (brute-force korumalı), restoran başvuru
// onay/ret akışı, platform istatistikleri, kullanıcı yönetimi (askıya alma),
// yorum moderasyonu, kullanıcı şikayetleri, manuel job tetikleme ve metrikler.
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { signToken } = require('../utils/jwt');
const { logRequest } = require('../services/logService');
const { runFriendSuggestionsJob } = require('../jobs/friendSuggestions');
const { runNotificationCleanup } = require('../jobs/notificationCleanup');
const { runSeasonResetJob } = require('../jobs/seasonReset');
const { cacheGet, cacheSet, cacheDel } = require('../services/redis');
const { logSecurityEvent, EVENTS } = require('../middleware/securityLogger');
const { snapshot, evaluateAlarms } = require('../services/metrics'); // S16-2

// Admin login brute-force koruması (S12-6): IP+e-posta başına başarısız deneme
// sayacı. Eşik aşılınca o IP+e-posta geçici kilitlenir. IP'yi de anahtara katarak
// saldırganın farklı IP'den gerçek admini global kilitlemesi önlenir.
const ADMIN_LOGIN_MAX_FAILS = 5;
const ADMIN_LOGIN_LOCK_SECONDS = 15 * 60;

function adminFailKey(ip, email) {
  return `admin-login-fail:${ip}:${String(email).toLowerCase()}`;
}

async function registerAdminFail(key, currentFails, req) {
  // Redis hatası girişi tamamen bloke etmemeli (fail-open sayaç).
  await cacheSet(key, currentFails + 1, ADMIN_LOGIN_LOCK_SECONDS).catch(() => {});
  logSecurityEvent(EVENTS.AUTH_FAILED, {
    ip: req.ip,
    requestId: req.id,
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email ve password gerekli' });

    const key = adminFailKey(req.ip, email);
    const fails = Number(await cacheGet(key).catch(() => 0)) || 0;
    if (fails >= ADMIN_LOGIN_MAX_FAILS) {
      logSecurityEvent(EVENTS.ADMIN_LOGIN_LOCKED, {
        ip: req.ip,
        requestId: req.id,
        email: String(email).toLowerCase(),
      });
      return res.status(429).json({
        error: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
      });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
      await registerAdminFail(key, fails, req);
      return res.status(401).json({ error: 'Geçersiz kimlik bilgileri' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await registerAdminFail(key, fails, req);
      return res.status(401).json({ error: 'Geçersiz kimlik bilgileri' });
    }

    // Başarılı giriş → başarısızlık sayacını sıfırla.
    await cacheDel(key).catch(() => {});
    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName } });
  } catch (err) {
    next(err);
  }
}

// ─── Restaurant Approval ──────────────────────────────────────────────────────

// Onay durumuna göre (varsayılan PENDING) restoran başvurularını sayfalı listeler.
async function getPendingRestaurants(req, res, next) {
  try {
    const { status = 'PENDING', page = '1', limit = '20' } = req.query;
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

    res.json({ profiles, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// Tek restoran başvuru detayı; vergi levhası verisini gövdede göndermez, sadece varlık bayrağı.
async function getRestaurantDetail(req, res, next) {
  try {
    const { id } = req.params;
    const profile = await prisma.restaurantProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, displayName: true, createdAt: true } },
        menuItems: { select: { id: true, mimeType: true, fileName: true, uploadedAt: true } },
      },
    });
    if (!profile) return res.status(404).json({ error: 'Bulunamadı' });
    // Don't expose taxCertificateData in list view — send a flag instead
    const { taxCertificateData, ...rest } = profile;
    res.json({ ...rest, hasTaxCertificate: !!taxCertificateData });
  } catch (err) {
    next(err);
  }
}

// Vergi levhası görselini ayrı uçtan döner (detay görünümünden kasıtlı olarak ayrıldı).
async function getTaxCertificate(req, res, next) {
  try {
    const { id } = req.params;
    const profile = await prisma.restaurantProfile.findUnique({
      where: { id },
      select: { taxCertificateData: true, taxNumber: true },
    });
    if (!profile || !profile.taxCertificateData) return res.status(404).json({ error: 'Vergi levhası bulunamadı' });
    res.json({ data: profile.taxCertificateData });
  } catch (err) {
    next(err);
  }
}

// Başvuruyu onaylar (status=APPROVED, red nedenini temizler, onaylayan admini damgalar).
async function approveRestaurant(req, res, next) {
  try {
    const { id } = req.params;
    const profile = await prisma.restaurantProfile.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date(), reviewedByAdminId: req.user.id, rejectionReason: null },
      select: PROFILE_SUMMARY,
    });
    logRequest({ req, page: 'Admin - Restoran Onayları', action: 'Restoran onayladı', details: profile.businessName }).catch(() => {});
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// Başvuruyu reddeder; red nedeni zorunlu (restorana geri bildirim için).
async function rejectRestaurant(req, res, next) {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Red nedeni zorunludur' });
    }
    const profile = await prisma.restaurantProfile.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: rejectionReason.trim(), reviewedByAdminId: req.user.id },
      select: PROFILE_SUMMARY,
    });
    logRequest({ req, page: 'Admin - Restoran Onayları', action: 'Restoran reddetti', details: `${profile.businessName} — ${rejectionReason.trim()}` }).catch(() => {});
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// ─── Platform Stats ───────────────────────────────────────────────────────────

// Admin dashboard'ı için tüm sayaçları tek seferde (paralel) toplar.
async function getPlatformStats(req, res, next) {
  try {
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

    res.json({
      totalUsers, totalRestaurants, approvedRestaurants, pendingRestaurants,
      totalReviews, totalFavorites, totalRecommendations, activePremium,
      newUsersToday, newRestaurantsToday, activeUsersToday, activeRestaurantsToday,
    });
  } catch (err) {
    next(err);
  }
}

// ─── User Management ─────────────────────────────────────────────────────────

// Kullanıcıları role + opsiyonel e-posta/isim aramasıyla sayfalı listeler.
async function getUsers(req, res, next) {
  try {
    const { search = '', page = '1', limit = '30', role = 'USER' } = req.query;
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

    res.json({ users, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
}

// Kullanıcıyı askıya alır; adminin kendini kilitlemesini engeller.
async function suspendUser(req, res, next) {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Kendi hesabınızı askıya alamazsınız' });

    const user = await prisma.user.update({
      where: { id },
      data: { isSuspended: true },
      select: { id: true, email: true, displayName: true, isSuspended: true },
    });
    logRequest({ req, page: 'Admin - Kullanıcılar', action: 'Kullanıcı askıya aldı', details: `${user.displayName} (${user.email})` }).catch(() => {});
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// Askıyı kaldırır.
async function unsuspendUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({
      where: { id },
      data: { isSuspended: false },
      select: { id: true, email: true, displayName: true, isSuspended: true },
    });
    logRequest({ req, page: 'Admin - Kullanıcılar', action: 'Kullanıcı askıyı kaldırdı', details: `${user.displayName} (${user.email})` }).catch(() => {});
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ─── Review Moderation ────────────────────────────────────────────────────────

// Moderasyon: bir yorumu siler.
async function deleteReview(req, res, next) {
  try {
    const { id } = req.params;
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return res.status(404).json({ error: 'Yorum bulunamadı' });
    logRequest({ req, page: 'Admin - Yorumlar', action: 'Yorum sildi', details: `placeId: ${review.placeId}` }).catch(() => {});
    await prisma.review.delete({ where: { id } });
    res.json({ message: 'Yorum silindi' });
  } catch (err) {
    next(err);
  }
}

async function getFlaggedReviews(req, res, next) {
  try {
    // Return latest reviews for moderation (no flag system yet — show recent)
    const reviews = await prisma.review.findMany({
      include: {
        user: { select: { id: true, displayName: true, email: true } },
        reply: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

// ─── User Reports ─────────────────────────────────────────────────────────────

// GET /api/admin/reports?status=PENDING&page=1 — kullanıcı şikayetlerini durum filtresiyle listeler.
async function getReports(req, res, next) {
  try {
    const { status = 'PENDING', page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      prisma.userReport.findMany({
        where: status === 'ALL' ? {} : { status },
        include: {
          reporter: { select: { id: true, displayName: true, email: true } },
          reported: { select: { id: true, displayName: true, email: true, isSuspended: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.userReport.count({ where: status === 'ALL' ? {} : { status } }),
    ]);

    res.json({ reports, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/reports/:id  { action: 'suspend' | 'dismiss' | 'warn', actionNote? }
async function handleReport(req, res, next) {
  try {
    const { id } = req.params;
    const { action, actionNote } = req.body;

    if (!['suspend', 'dismiss', 'warn'].includes(action)) {
      return res.status(400).json({ error: 'Geçersiz işlem. suspend | dismiss | warn olmalı.' });
    }

    const report = await prisma.userReport.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true } },
        reported: { select: { id: true, displayName: true } },
      },
    });
    if (!report) return res.status(404).json({ error: 'Şikayet bulunamadı.' });

    let actionTaken = actionNote?.trim() || null;
    let notifTitle = 'Şikayetiniz İncelendi';
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

    // Şikayet edene bildirim gönder
    const { createNotification } = require('../services/notificationService');
    createNotification(report.reporterId, 'REPORT_RESOLVED', notifTitle, notifBody, { reportId: id, action }).catch(() => {});

    logRequest({ req, page: 'Admin - Şikayetler', action: 'Şikayet işledi', details: `${action} — ${report.reported.displayName}` }).catch(() => {});
    res.json({ message: 'Şikayet işlemi tamamlandı.' });
  } catch (err) {
    next(err);
  }
}

// ─── Seed Admin ───────────────────────────────────────────────────────────────
// One-time endpoint: POST /api/admin/seed (only works if no admin exists)
async function seedAdmin(req, res, next) {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) return res.status(400).json({ error: 'Tüm alanlar gerekli' });

    const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (existing) return res.status(409).json({ error: 'Admin hesabı zaten mevcut' });

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.create({
      data: { email: email.toLowerCase(), displayName, passwordHash, authProvider: 'email', role: 'ADMIN' },
      select: { id: true, email: true, displayName: true, role: true },
    });
    res.status(201).json(admin);
  } catch (err) {
    next(err);
  }
}

// ─── Job tetikleme ────────────────────────────────────────────────────────────
// POST /api/admin/jobs/friend-suggestions/run — gece job'ını manuel çalıştırır
async function triggerFriendSuggestions(req, res, next) {
  try {
    const result = await runFriendSuggestionsJob();
    logRequest({ req, page: 'Admin Paneli', action: 'Arkadaş önerisi job tetikledi', details: `stored=${result.stored}` }).catch(() => {});
    if (result.error) return res.status(500).json({ error: 'Job çalışırken hata oluştu', detail: result.error });
    res.json({ message: 'Arkadaş önerileri yeniden hesaplandı.', ...result });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/jobs/season-reset/run — sezon sıfırlamayı manuel tetikler (force).
// S18-4: süre kontrolünü atlayarak (force) sıfırlamayı çalıştırır; test/operasyon için.
async function triggerSeasonReset(req, res, next) {
  try {
    const result = await runSeasonResetJob({ force: true });
    logRequest({ req, page: 'Admin Paneli', action: 'Sezon sıfırlama job tetikledi', details: `action=${result.action}` }).catch(() => {});
    if (result.error) return res.status(500).json({ error: 'Job çalışırken hata oluştu', detail: result.error });
    res.json({ message: 'Sezon sıfırlama çalıştırıldı.', ...result });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/jobs/notification-cleanup/run
async function triggerNotificationCleanup(req, res, next) {
  try {
    const deleted = await runNotificationCleanup();
    logRequest({ req, page: 'Admin Paneli', action: 'Bildirim temizlik job tetikledi', details: `deleted=${deleted}` }).catch(() => {});
    res.json({ message: 'Bildirim temizliği tamamlandı.', deleted });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/metrics — S16-2 gözlemlenebilirlik anlık görüntüsü.
// İstek p50/p95/p99 + status dağılımı + Redis isabet + event-loop lag + dış-API
// harcaması + (canlıda) DB aktif bağlantı sayısı. Yalnızca admin.
async function getMetrics(req, res, next) {
  try {
    const snap = snapshot();
    // DB havuz göstergesi — admin endpoint'inde anlık sorgu (istek başına değil).
    let dbActiveConnections = null;
    try {
      const rows = await prisma.$queryRaw`SELECT count(*)::int AS active FROM pg_stat_activity WHERE datname = current_database()`;
      dbActiveConnections = Array.isArray(rows) && rows[0] ? Number(rows[0].active) : null;
    } catch {
      dbActiveConnections = null; // pg_stat_activity erişilemezse sessiz geç
    }
    res.json({ ...snap, db: { activeConnections: dbActiveConnections }, alarms: evaluateAlarms(snap) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  adminLogin, getPendingRestaurants, getRestaurantDetail, getTaxCertificate,
  approveRestaurant, rejectRestaurant, getPlatformStats,
  getUsers, suspendUser, unsuspendUser,
  deleteReview, getFlaggedReviews, seedAdmin,
  getReports, handleReport,
  triggerFriendSuggestions, triggerNotificationCleanup, triggerSeasonReset,
  getMetrics,
};
