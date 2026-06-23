const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { isRestaurantActive } = require('../utils/premiumCheck');
const { signToken } = require('../utils/jwt');
const { createNotificationsForUsers, createNotification } = require('../services/notificationService');
const { containsOffensiveContent } = require('../utils/contentFilter');
const { logRequest } = require('../services/logService');
const { computeReservationAnalytics, computeReviewAnalytics } = require('../utils/restaurantAnalytics');
const { generateWeeklyReport } = require('../services/businessReport');
const s3 = require('../services/s3');

const RESTAURANT_SELECT = {
  id: true, userId: true, businessName: true, displayName: true, ownerName: true,
  taxNumber: true, taxOffice: true, phone: true, altPhone: true, contactEmail: true,
  address: true, businessCategory: true, placeId: true, placeName: true,
  placeAddress: true, placePhotoUrl: true, status: true, rejectionReason: true,
  approvedAt: true, reservationUrl: true, announcement: true,
  announcementActive: true, openingHours: true, discountEnabled: true,
  discountPercent: true, discountMinStars: true, discountNote: true,
  discountActiveUntil: true, acceptsReservations: true, tableCount: true, createdAt: true, updatedAt: true,
};

async function registerRestaurant(req, res, next) {
  try {
    const {
      email, password, ownerName, businessName, taxNumber, taxOffice,
      phone, contactEmail, address, businessCategory,
      placeId, placeName, placeAddress, placePhotoUrl,
      taxCertificateData,
    } = req.body;

    if (!email || !password || !ownerName || !businessName || !taxNumber ||
        !taxOffice || !phone || !contactEmail || !address || !businessCategory) {
      return res.status(400).json({ error: 'Tüm zorunlu alanlar doldurulmalıdır.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Şifre 8-128 karakter arasında olmalı' });
    }
    if (!/^\d{10}$/.test(taxNumber)) {
      return res.status(400).json({ error: 'Vergi numarası 10 haneli olmalıdır.' });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingEmail) return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });

    const existingTax = await prisma.restaurantProfile.findUnique({ where: { taxNumber } });
    if (existingTax) return res.status(409).json({ error: 'Bu vergi numarası zaten kayıtlı' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        displayName: businessName,
        passwordHash,
        authProvider: 'email',
        role: 'RESTAURANT',
        restaurantProfile: {
          create: {
            businessName, ownerName, taxNumber, taxOffice,
            phone, contactEmail, address, businessCategory,
            placeId: placeId || null, placeName: placeName || null,
            placeAddress: placeAddress || null, placePhotoUrl: placePhotoUrl || null,
            taxCertificateData: taxCertificateData || null,
            status: 'PENDING',
          },
        },
      },
      include: { restaurantProfile: true },
    });

    const token = signToken(user.id);
    logRequest({ req: { ...req, user }, page: 'Restoran Kaydı', action: 'Restoran kaydı oluşturdu', details: businessName }).catch(() => {});
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName }, restaurantProfile: user.restaurantProfile });
  } catch (err) {
    next(err);
  }
}

async function getMyProfile(req, res, next) {
  try {
    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        menuItems: { orderBy: { sortOrder: 'asc' }, select: { id: true, data: true, mimeType: true, fileName: true, sortOrder: true, uploadedAt: true } },
      },
    });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function updateHours(req, res, next) {
  try {
    const { openingHours } = req.body;
    if (!openingHours || typeof openingHours !== 'object') {
      return res.status(400).json({ error: 'openingHours gerekli' });
    }
    const profile = await prisma.restaurantProfile.update({
      where: { userId: req.user.id },
      data: { openingHours },
      select: RESTAURANT_SELECT,
    });
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function uploadMenuItem(req, res, next) {
  try {
    const { data, mimeType, fileName } = req.body;
    if (!data || !mimeType) return res.status(400).json({ error: 'data ve mimeType gerekli' });

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(mimeType)) return res.status(400).json({ error: 'Desteklenmeyen dosya türü' });

    // F7 — base64 data için boyut sınırı. Global 5mb body limiti ~3.75MB dosyada 413 verir;
    // bu kontrol o eşiğin altında (3MB) net bir Türkçe hata döndürür.
    const MAX_MENU_BYTES = 3 * 1024 * 1024;
    const base64Part = typeof data === 'string' && data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
    const estimatedBytes = Math.floor((base64Part?.length || 0) * 3 / 4);
    if (estimatedBytes > MAX_MENU_BYTES) {
      return res.status(400).json({ error: 'Menü dosyası en fazla 3 MB olabilir.' });
    }

    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });

    const count = await prisma.restaurantMenu.count({ where: { restaurantId: profile.id } });
    if (count >= 10) return res.status(400).json({ error: 'En fazla 10 menü öğesi yükleyebilirsiniz' });

    const item = await prisma.restaurantMenu.create({
      data: { restaurantId: profile.id, data, mimeType, fileName: fileName || null, sortOrder: count },
      select: { id: true, data: true, mimeType: true, fileName: true, sortOrder: true, uploadedAt: true },
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

async function getMenuItemData(req, res, next) {
  try {
    const { itemId } = req.params;
    const item = await prisma.restaurantMenu.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Menü öğesi bulunamadı' });
    res.json({ data: item.data, mimeType: item.mimeType });
  } catch (err) {
    next(err);
  }
}

async function deleteMenuItem(req, res, next) {
  try {
    const { itemId } = req.params;
    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });

    const item = await prisma.restaurantMenu.findUnique({ where: { id: itemId } });
    if (!item || item.restaurantId !== profile.id) return res.status(404).json({ error: 'Bulunamadı' });

    await prisma.restaurantMenu.delete({ where: { id: itemId } });
    res.json({ message: 'Silindi' });
  } catch (err) {
    next(err);
  }
}

async function replyToReview(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'İçerik gerekli' });
    if (content.length > 500) return res.status(400).json({ error: 'Cevap 500 karakteri geçemez' });
    if (containsOffensiveContent(content)) {
      return res.status(400).json({ error: 'Cevabınız uygunsuz içerik (hakaret, argo veya küfür) içerdiği için gönderilemedi. Lütfen saygılı bir dil kullanın.' });
    }

    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile || profile.status !== 'APPROVED') return res.status(403).json({ error: 'Onaylı restoran hesabı gerekli' });

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.placeId !== profile.placeId) {
      return res.status(404).json({ error: 'Bu restorana ait yorum bulunamadı' });
    }

    const reply = await prisma.reviewReply.upsert({
      where: { reviewId },
      update: { content: content.trim() },
      create: { restaurantId: profile.id, reviewId, content: content.trim() },
    });
    logRequest({ req, page: 'Restoran Paneli', action: 'Yoruma cevap verdi', details: reviewId }).catch(() => {});
    res.json(reply);

    // Yorum sahibine bildirim gönder
    createNotification(
      review.userId,
      'REVIEW_REPLY',
      'Yorumunuza Cevap Geldi',
      `${profile.placeName || profile.businessName} yorumunuza cevap verdi`,
      { placeId: profile.placeId, restaurantName: profile.placeName || profile.businessName },
    ).catch(() => {});
  } catch (err) {
    next(err);
  }
}

async function deleteReply(req, res, next) {
  try {
    const { reviewId } = req.params;
    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });

    const reply = await prisma.reviewReply.findUnique({ where: { reviewId } });
    if (!reply || reply.restaurantId !== profile.id) return res.status(404).json({ error: 'Cevap bulunamadı' });

    await prisma.reviewReply.delete({ where: { reviewId } });
    res.json({ message: 'Silindi' });
  } catch (err) {
    next(err);
  }
}

async function updateDiscount(req, res, next) {
  try {
    const { starDiscountEnabled } = req.body;
    const profile = await prisma.restaurantProfile.update({
      where: { userId: req.user.id },
      data: { discountEnabled: !!starDiscountEnabled },
      select: RESTAURANT_SELECT,
    });
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function activateInstantDiscount(req, res, next) {
  try {
    // Premium kısıtı: anlık indirim yalnızca premium restoranlara açık.
    if (!(await isRestaurantActive(req.user.id))) {
      return res.status(403).json({
        error: 'Anlık indirim tanımlamak Premium üyelik gerektirir.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    const { durationMinutes, percent, note } = req.body;
    if (!durationMinutes || durationMinutes < 30 || durationMinutes > 1440) {
      return res.status(400).json({ error: 'Süre 30-1440 dakika arasında olmalı' });
    }
    if (!percent || percent < 1 || percent > 80) {
      return res.status(400).json({ error: 'İndirim oranı %1-%80 arasında olmalı' });
    }

    const discountActiveUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    const updated = await prisma.restaurantProfile.update({
      where: { userId: req.user.id },
      data: { discountPercent: percent, discountNote: note || null, discountActiveUntil },
      select: { ...RESTAURANT_SELECT, placeId: true, placeName: true },
    });
    res.json(updated);

    // Favori ekleyenler + koleksiyona ekleyenler için bildirim gönder
    if (updated.placeId) {
      const [favUsers, collectionItems] = await Promise.all([
        prisma.favorite.findMany({ where: { placeId: updated.placeId }, select: { userId: true } }),
        prisma.collectionItem.findMany({
          where: { placeId: updated.placeId },
          include: { collection: { select: { userId: true } } },
        }),
      ]);

      const favUserIds = favUsers.map(f => f.userId);
      const collectionUserIds = collectionItems.map(ci => ci.collection.userId);
      const allUserIds = [...new Set([...favUserIds, ...collectionUserIds])].filter(id => id !== req.user.id);

      createNotificationsForUsers(
        allUserIds,
        'INSTANT_DISCOUNT',
        '⚡ Anlık İndirim!',
        `${updated.placeName || 'Kayıtlı bir restoran'} şu an %${percent} anlık indirim sunuyor!`,
        { placeId: updated.placeId, restaurantName: updated.placeName, discountPercent: percent },
      ).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
}

async function deactivateInstantDiscount(req, res, next) {
  try {
    const updated = await prisma.restaurantProfile.update({
      where: { userId: req.user.id },
      data: { discountActiveUntil: null },
      select: RESTAURANT_SELECT,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function updateAnnouncement(req, res, next) {
  try {
    const { announcement, announcementActive } = req.body;

    // Duyuru kullanıcılara gösterilir → içerik filtresi (yorumlar/kampanya ile tutarlı).
    if (announcement && containsOffensiveContent(announcement)) {
      return res.status(400).json({ error: 'Duyuru uygunsuz içerik (hakaret, argo veya küfür) içeremez.' });
    }

    const prev = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      select: { announcementActive: true, placeId: true, placeName: true, businessName: true },
    });

    const profile = await prisma.restaurantProfile.update({
      where: { userId: req.user.id },
      data: {
        announcement: announcement ? announcement.slice(0, 500) : null,
        announcementActive: !!announcementActive,
      },
      select: RESTAURANT_SELECT,
    });
    res.json(profile);

    // Duyuru yeni aktifleştirildiyse favorileyen kullanıcılara bildirim gönder
    const isNewlyActive = announcementActive && !prev?.announcementActive;
    if (isNewlyActive && announcement && prev?.placeId) {
      prisma.favorite.findMany({
        where: { placeId: prev.placeId },
        select: { userId: true },
      }).then(favUsers => {
        const userIds = favUsers.map(f => f.userId).filter(id => id !== req.user.id);
        return createNotificationsForUsers(
          userIds,
          'FAVORITE_ANNOUNCEMENT',
          `📢 ${prev.placeName || prev.businessName}'den duyuru`,
          announcement.slice(0, 200),
          { placeId: prev.placeId, restaurantName: prev.placeName || prev.businessName },
        );
      }).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
}

async function updateInfo(req, res, next) {
  try {
    const { reservationUrl, phone, altPhone, contactEmail, address, displayName, acceptsReservations, tableCount } = req.body;
    // Premium kısıtı: rezervasyon kabulünü yalnızca premium restoranlar açabilir
    // (kapatmak her zaman serbest).
    if (acceptsReservations === true && !(await isRestaurantActive(req.user.id))) {
      return res.status(403).json({
        error: 'Rezervasyon kabul etmek Premium üyelik gerektirir.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    if (tableCount !== undefined && tableCount !== null) {
      const n = parseInt(tableCount);
      if (isNaN(n) || n < 1 || n > 500) {
        return res.status(400).json({ error: 'Masa kapasitesi 1-500 arasında olmalıdır.' });
      }
    }
    // displayName: gönderildiyse trim + 2-80 karakter; boş string → null (Google adına döner)
    let displayNameUpdate;
    if (displayName !== undefined) {
      const trimmed = String(displayName).trim();
      if (trimmed.length === 0) {
        displayNameUpdate = null;
      } else if (trimmed.length < 2 || trimmed.length > 80) {
        return res.status(400).json({ error: 'Görünen ad 2-80 karakter arasında olmalıdır.' });
      } else if (containsOffensiveContent(trimmed)) {
        return res.status(400).json({ error: 'Görünen ad uygunsuz içerik (hakaret, argo veya küfür) içeremez.' });
      } else {
        displayNameUpdate = trimmed;
      }
    }
    // altPhone: gönderildiyse trim, ≤20 karakter; boş → null
    let altPhoneUpdate;
    if (altPhone !== undefined) {
      const trimmed = String(altPhone).trim();
      if (trimmed.length === 0) {
        altPhoneUpdate = null;
      } else if (trimmed.length > 20) {
        return res.status(400).json({ error: 'Alternatif telefon en fazla 20 karakter olabilir.' });
      } else {
        altPhoneUpdate = trimmed;
      }
    }
    const profile = await prisma.restaurantProfile.update({
      where: { userId: req.user.id },
      data: {
        reservationUrl: reservationUrl || null,
        phone: phone || undefined,
        altPhone: altPhoneUpdate,
        contactEmail: contactEmail || undefined,
        address: address || undefined,
        displayName: displayNameUpdate,
        acceptsReservations: typeof acceptsReservations === 'boolean' ? acceptsReservations : undefined,
        tableCount: tableCount === null ? null : (tableCount !== undefined ? parseInt(tableCount) : undefined),
      },
      select: RESTAURANT_SELECT,
    });
    logRequest({ req, page: 'Restoran Paneli', action: 'İletişim bilgilerini güncelledi' }).catch(() => {});
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile || !profile.placeId) return res.json({ favorites: 0, reviews: 0, avgRating: null, recommendations: 0 });

    const [favorites, reviewAgg, recommendations] = await Promise.all([
      prisma.favorite.count({ where: { placeId: profile.placeId } }),
      prisma.review.aggregate({ where: { placeId: profile.placeId }, _count: true, _avg: { rating: true } }),
      prisma.recommendation.count({ where: { placeId: profile.placeId } }),
    ]);

    res.json({
      favorites,
      reviews: reviewAgg._count,
      avgRating: reviewAgg._avg.rating ? Number(reviewAgg._avg.rating).toFixed(1) : null,
      recommendations,
    });
  } catch (err) {
    next(err);
  }
}

async function getMyReviews(req, res, next) {
  try {
    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile || !profile.placeId) return res.json([]);

    const reviews = await prisma.review.findMany({
      where: { placeId: profile.placeId },
      include: {
        user: { select: { displayName: true, photoUrl: true } },
        reply: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

// ─── Analitik paneli (S5-5) ──────────────────────────────────────────────────

/**
 * GET /api/restaurant-account/analytics
 * Haftalık rezervasyon trendi, en yoğun saatler, durum dağılımı, katılım oranı,
 * ortalama puan + yorum dağılımı. Yalnızca restoranın kendi sahibi erişebilir.
 */
async function getAnalytics(req, res, next) {
  try {
    // Premium kısıtı: analitik paneli yalnızca premium restoranlara açık.
    if (!(await isRestaurantActive(req.user.id))) {
      return res.status(403).json({
        error: 'Analitik paneli Premium üyelik gerektirir.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, placeId: true },
    });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı' });

    const [reservations, reviews] = await Promise.all([
      prisma.reservation.findMany({
        where: { restaurantId: profile.id },
        select: { date: true, time: true, status: true, attended: true },
      }),
      profile.placeId
        ? prisma.review.findMany({ where: { placeId: profile.placeId }, select: { rating: true } })
        : Promise.resolve([]),
    ]);

    const reservationAnalytics = computeReservationAnalytics(reservations, new Date());
    const reviewAnalytics = computeReviewAnalytics(reviews.map((r) => r.rating));

    res.json({ reservations: reservationAnalytics, reviews: reviewAnalytics });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/restaurant-account/report
 * Haftalık analitiği + son yorumları Claude ile kısa Türkçe işletme raporuna çevirir.
 * Anthropic erişilemezse şablon özete düşer (fallback: true).
 */
async function getWeeklyReport(req, res, next) {
  try {
    // Premium kısıtı: işletme raporu yalnızca premium restoranlara açık.
    if (!(await isRestaurantActive(req.user.id))) {
      return res.status(403).json({
        error: 'İşletme raporu Premium üyelik gerektirir.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, placeId: true },
    });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı' });

    const [reservations, reviews] = await Promise.all([
      prisma.reservation.findMany({
        where: { restaurantId: profile.id },
        select: { date: true, time: true, status: true, attended: true },
      }),
      profile.placeId
        ? prisma.review.findMany({
            where: { placeId: profile.placeId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { rating: true, body: true },
          })
        : Promise.resolve([]),
    ]);

    const analytics = {
      reservations: computeReservationAnalytics(reservations, new Date()),
      reviews: computeReviewAnalytics(reviews.map((r) => r.rating)),
    };

    const { report, model, fallback } = await generateWeeklyReport(analytics, reviews);

    res.json({ report, model, fallback, generatedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

// ─── Anlık kampanya gönderimi (S5-3) ─────────────────────────────────────────

const CAMPAIGN_MIN_LENGTH = 5;
const CAMPAIGN_MAX_LENGTH = 200;
const CAMPAIGN_AUDIENCES = ['favorites', 'reservations', 'all'];

/** Türkiye gününün başlangıcı (UTC). lastCampaignAt bundan büyükse "bugün gönderilmiş". */
function getTurkeyDayStartUtc() {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  tr.setUTCHours(0, 0, 0, 0);
  return new Date(tr.getTime() - 3 * 60 * 60 * 1000);
}

/**
 * POST /api/restaurant-account/campaign
 * body: { message, audience? ('favorites'|'reservations'|'all') }
 * Restoranı favorileyen ve/veya geçmişte rezervasyon yapan kullanıcılara
 * INSTANT_DISCOUNT bildirimi gönderir. Günde en fazla 1 kampanya (spam önleme).
 */
async function sendCampaign(req, res, next) {
  try {
    // Premium kısıtı: anlık kampanya yalnızca premium restoranlara açık.
    if (!(await isRestaurantActive(req.user.id))) {
      return res.status(403).json({
        error: 'Kampanya göndermek Premium üyelik gerektirir.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    const { message, audience = 'all' } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim().length < CAMPAIGN_MIN_LENGTH) {
      return res.status(400).json({ error: `Mesaj en az ${CAMPAIGN_MIN_LENGTH} karakter olmalı` });
    }
    const trimmed = message.trim().slice(0, CAMPAIGN_MAX_LENGTH);
    if (containsOffensiveContent(trimmed)) {
      return res.status(400).json({ error: 'Mesaj uygunsuz içerik içeriyor.' });
    }
    if (!CAMPAIGN_AUDIENCES.includes(audience)) {
      return res.status(400).json({ error: `audience şunlardan biri olmalı: ${CAMPAIGN_AUDIENCES.join(', ')}` });
    }

    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, placeId: true, placeName: true, businessName: true, status: true, lastCampaignAt: true },
    });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı' });
    if (profile.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Yalnızca onaylanmış restoranlar kampanya gönderebilir' });
    }
    if (!profile.placeId) {
      return res.status(400).json({ error: 'Kampanya için restoranın bir Google Places kaydına bağlı olması gerekir' });
    }

    // Rate limit — günde 1 kampanya
    if (profile.lastCampaignAt && profile.lastCampaignAt >= getTurkeyDayStartUtc()) {
      return res.status(429).json({
        error: 'CAMPAIGN_LIMIT_EXCEEDED',
        message: 'Bugün zaten bir kampanya gönderdiniz. Yarın tekrar deneyebilirsiniz.',
      });
    }

    // Hedef kitle
    const tasks = [];
    if (audience === 'favorites' || audience === 'all') {
      tasks.push(prisma.favorite.findMany({ where: { placeId: profile.placeId }, select: { userId: true } }));
    } else {
      tasks.push(Promise.resolve([]));
    }
    if (audience === 'reservations' || audience === 'all') {
      tasks.push(prisma.reservation.findMany({
        where: { restaurantId: profile.id },
        distinct: ['userId'],
        select: { userId: true },
      }));
    } else {
      tasks.push(Promise.resolve([]));
    }
    const [favs, resv] = await Promise.all(tasks);
    const userIds = [...new Set([...favs, ...resv].map((x) => x.userId))].filter((id) => id !== req.user.id);

    const name = profile.placeName || profile.businessName;
    if (userIds.length > 0) {
      await createNotificationsForUsers(
        userIds,
        'INSTANT_DISCOUNT',
        `⚡ ${name} kampanyası`,
        trimmed,
        { placeId: profile.placeId, restaurantName: name, campaign: true },
      );
    }

    await prisma.restaurantProfile.update({
      where: { userId: req.user.id },
      data: { lastCampaignAt: new Date() },
    });

    logRequest({ req, page: 'Restoran Paneli', action: 'Kampanya gönderdi', details: `${userIds.length} kişi` }).catch(() => {});
    res.status(201).json({ sent: userIds.length, audience });
  } catch (err) {
    next(err);
  }
}

// S10-2 — restoran/ürün fotoğrafı için S3 presigned yükleme URL'i üretir.
// İstemci dönen uploadUrl'e dosyayı PUT eder, sonra publicUrl'i galeriye kaydeder (S10-3).
async function createPhotoUploadUrl(req, res, next) {
  try {
    if (!s3.isS3Configured()) {
      return res.status(503).json({ error: 'Fotoğraf yükleme yakında aktifleşecek (depolama yapılandırılmadı).' });
    }
    const { kind, contentType } = req.body;
    // B4 — galeri CRUD ile aynı sözleşme: kind büyük harf (RESTAURANT/PRODUCT).
    // Eski istemciler için küçük harf de toleranslı kabul edilir (case-insensitive).
    const kindUpper = String(kind || '').toUpperCase();
    if (!PHOTO_KINDS.includes(kindUpper)) {
      return res.status(400).json({ error: "kind 'RESTAURANT' veya 'PRODUCT' olmalıdır." });
    }
    // Premium kısıtı: ürün (PRODUCT) fotoğrafı yüklemek premium gerektirir; mekan
    // (RESTAURANT) fotoğrafı serbest.
    if (kindUpper === 'PRODUCT' && !(await isRestaurantActive(req.user.id))) {
      return res.status(403).json({
        error: 'Ürün fotoğrafı yüklemek Premium üyelik gerektirir.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    if (!s3.ALLOWED_CONTENT_TYPES[contentType]) {
      return res.status(400).json({ error: 'Desteklenmeyen dosya türü. Yalnızca JPEG/PNG/WebP.' });
    }
    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı.' });

    // S3 key segmenti küçük harf kalır (createUploadUrl beklentisi).
    const result = await s3.createUploadUrl(profile.id, kindUpper.toLowerCase(), contentType);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Foto galerileri (S10-3) ─────────────────────────────────────────────────
// İki ayrı galeri: RESTAURANT (mekan) ve PRODUCT (ürün). Görseller S3'te (S10-2),
// burada yalnızca public URL + sıra bilgisi tutulur. Galeri başına en fazla 8 foto.
const PHOTO_KINDS = ['RESTAURANT', 'PRODUCT'];
const MAX_PHOTOS_PER_GALLERY = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB — yüklenen foto üst sınırı (F3)

const PHOTO_SELECT = { id: true, kind: true, url: true, sortOrder: true, createdAt: true };

/**
 * POST /api/restaurant-account/photos
 * body: { kind ('RESTAURANT'|'PRODUCT'), url } — S10-2'den gelen nihai public URL'i
 * ilgili galeriye ekler. Galeri başına en fazla 8 foto (aşımda 409).
 */
async function addPhoto(req, res, next) {
  try {
    const { kind, url } = req.body || {};
    if (!PHOTO_KINDS.includes(kind)) {
      return res.status(400).json({ error: "kind 'RESTAURANT' veya 'PRODUCT' olmalıdır." });
    }
    // Premium kısıtı: ürün (PRODUCT) fotoğrafı yalnızca premium restoranlarda.
    if (kind === 'PRODUCT' && !(await isRestaurantActive(req.user.id))) {
      return res.status(403).json({
        error: 'Ürün fotoğrafı yüklemek Premium üyelik gerektirir.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
      return res.status(400).json({ error: 'Geçerli bir url gerekli.' });
    }
    const trimmedUrl = url.trim();

    // F2 — yalnızca kendi S3 bucket'ımızdan gelen URL kabul edilir (harici/uygunsuz görsel enjeksiyonunu önler).
    const objectKey = s3.isS3Configured() ? s3.keyFromUrl(trimmedUrl) : null;
    if (s3.isS3Configured() && !objectKey) {
      return res.status(400).json({ error: 'Fotoğraf yalnızca uygulama deposundan eklenebilir.' });
    }

    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı.' });

    const count = await prisma.restaurantPhoto.count({
      where: { restaurantProfileId: profile.id, kind },
    });
    if (count >= MAX_PHOTOS_PER_GALLERY) {
      return res.status(409).json({ error: `Bir galeride en fazla ${MAX_PHOTOS_PER_GALLERY} fotoğraf olabilir.` });
    }

    // F3 — yüklenen nesne ≤5MB; aşımda nesneyi sil + reddet (HEAD başarısızsa engelleme).
    if (objectKey) {
      try {
        const size = await s3.getObjectSize(objectKey);
        if (size != null && size > MAX_PHOTO_BYTES) {
          s3.deleteObject(objectKey).catch(() => {});
          return res.status(400).json({ error: 'Fotoğraf en fazla 5 MB olabilir.' });
        }
      } catch { /* HEAD erişilemezse boyut kontrolünü atla */ }
    }

    const photo = await prisma.restaurantPhoto.create({
      data: { restaurantProfileId: profile.id, kind, url: trimmedUrl, sortOrder: count },
      select: PHOTO_SELECT,
    });
    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/restaurant-account/photos?kind=
 * Kendi galerisini döner (sortOrder'a göre). kind verilmezse tüm fotolar.
 */
async function listPhotos(req, res, next) {
  try {
    const { kind } = req.query;
    if (kind !== undefined && !PHOTO_KINDS.includes(kind)) {
      return res.status(400).json({ error: "kind 'RESTAURANT' veya 'PRODUCT' olmalıdır." });
    }
    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı.' });

    const photos = await prisma.restaurantPhoto.findMany({
      where: { restaurantProfileId: profile.id, ...(kind ? { kind } : {}) },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: PHOTO_SELECT,
    });
    res.json(photos);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/restaurant-account/photos/:id
 * Sahiplik kontrolüyle siler. S3 nesnesini de best-effort temizler.
 */
async function deletePhoto(req, res, next) {
  try {
    const { id } = req.params;
    const profile = await prisma.restaurantProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı.' });

    const photo = await prisma.restaurantPhoto.findUnique({ where: { id } });
    if (!photo || photo.restaurantProfileId !== profile.id) {
      return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
    }

    await prisma.restaurantPhoto.delete({ where: { id } });

    // S3 nesnesini best-effort sil (URL bu bucket'a aitse)
    const key = s3.keyFromUrl(photo.url);
    if (key && s3.isS3Configured()) {
      s3.deleteObject(key).catch(() => {});
    }

    res.json({ message: 'Silindi' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerRestaurant, getMyProfile, updateHours,
  uploadMenuItem, getMenuItemData, deleteMenuItem,
  replyToReview, deleteReply,
  updateDiscount, activateInstantDiscount, deactivateInstantDiscount,
  updateAnnouncement, updateInfo, getStats, getMyReviews,
  sendCampaign, getAnalytics, getWeeklyReport,
  createPhotoUploadUrl, addPhoto, listPhotos, deletePhoto,
};
