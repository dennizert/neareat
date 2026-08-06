'use strict';

/**
 * Restoran hesabı iş mantığı (S22-1).
 *
 * Bu dosya, `restaurantAccountController` içindeki iş kuralları + veri erişiminin taşındığı
 * yerdir. Controller yalnızca HTTP çevirisi yapar (girdi okuma, servis çağrısı, statü + JSON).
 *
 * KONVANSİYON (sonraki controller refactor'leri bunu izler):
 *  - Fonksiyonlar `req`/`res` ALMAZ. Girdi düz değer olarak gelir (userId, input nesnesi).
 *    Böylece bir cron job ya da başka bir controller aynı mantığı kopyalamadan çağırabilir
 *    ve birim testi Express olmadan yazılabilir.
 *  - BEKLENEN iş hataları `HttpError(status, body)` ile bildirilir; gövde birebir korunur
 *    (`code` alanları mobil tarafından okunuyor). Beklenmeyen hatalar olduğu gibi yukarı
 *    fırlar ve merkezi errorHandler'a düşer.
 *  - `logRequest` controller'da KALIR: o, isteğin kendisini loglar — iş kuralı değil.
 *  - Fire-and-forget bildirimler burada başlatılır ama `await` EDİLMEZ. Controller'da
 *    yanıt `res.json()` ile hemen yazıldığı için gözlemlenebilir davranış aynıdır; tek
 *    fark bildirimin mikro-görev sırasında bir adım öne alınmasıdır.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { HttpError } = require('../utils/httpError');
const { isRestaurantActive } = require('../utils/premiumCheck');
const { signToken } = require('../utils/jwt');
const { createNotificationsForUsers, createNotification } = require('./notificationService');
const { containsOffensiveContent } = require('../utils/contentFilter');
const { computeReservationAnalytics, computeReviewAnalytics } = require('../utils/restaurantAnalytics');
const { dailyOccupancySlots } = require('../utils/occupancy');
const { generateWeeklyReport } = require('./businessReport');
const s3 = require('./s3');

const RESTAURANT_SELECT = {
  id: true, userId: true, businessName: true, displayName: true, ownerName: true,
  taxNumber: true, taxOffice: true, phone: true, altPhone: true, contactEmail: true,
  address: true, businessCategory: true, placeId: true, placeName: true,
  placeAddress: true, placePhotoUrl: true, status: true, rejectionReason: true,
  approvedAt: true, reservationUrl: true, announcement: true,
  announcementActive: true, openingHours: true, discountEnabled: true,
  discountPercent: true, discountMinStars: true, discountNote: true,
  discountActiveUntil: true, acceptsReservations: true, tableCount: true, seatCapacity: true, createdAt: true, updatedAt: true,
};

// ─── Foto galerileri (S10-3) ─────────────────────────────────────────────────
const PHOTO_KINDS = ['RESTAURANT', 'PRODUCT'];
const MAX_PHOTOS_PER_GALLERY = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB — yüklenen foto üst sınırı (F3)
const PHOTO_SELECT = { id: true, kind: true, url: true, sortOrder: true, createdAt: true };

// ─── Kampanya (S5-3) ─────────────────────────────────────────────────────────
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
 * S19-1 abonelik kapısı. Aktif/trial aboneliği olmayan restoran korumalı işlem yapamaz.
 * Gövde birebir korunur — mobil `premiumGate` `code` alanına bakıyor.
 */
async function assertActiveSubscription(userId, message) {
  if (!(await isRestaurantActive(userId))) {
    throw new HttpError(403, { error: message, code: 'SUBSCRIPTION_REQUIRED' });
  }
}

/** Sahibin profilini getirir; yoksa verilen mesajla 404. */
async function requireProfile(userId, select, notFoundMessage = 'Restoran profili bulunamadı') {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { userId },
    ...(select ? { select } : {}),
  });
  if (!profile) throw new HttpError(404, { error: notFoundMessage });
  return profile;
}

// ─── Kayıt & profil ──────────────────────────────────────────────────────────

async function registerRestaurant(input) {
  const {
    email, password, ownerName, businessName, taxNumber, taxOffice,
    phone, contactEmail, address, businessCategory,
    placeId, placeName, placeAddress, placePhotoUrl,
    taxCertificateData,
  } = input;

  if (!email || !password || !ownerName || !businessName || !taxNumber ||
      !taxOffice || !phone || !contactEmail || !address || !businessCategory) {
    throw new HttpError(400, { error: 'Tüm zorunlu alanlar doldurulmalıdır.' });
  }
  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, { error: 'Şifre 8-128 karakter arasında olmalı' });
  }
  if (!/^\d{10}$/.test(taxNumber)) {
    throw new HttpError(400, { error: 'Vergi numarası 10 haneli olmalıdır.' });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingEmail) throw new HttpError(409, { error: 'Bu e-posta zaten kayıtlı' });

  const existingTax = await prisma.restaurantProfile.findUnique({ where: { taxNumber } });
  if (existingTax) throw new HttpError(409, { error: 'Bu vergi numarası zaten kayıtlı' });

  const passwordHash = await bcrypt.hash(password, 10);
  // İç içe create: kullanıcı ve profil tek işlemde oluşur (Prisma bunu atomik yürütür).
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
  return {
    user,
    response: {
      token,
      user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName },
      restaurantProfile: user.restaurantProfile,
    },
  };
}

async function getMyProfile(userId) {
  const profile = await prisma.restaurantProfile.findUnique({
    where: { userId },
    include: {
      menuItems: { orderBy: { sortOrder: 'asc' }, select: { id: true, data: true, mimeType: true, fileName: true, sortOrder: true, uploadedAt: true } },
    },
  });
  if (!profile) throw new HttpError(404, { error: 'Restoran profili bulunamadı' });
  return profile;
}

async function updateHours(userId, { openingHours }) {
  if (!openingHours || typeof openingHours !== 'object') {
    throw new HttpError(400, { error: 'openingHours gerekli' });
  }
  return prisma.restaurantProfile.update({
    where: { userId },
    data: { openingHours },
    select: RESTAURANT_SELECT,
  });
}

// ─── Menü ────────────────────────────────────────────────────────────────────

async function uploadMenuItem(userId, { data, mimeType, fileName }) {
  if (!data || !mimeType) throw new HttpError(400, { error: 'data ve mimeType gerekli' });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(mimeType)) throw new HttpError(400, { error: 'Desteklenmeyen dosya türü' });

  // F7 — base64 data için boyut sınırı. Global 5mb body limiti ~3.75MB dosyada 413 verir;
  // bu kontrol o eşiğin altında (3MB) net bir Türkçe hata döndürür.
  const MAX_MENU_BYTES = 3 * 1024 * 1024;
  const base64Part = typeof data === 'string' && data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
  const estimatedBytes = Math.floor((base64Part?.length || 0) * 3 / 4);
  if (estimatedBytes > MAX_MENU_BYTES) {
    throw new HttpError(400, { error: 'Menü dosyası en fazla 3 MB olabilir.' });
  }

  const profile = await requireProfile(userId, undefined, 'Profil bulunamadı');

  const count = await prisma.restaurantMenu.count({ where: { restaurantId: profile.id } });
  if (count >= 10) throw new HttpError(400, { error: 'En fazla 10 menü öğesi yükleyebilirsiniz' });

  return prisma.restaurantMenu.create({
    data: { restaurantId: profile.id, data, mimeType, fileName: fileName || null, sortOrder: count },
    select: { id: true, data: true, mimeType: true, fileName: true, sortOrder: true, uploadedAt: true },
  });
}

async function getMenuItemData(itemId) {
  const item = await prisma.restaurantMenu.findUnique({ where: { id: itemId } });
  if (!item) throw new HttpError(404, { error: 'Menü öğesi bulunamadı' });
  return { data: item.data, mimeType: item.mimeType };
}

async function deleteMenuItem(userId, itemId) {
  const profile = await requireProfile(userId, undefined, 'Profil bulunamadı');

  const item = await prisma.restaurantMenu.findUnique({ where: { id: itemId } });
  if (!item || item.restaurantId !== profile.id) throw new HttpError(404, { error: 'Bulunamadı' });

  await prisma.restaurantMenu.delete({ where: { id: itemId } });
  return { message: 'Silindi' };
}

// ─── Yorum cevapları ─────────────────────────────────────────────────────────

async function replyToReview(userId, reviewId, { content }) {
  if (!content || !content.trim()) throw new HttpError(400, { error: 'İçerik gerekli' });
  if (content.length > 500) throw new HttpError(400, { error: 'Cevap 500 karakteri geçemez' });
  if (containsOffensiveContent(content)) {
    throw new HttpError(400, { error: 'Cevabınız uygunsuz içerik (hakaret, argo veya küfür) içerdiği için gönderilemedi. Lütfen saygılı bir dil kullanın.' });
  }

  const profile = await prisma.restaurantProfile.findUnique({ where: { userId } });
  if (!profile || profile.status !== 'APPROVED') {
    throw new HttpError(403, { error: 'Onaylı restoran hesabı gerekli' });
  }

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.placeId !== profile.placeId) {
    throw new HttpError(404, { error: 'Bu restorana ait yorum bulunamadı' });
  }

  const reply = await prisma.reviewReply.upsert({
    where: { reviewId },
    update: { content: content.trim() },
    create: { restaurantId: profile.id, reviewId, content: content.trim() },
  });

  // Yorum sahibine bildirim (fire-and-forget — yanıtı bekletmez).
  createNotification(
    review.userId,
    'REVIEW_REPLY',
    'Yorumunuza Cevap Geldi',
    `${profile.placeName || profile.businessName} yorumunuza cevap verdi`,
    { placeId: profile.placeId, restaurantName: profile.placeName || profile.businessName },
  ).catch(() => {});

  return reply;
}

async function deleteReply(userId, reviewId) {
  const profile = await requireProfile(userId, undefined, 'Profil bulunamadı');

  const reply = await prisma.reviewReply.findUnique({ where: { reviewId } });
  if (!reply || reply.restaurantId !== profile.id) throw new HttpError(404, { error: 'Cevap bulunamadı' });

  await prisma.reviewReply.delete({ where: { reviewId } });
  return { message: 'Silindi' };
}

// ─── İndirim ─────────────────────────────────────────────────────────────────

async function updateDiscount(userId, { starDiscountEnabled }) {
  return prisma.restaurantProfile.update({
    where: { userId },
    data: { discountEnabled: !!starDiscountEnabled },
    select: RESTAURANT_SELECT,
  });
}

async function activateInstantDiscount(userId, { durationMinutes, percent, note }) {
  await assertActiveSubscription(userId, 'Anlık indirim tanımlamak Premium üyelik gerektirir.');

  if (!durationMinutes || durationMinutes < 30 || durationMinutes > 1440) {
    throw new HttpError(400, { error: 'Süre 30-1440 dakika arasında olmalı' });
  }
  if (!percent || percent < 1 || percent > 80) {
    throw new HttpError(400, { error: 'İndirim oranı %1-%80 arasında olmalı' });
  }

  const discountActiveUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  const updated = await prisma.restaurantProfile.update({
    where: { userId },
    data: { discountPercent: percent, discountNote: note || null, discountActiveUntil },
    select: { ...RESTAURANT_SELECT, placeId: true, placeName: true },
  });

  // Favori ekleyenler + koleksiyona ekleyenler için bildirim (fire-and-forget).
  if (updated.placeId) {
    Promise.all([
      prisma.favorite.findMany({ where: { placeId: updated.placeId }, select: { userId: true } }),
      prisma.collectionItem.findMany({
        where: { placeId: updated.placeId },
        include: { collection: { select: { userId: true } } },
      }),
    ]).then(([favUsers, collectionItems]) => {
      const favUserIds = favUsers.map(f => f.userId);
      const collectionUserIds = collectionItems.map(ci => ci.collection.userId);
      const allUserIds = [...new Set([...favUserIds, ...collectionUserIds])].filter(id => id !== userId);

      return createNotificationsForUsers(
        allUserIds,
        'INSTANT_DISCOUNT',
        '⚡ Anlık İndirim!',
        `${updated.placeName || 'Kayıtlı bir restoran'} şu an %${percent} anlık indirim sunuyor!`,
        { placeId: updated.placeId, restaurantName: updated.placeName, discountPercent: percent },
      );
    }).catch(() => {});
  }

  return updated;
}

async function deactivateInstantDiscount(userId) {
  return prisma.restaurantProfile.update({
    where: { userId },
    data: { discountActiveUntil: null },
    select: RESTAURANT_SELECT,
  });
}

// ─── Duyuru ──────────────────────────────────────────────────────────────────

async function updateAnnouncement(userId, { announcement, announcementActive }) {
  // Duyuru kullanıcılara gösterilir → içerik filtresi (yorumlar/kampanya ile tutarlı).
  if (announcement && containsOffensiveContent(announcement)) {
    throw new HttpError(400, { error: 'Duyuru uygunsuz içerik (hakaret, argo veya küfür) içeremez.' });
  }

  const prev = await prisma.restaurantProfile.findUnique({
    where: { userId },
    select: { announcementActive: true, placeId: true, placeName: true, businessName: true },
  });

  const profile = await prisma.restaurantProfile.update({
    where: { userId },
    data: {
      announcement: announcement ? announcement.slice(0, 500) : null,
      announcementActive: !!announcementActive,
    },
    select: RESTAURANT_SELECT,
  });

  // Duyuru YENİ aktifleştirildiyse favorileyenlere bildirim (fire-and-forget).
  const isNewlyActive = announcementActive && !prev?.announcementActive;
  if (isNewlyActive && announcement && prev?.placeId) {
    prisma.favorite.findMany({
      where: { placeId: prev.placeId },
      select: { userId: true },
    }).then(favUsers => {
      const userIds = favUsers.map(f => f.userId).filter(id => id !== userId);
      return createNotificationsForUsers(
        userIds,
        'FAVORITE_ANNOUNCEMENT',
        `📢 ${prev.placeName || prev.businessName}'den duyuru`,
        announcement.slice(0, 200),
        { placeId: prev.placeId, restaurantName: prev.placeName || prev.businessName },
      );
    }).catch(() => {});
  }

  return profile;
}

// ─── İletişim / kapasite bilgileri ───────────────────────────────────────────

async function updateInfo(userId, input) {
  const { reservationUrl, phone, altPhone, contactEmail, address, displayName, acceptsReservations, tableCount, seatCapacity } = input;

  // Rezervasyon kabulünü yalnızca aktif abonelikli restoran AÇABİLİR (kapatmak serbest).
  if (acceptsReservations === true) {
    await assertActiveSubscription(userId, 'Rezervasyon kabul etmek Premium üyelik gerektirir.');
  }
  if (tableCount !== undefined && tableCount !== null) {
    const n = parseInt(tableCount);
    if (isNaN(n) || n < 1 || n > 500) {
      throw new HttpError(400, { error: 'Masa kapasitesi 1-500 arasında olmalıdır.' });
    }
  }
  // S19-2: koltuk kapasitesi (doluluk hesabı için). 1-5000 arası.
  if (seatCapacity !== undefined && seatCapacity !== null) {
    const n = parseInt(seatCapacity);
    if (isNaN(n) || n < 1 || n > 5000) {
      throw new HttpError(400, { error: 'Koltuk kapasitesi 1-5000 arasında olmalıdır.' });
    }
  }
  // displayName: gönderildiyse trim + 2-80 karakter; boş string → null (Google adına döner)
  let displayNameUpdate;
  if (displayName !== undefined) {
    const trimmed = String(displayName).trim();
    if (trimmed.length === 0) {
      displayNameUpdate = null;
    } else if (trimmed.length < 2 || trimmed.length > 80) {
      throw new HttpError(400, { error: 'Görünen ad 2-80 karakter arasında olmalıdır.' });
    } else if (containsOffensiveContent(trimmed)) {
      throw new HttpError(400, { error: 'Görünen ad uygunsuz içerik (hakaret, argo veya küfür) içeremez.' });
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
      throw new HttpError(400, { error: 'Alternatif telefon en fazla 20 karakter olabilir.' });
    } else {
      altPhoneUpdate = trimmed;
    }
  }

  return prisma.restaurantProfile.update({
    where: { userId },
    data: {
      reservationUrl: reservationUrl || null,
      phone: phone || undefined,
      altPhone: altPhoneUpdate,
      contactEmail: contactEmail || undefined,
      address: address || undefined,
      displayName: displayNameUpdate,
      acceptsReservations: typeof acceptsReservations === 'boolean' ? acceptsReservations : undefined,
      tableCount: tableCount === null ? null : (tableCount !== undefined ? parseInt(tableCount) : undefined),
      seatCapacity: seatCapacity === null ? null : (seatCapacity !== undefined ? parseInt(seatCapacity) : undefined),
    },
    select: RESTAURANT_SELECT,
  });
}

// ─── İstatistik & yorumlar ───────────────────────────────────────────────────

async function getStats(userId) {
  const profile = await prisma.restaurantProfile.findUnique({ where: { userId } });
  if (!profile || !profile.placeId) return { favorites: 0, reviews: 0, avgRating: null, recommendations: 0 };

  const [favorites, reviewAgg, recommendations] = await Promise.all([
    prisma.favorite.count({ where: { placeId: profile.placeId } }),
    prisma.review.aggregate({ where: { placeId: profile.placeId }, _count: true, _avg: { rating: true } }),
    prisma.recommendation.count({ where: { placeId: profile.placeId } }),
  ]);

  return {
    favorites,
    reviews: reviewAgg._count,
    avgRating: reviewAgg._avg.rating ? Number(reviewAgg._avg.rating).toFixed(1) : null,
    recommendations,
  };
}

async function getMyReviews(userId) {
  const profile = await prisma.restaurantProfile.findUnique({ where: { userId } });
  if (!profile || !profile.placeId) return [];

  return prisma.review.findMany({
    where: { placeId: profile.placeId },
    include: {
      user: { select: { displayName: true, photoUrl: true } },
      reply: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Analitik / doluluk / rapor ──────────────────────────────────────────────

async function getAnalytics(userId) {
  await assertActiveSubscription(userId, 'Analitik paneli Premium üyelik gerektirir.');

  const profile = await requireProfile(userId, { id: true, placeId: true });

  const [reservations, reviews] = await Promise.all([
    prisma.reservation.findMany({
      where: { restaurantId: profile.id },
      select: { date: true, time: true, status: true, attended: true },
    }),
    profile.placeId
      ? prisma.review.findMany({ where: { placeId: profile.placeId }, select: { rating: true } })
      : Promise.resolve([]),
  ]);

  return {
    reservations: computeReservationAnalytics(reservations, new Date()),
    reviews: computeReviewAnalytics(reviews.map((r) => r.rating)),
  };
}

async function getOccupancy(userId, date) {
  await assertActiveSubscription(userId, 'Bu özellik aktif abonelik gerektirir.');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, { error: 'Geçerli bir tarih (YYYY-MM-DD) gerekli.' });
  }
  const profile = await requireProfile(userId, { id: true, seatCapacity: true });

  const reservations = await prisma.reservation.findMany({
    where: { restaurantId: profile.id, date, status: 'CONFIRMED' },
    select: { time: true, guestCount: true, reservedSeats: true },
  });

  return {
    date,
    seatCapacity: profile.seatCapacity ?? null,
    slots: dailyOccupancySlots(reservations, profile.seatCapacity),
  };
}

async function getWeeklyReport(userId) {
  await assertActiveSubscription(userId, 'İşletme raporu Premium üyelik gerektirir.');

  const profile = await requireProfile(userId, { id: true, placeId: true });

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
  return { report, model, fallback, generatedAt: new Date().toISOString() };
}

// ─── Kampanya ────────────────────────────────────────────────────────────────

async function sendCampaign(userId, { message, audience = 'all' } = {}) {
  await assertActiveSubscription(userId, 'Kampanya göndermek Premium üyelik gerektirir.');

  if (!message || typeof message !== 'string' || message.trim().length < CAMPAIGN_MIN_LENGTH) {
    throw new HttpError(400, { error: `Mesaj en az ${CAMPAIGN_MIN_LENGTH} karakter olmalı` });
  }
  const trimmed = message.trim().slice(0, CAMPAIGN_MAX_LENGTH);
  if (containsOffensiveContent(trimmed)) {
    throw new HttpError(400, { error: 'Mesaj uygunsuz içerik içeriyor.' });
  }
  if (!CAMPAIGN_AUDIENCES.includes(audience)) {
    throw new HttpError(400, { error: `audience şunlardan biri olmalı: ${CAMPAIGN_AUDIENCES.join(', ')}` });
  }

  const profile = await requireProfile(userId, {
    id: true, placeId: true, placeName: true, businessName: true, status: true, lastCampaignAt: true,
  });
  if (profile.status !== 'APPROVED') {
    throw new HttpError(403, { error: 'Yalnızca onaylanmış restoranlar kampanya gönderebilir' });
  }
  if (!profile.placeId) {
    throw new HttpError(400, { error: 'Kampanya için restoranın bir Google Places kaydına bağlı olması gerekir' });
  }

  // Rate limit — günde 1 kampanya
  if (profile.lastCampaignAt && profile.lastCampaignAt >= getTurkeyDayStartUtc()) {
    throw new HttpError(429, {
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
  const userIds = [...new Set([...favs, ...resv].map((x) => x.userId))].filter((id) => id !== userId);

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
    where: { userId },
    data: { lastCampaignAt: new Date() },
  });

  return { sent: userIds.length, audience };
}

// ─── Fotoğraflar ─────────────────────────────────────────────────────────────

async function createPhotoUploadUrl(userId, { kind, contentType }) {
  if (!s3.isS3Configured()) {
    throw new HttpError(503, { error: 'Fotoğraf yükleme yakında aktifleşecek (depolama yapılandırılmadı).' });
  }
  // B4 — galeri CRUD ile aynı sözleşme: kind büyük harf (RESTAURANT/PRODUCT).
  // Eski istemciler için küçük harf de toleranslı kabul edilir (case-insensitive).
  const kindUpper = String(kind || '').toUpperCase();
  if (!PHOTO_KINDS.includes(kindUpper)) {
    throw new HttpError(400, { error: "kind 'RESTAURANT' veya 'PRODUCT' olmalıdır." });
  }
  // Ürün (PRODUCT) fotoğrafı aktif abonelik gerektirir; mekan (RESTAURANT) fotoğrafı serbest.
  if (kindUpper === 'PRODUCT') {
    await assertActiveSubscription(userId, 'Ürün fotoğrafı yüklemek Premium üyelik gerektirir.');
  }
  if (!s3.ALLOWED_CONTENT_TYPES[contentType]) {
    throw new HttpError(400, { error: 'Desteklenmeyen dosya türü. Yalnızca JPEG/PNG/WebP.' });
  }
  const profile = await requireProfile(userId, { id: true }, 'Restoran profili bulunamadı.');

  // S3 key segmenti küçük harf kalır (createUploadUrl beklentisi).
  return s3.createUploadUrl(profile.id, kindUpper.toLowerCase(), contentType);
}

async function addPhoto(userId, { kind, url } = {}) {
  if (!PHOTO_KINDS.includes(kind)) {
    throw new HttpError(400, { error: "kind 'RESTAURANT' veya 'PRODUCT' olmalıdır." });
  }
  if (kind === 'PRODUCT') {
    await assertActiveSubscription(userId, 'Ürün fotoğrafı yüklemek Premium üyelik gerektirir.');
  }
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) {
    throw new HttpError(400, { error: 'Geçerli bir url gerekli.' });
  }
  const trimmedUrl = url.trim();

  // F2 — yalnızca kendi S3 bucket'ımızdan gelen URL kabul edilir (harici/uygunsuz görsel enjeksiyonunu önler).
  const objectKey = s3.isS3Configured() ? s3.keyFromUrl(trimmedUrl) : null;
  if (s3.isS3Configured() && !objectKey) {
    throw new HttpError(400, { error: 'Fotoğraf yalnızca uygulama deposundan eklenebilir.' });
  }

  const profile = await requireProfile(userId, { id: true }, 'Restoran profili bulunamadı.');

  const count = await prisma.restaurantPhoto.count({
    where: { restaurantProfileId: profile.id, kind },
  });
  if (count >= MAX_PHOTOS_PER_GALLERY) {
    throw new HttpError(409, { error: `Bir galeride en fazla ${MAX_PHOTOS_PER_GALLERY} fotoğraf olabilir.` });
  }

  // F3 — yüklenen nesne ≤5MB; aşımda nesneyi sil + reddet (HEAD başarısızsa engelleme).
  if (objectKey) {
    try {
      const size = await s3.getObjectSize(objectKey);
      if (size != null && size > MAX_PHOTO_BYTES) {
        s3.deleteObject(objectKey).catch(() => {});
        throw new HttpError(400, { error: 'Fotoğraf en fazla 5 MB olabilir.' });
      }
    } catch (err) {
      // HEAD erişilemezse boyut kontrolü atlanır; ama kendi boyut reddimiz yutulmamalı.
      if (err instanceof HttpError) throw err;
    }
  }

  return prisma.restaurantPhoto.create({
    data: { restaurantProfileId: profile.id, kind, url: trimmedUrl, sortOrder: count },
    select: PHOTO_SELECT,
  });
}

async function listPhotos(userId, kind) {
  if (kind !== undefined && !PHOTO_KINDS.includes(kind)) {
    throw new HttpError(400, { error: "kind 'RESTAURANT' veya 'PRODUCT' olmalıdır." });
  }
  const profile = await requireProfile(userId, { id: true }, 'Restoran profili bulunamadı.');

  return prisma.restaurantPhoto.findMany({
    where: { restaurantProfileId: profile.id, ...(kind ? { kind } : {}) },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: PHOTO_SELECT,
  });
}

async function deletePhoto(userId, id) {
  const profile = await requireProfile(userId, { id: true }, 'Restoran profili bulunamadı.');

  const photo = await prisma.restaurantPhoto.findUnique({ where: { id } });
  if (!photo || photo.restaurantProfileId !== profile.id) {
    throw new HttpError(404, { error: 'Fotoğraf bulunamadı.' });
  }

  await prisma.restaurantPhoto.delete({ where: { id } });

  // S3 nesnesini best-effort sil (URL bu bucket'a aitse)
  const key = s3.keyFromUrl(photo.url);
  if (key && s3.isS3Configured()) {
    s3.deleteObject(key).catch(() => {});
  }

  return { message: 'Silindi' };
}

module.exports = {
  registerRestaurant, getMyProfile, updateHours,
  uploadMenuItem, getMenuItemData, deleteMenuItem,
  replyToReview, deleteReply,
  updateDiscount, activateInstantDiscount, deactivateInstantDiscount,
  updateAnnouncement, updateInfo, getStats, getMyReviews,
  sendCampaign, getAnalytics, getWeeklyReport, getOccupancy,
  createPhotoUploadUrl, addPhoto, listPhotos, deletePhoto,
  // Test ve yeniden kullanım için açılan yardımcılar
  getTurkeyDayStartUtc,
  RESTAURANT_SELECT, PHOTO_SELECT, PHOTO_KINDS,
  CAMPAIGN_MIN_LENGTH, CAMPAIGN_MAX_LENGTH, CAMPAIGN_AUDIENCES,
  MAX_PHOTOS_PER_GALLERY,
};
