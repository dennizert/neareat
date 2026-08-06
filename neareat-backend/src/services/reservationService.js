'use strict';

/**
 * Rezervasyon yaşam döngüsü iş mantığı (S23-1).
 *
 * Bu, kod tabanındaki en yoğun iş kuralı kesişimi: S18-2 seviye limitleri, S19-2/3 koltuk
 * kapasitesi ve overbooking, S19-4 öncelik sıralaması, yıldız kazanım/cezaları ve iptal
 * politikası hep burada buluşuyor.
 *
 * S22-1 konvansiyonunu izler. Limit/kapasite/seviye kararları KOPYALANMAZ; mevcut saf
 * çekirdekler tek kaynaktır: `utils/levelAccess`, `utils/occupancy`, `utils/stars`,
 * `utils/reservationPolicy`.
 *
 * BİLİNEN SINIR (kapsam dışı, davranış korunuyor): kapasite kontrolü ile kaydın yazılması
 * arasında kilit yoktur — aynı dilime eşzamanlı iki talep, ikisi de kontrolü geçtikten sonra
 * yazılabilir. Bu refactor öncesinde de böyleydi; eşzamanlılık iyileştirmesi ayrı bir iştir.
 */

const prisma = require('../utils/prisma');
const { HttpError } = require('../utils/httpError');
const { getUserAccess, getLevelAccess } = require('../utils/levelAccess');
const { maybeAwardReferrer } = require('./referralReward');
const { registeredProfileWhere } = require('../utils/restaurantVisibility');
const { availabilityForRequest } = require('../utils/occupancy');
const { awardStars, deductStars, getLevel, RESERVATION_NO_SHOW_PENALTY } = require('../utils/stars');
const { createNotification } = require('./notificationService');
const { logActivity, ACTIVITY_TYPES } = require('./logService');
const {
  getIstanbulMonthStartUtc,
  validateReservationInput,
  computeCancelPolicy,
  CANCEL_PENALTY_HOURS,
  OVERBOOKING_WARNING,
} = require('../utils/reservationPolicy');

const RESERVATION_SELECT = {
  id: true, userId: true, restaurantId: true, placeId: true, placeName: true,
  date: true, time: true, guestCount: true, reservedSeats: true, occasion: true, specialRequests: true,
  status: true, rejectionReason: true, attended: true,
  createdAt: true, updatedAt: true,
  user: { select: { id: true, displayName: true, photoUrl: true, starCount: true } },
  restaurant: { select: { id: true, businessName: true, displayName: true, placePhotoUrl: true, userId: true } },
};

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED'];

/** Sahibin restoran profilini getirir; yoksa 404. */
async function requireRestaurantProfile(userId) {
  const profile = await prisma.restaurantProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(404, { error: 'Restoran profili bulunamadı.' });
  return profile;
}

// ─── Doluluk sorgusu ─────────────────────────────────────────────────────────

async function getAvailability({ placeId, date, time, guestCount: rawGuestCount }) {
  const guestCount = parseInt(rawGuestCount, 10) || 1;
  if (!placeId || !date || !time) {
    throw new HttpError(400, { error: 'placeId, date ve time zorunludur.' });
  }
  const restaurant = await prisma.restaurantProfile.findFirst({
    where: registeredProfileWhere({ placeId }),
    select: { id: true, seatCapacity: true },
  });
  // Kayıtlı/aktif restoran değilse veya kapasite tanımsızsa bant gösterilmez.
  if (!restaurant || restaurant.seatCapacity == null) {
    return { known: false, band: 'unknown', enough: true };
  }
  const reservations = await prisma.reservation.findMany({
    where: { restaurantId: restaurant.id, date, status: 'CONFIRMED' },
    select: { time: true, guestCount: true, reservedSeats: true },
  });
  return availabilityForRequest(reservations, restaurant.seatCapacity, time, guestCount);
}

// ─── Oluşturma ───────────────────────────────────────────────────────────────

/**
 * S18-2 seviye kotası. Karar `utils/levelAccess` çekirdeğinden gelir; burada yalnızca
 * sayım yapılır.
 *  - L1 (limit 0): yalnızca İLK rezervasyon (onboarding).
 *  - L2 (limit 1): takvim ayı başına 1.
 *  - L3+ (null): sınırsız.
 */
async function assertReservationQuota(userId) {
  const { access } = await getUserAccess(userId);
  const monthlyLimit = access.maxReservationsPerMonth;
  if (monthlyLimit === null) return;

  if (monthlyLimit === 0) {
    const totalReservations = await prisma.reservation.count({ where: { userId } });
    if (totalReservations >= 1) {
      throw new HttpError(403, {
        error: 'İlk rezervasyonunu yaptın. Aylık rezervasyon hakkı için Seviye 2\'ye ulaş.',
        code: 'LEVEL_REQUIRED', requiredLevel: 2, feature: 'reservation',
      });
    }
    return;
  }

  const monthlyCount = await prisma.reservation.count({
    where: { userId, createdAt: { gte: getIstanbulMonthStartUtc() } },
  });
  if (monthlyCount >= monthlyLimit) {
    throw new HttpError(403, {
      error: `Bu ay ${monthlyLimit} rezervasyon hakkını kullandın. Sınırsız rezervasyon için Seviye 3'e ulaş.`,
      code: 'LEVEL_REQUIRED', requiredLevel: 3, feature: 'reservation',
    });
  }
}

/**
 * @param {{ id: string, displayName: string }} actor bildirim metni için ad gerekir
 * @returns {Promise<object>} rezervasyon (+ yetersiz kapasitede overbooking uyarısı)
 */
async function createReservation(actor, input) {
  const { placeId, date, time, guestCount, occasion, specialRequests } = input;

  if (!placeId || !date || !time || !guestCount) {
    throw new HttpError(400, { error: 'placeId, date, time ve guestCount zorunludur.' });
  }
  if (guestCount < 1 || guestCount > 50) {
    throw new HttpError(400, { error: 'Misafir sayısı 1-50 arasında olmalıdır.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, { error: 'Tarih YYYY-MM-DD formatında olmalıdır.' });
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new HttpError(400, { error: 'Saat HH:MM formatında olmalıdır.' });
  }

  const validationError = validateReservationInput({ date, time, occasion, specialRequests });
  if (validationError) throw new HttpError(400, { error: validationError });

  await assertReservationQuota(actor.id);

  // Restoranın rezervasyona açık ve onaylı olduğunu kontrol et (S19-1: flag açıksa
  // ayrıca aktif aboneliği olmalı — pasif restoranda rezervasyon yapılamaz).
  const restaurant = await prisma.restaurantProfile.findFirst({
    where: registeredProfileWhere({ placeId, acceptsReservations: true }),
    select: { id: true, businessName: true, userId: true, placeName: true, tableCount: true, seatCapacity: true },
  });
  if (!restaurant) {
    throw new HttpError(400, { error: 'Bu restoran rezervasyona açık değil veya bulunamadı.' });
  }

  // Kapasite kontrolü: tableCount varsa aynı placeId+date+time dilimini say
  if (restaurant.tableCount) {
    const slotCount = await prisma.reservation.count({
      where: { placeId, date, time, status: { in: ACTIVE_STATUSES } },
    });
    if (slotCount >= restaurant.tableCount) {
      throw new HttpError(409, { error: 'Bu saat dilimi dolu. Lütfen başka bir saat seçin.' });
    }
  }

  // Aynı gün aynı saate aktif rezervasyon var mı?
  const existing = await prisma.reservation.findFirst({
    where: { userId: actor.id, restaurantId: restaurant.id, date, time, status: { in: ACTIVE_STATUSES } },
  });
  if (existing) {
    throw new HttpError(409, { error: 'Bu restoran için aynı gün ve saatte zaten aktif bir rezervasyonunuz var.' });
  }

  // S19-3: Koltuk bazlı OVERBOOKING uyarısı. Yetersiz kapasitede talep YİNE oluşturulur
  // (PENDING) ama yanıtta uyarı döner — restoran planlama yapabilirse onaylar, aksi halde
  // reddeder. (Kapasite tanımsızsa kontrol yapılmaz.)
  let overbooking = null;
  if (restaurant.seatCapacity != null) {
    const confirmed = await prisma.reservation.findMany({
      where: { restaurantId: restaurant.id, date, status: 'CONFIRMED' },
      select: { time: true, guestCount: true, reservedSeats: true },
    });
    const avail = availabilityForRequest(confirmed, restaurant.seatCapacity, time, parseInt(guestCount));
    if (avail.known && !avail.enough) overbooking = OVERBOOKING_WARNING;
  }

  const reservation = await prisma.reservation.create({
    data: {
      userId: actor.id,
      restaurantId: restaurant.id,
      placeId,
      placeName: restaurant.placeName || restaurant.businessName,
      date,
      time,
      guestCount: parseInt(guestCount),
      occasion: occasion || null,
      specialRequests: specialRequests || null,
      status: 'PENDING',
    },
    select: RESERVATION_SELECT,
  });

  // Sosyal aktivite akışı
  logActivity({
    userId: actor.id,
    type: ACTIVITY_TYPES.RESERVATION,
    placeId,
    metadata: { placeName: reservation.placeName || null, date, time },
  });
  // Kullanıcıya rezervasyon oluşturma puanı ver
  awardStars(actor.id, 'RESERVATION', `${restaurant.placeName || restaurant.businessName} için rezervasyon talebi`, reservation.id).catch(() => {});

  // S18-3: rezervasyon = anlamlı aksiyon → bekleyen referral'ı (varsa) davet edene ödüllendir.
  maybeAwardReferrer(actor.id).catch(() => {});

  // Restoran kullanıcısına bildirim gönder
  createNotification(
    restaurant.userId,
    'RESERVATION_REQUEST',
    '📅 Yeni Rezervasyon Talebi',
    `${actor.displayName} — ${date} tarihinde ${guestCount} kişi için rezervasyon talep etti.`,
    { reservationId: reservation.id },
  ).catch(() => {});

  return overbooking ? { ...reservation, ...overbooking } : reservation;
}

// ─── Kullanıcı listeleri ─────────────────────────────────────────────────────

async function getMyReservations(userId) {
  return prisma.reservation.findMany({
    where: { userId },
    select: RESERVATION_SELECT,
    orderBy: [{ date: 'desc' }, { time: 'desc' }],
  });
}

// ─── İptal / güncelleme ──────────────────────────────────────────────────────

/** @param {{ id: string, displayName: string }} actor */
async function cancelReservation(actor, id) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { restaurant: { select: { userId: true, businessName: true } } },
  });
  if (!reservation || reservation.userId !== actor.id) {
    throw new HttpError(404, { error: 'Rezervasyon bulunamadı.' });
  }
  if (!ACTIVE_STATUSES.includes(reservation.status)) {
    throw new HttpError(400, { error: 'Bu rezervasyon artık iptal edilemez.' });
  }

  const policy = computeCancelPolicy(reservation.date, reservation.time);
  if (!policy.allowed) {
    throw new HttpError(409, {
      error: `Etkinliğe ${CANCEL_PENALTY_HOURS} saatten az kaldığı için iptal engellenmiştir.`,
      code: 'CANCEL_BLOCKED',
      hoursUntil: Math.max(0, policy.hoursUntil),
    });
  }

  await prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } });

  // Ceza yıldız kesintisi (geç iptal)
  if (policy.penalty > 0) {
    deductStars(
      reservation.userId,
      policy.penalty,
      `Geç iptal cezası — ${reservation.placeName} (${reservation.date} ${reservation.time})`,
      id,
    ).catch(() => {});
  }

  createNotification(
    reservation.restaurant.userId,
    'RESERVATION_CANCELLED',
    '❌ Rezervasyon İptal Edildi',
    `${actor.displayName}, ${reservation.date} tarihli ${reservation.time} rezervasyonunu iptal etti.`,
    { reservationId: id },
  ).catch(() => {});

  return {
    reservation,
    body: { message: 'Rezervasyon iptal edildi.', penaltyStars: policy.penalty },
  };
}

/** @param {{ id: string, displayName: string }} actor */
async function updateReservation(actor, id, input) {
  const { date, time, guestCount, occasion, specialRequests } = input;

  if (!date || !time || !guestCount) {
    throw new HttpError(400, { error: 'date, time ve guestCount zorunludur.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, { error: 'Tarih YYYY-MM-DD formatında olmalıdır.' });
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new HttpError(400, { error: 'Saat HH:MM formatında olmalıdır.' });
  }

  const validationError = validateReservationInput({ date, time, occasion, specialRequests });
  if (validationError) throw new HttpError(400, { error: validationError });

  const old = await prisma.reservation.findUnique({
    where: { id },
    include: { restaurant: { select: { userId: true, businessName: true } } },
  });
  if (!old || old.userId !== actor.id) {
    throw new HttpError(404, { error: 'Rezervasyon bulunamadı.' });
  }
  if (!ACTIVE_STATUSES.includes(old.status)) {
    throw new HttpError(400, { error: 'Bu rezervasyon artık güncellenemez.' });
  }

  // Yeni saat dilimi için kapasite kontrolü
  const restaurantProfile = await prisma.restaurantProfile.findUnique({
    where: { id: old.restaurantId },
    select: { tableCount: true },
  });
  if (restaurantProfile?.tableCount) {
    const slotCount = await prisma.reservation.count({
      where: { placeId: old.placeId, date, time, status: { in: ACTIVE_STATUSES } },
    });
    if (slotCount >= restaurantProfile.tableCount) {
      throw new HttpError(409, { error: 'Bu saat dilimi dolu. Lütfen başka bir saat seçin.' });
    }
  }

  // Eski kaydın iptali ve yenisinin oluşturulması TEK transaction — kullanıcı
  // rezervasyonsuz kalmamalı ya da iki aktif kayda sahip olmamalı.
  const [, newReservation] = await prisma.$transaction([
    prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } }),
    prisma.reservation.create({
      data: {
        userId: actor.id,
        restaurantId: old.restaurantId,
        placeId: old.placeId,
        placeName: old.placeName,
        date,
        time,
        guestCount: parseInt(guestCount),
        occasion: occasion || null,
        specialRequests: specialRequests || null,
        status: 'PENDING',
      },
      select: RESERVATION_SELECT,
    }),
  ]);

  createNotification(
    old.restaurant.userId,
    'RESERVATION_REQUEST',
    '📅 Rezervasyon Güncellendi',
    `${actor.displayName} rezervasyonunu güncelledi: ${date} ${time}, ${parseInt(guestCount)} kişi. Yeniden onay bekleniyor.`,
    { reservationId: newReservation.id },
  ).catch(() => {});

  return { old, reservation: newReservation };
}

// ─── Detay ───────────────────────────────────────────────────────────────────

async function getReservationDetail(userId, id) {
  const reservation = await prisma.reservation.findUnique({ where: { id }, select: RESERVATION_SELECT });
  if (!reservation) throw new HttpError(404, { error: 'Rezervasyon bulunamadı.' });

  const isUser = reservation.userId === userId;
  const isRestaurant = reservation.restaurant.userId === userId;
  if (!isUser && !isRestaurant) throw new HttpError(403, { error: 'Bu rezervasyona erişim yetkiniz yok.' });

  return reservation;
}

// ─── Restoran listesi (S19-4 öncelik) ────────────────────────────────────────

async function getRestaurantReservations(userId, { status, date }) {
  const profile = await requireRestaurantProfile(userId);

  const where = { restaurantId: profile.id };
  if (status && ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'].includes(status)) {
    where.status = status;
  }
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    where.date = date;
  }

  const reservations = await prisma.reservation.findMany({
    where,
    select: RESERVATION_SELECT,
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });

  // S19-4: her talebe sahibinin SEVİYESİ + öncelik derecesini ekle (mobil rozet için).
  // L3+ "öncelikli kullanıcı" (reservationPriority 1/2/3). starCount yanıtta SIZDIRILMAZ.
  const enriched = reservations.map((r) => {
    const stars = r.user?.starCount ?? 0;
    const level = getLevel(stars).level;
    const reservationPriority = getLevelAccess(level).reservationPriority;
    const { starCount, ...user } = r.user || {};
    return { ...r, user, userLevel: level, reservationPriority, isPriority: reservationPriority > 0 };
  });

  // PENDING listesinde öncelikli kullanıcılar EN ÜSTTE (sıralama: öncelik desc, sonra
  // tarih/saat asc). Diğer durum filtrelerinde DB sırası (tarih/saat) korunur.
  if (where.status === 'PENDING') {
    enriched.sort((a, b) =>
      b.reservationPriority - a.reservationPriority ||
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      (a.time < b.time ? -1 : a.time > b.time ? 1 : 0),
    );
  }

  return enriched;
}

// ─── Restoran onay/red ───────────────────────────────────────────────────────

async function updateReservationStatus(userId, id, { status, rejectionReason, reservedSeats }) {
  if (!['CONFIRMED', 'REJECTED'].includes(status)) {
    throw new HttpError(400, { error: 'status CONFIRMED veya REJECTED olmalıdır.' });
  }
  if (status === 'REJECTED' && !rejectionReason?.trim()) {
    throw new HttpError(400, { error: 'Reddetmek için red nedeni zorunludur.' });
  }

  const profile = await requireRestaurantProfile(userId);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation || reservation.restaurantId !== profile.id) {
    throw new HttpError(404, { error: 'Rezervasyon bulunamadı.' });
  }
  if (reservation.status !== 'PENDING') {
    throw new HttpError(400, { error: 'Yalnızca bekleyen rezervasyonlar güncellenebilir.' });
  }

  // S19-3: Onayda rezerve KOLTUK sayısı (varsayılan = talep edilen kişi sayısı, restoran
  // düzeltebilir). Doluluk hesabına bu değer katılır. Kalan kapasiteyi aşması ENGELLENMEZ
  // (overbooking → restoran kararı); yalnızca 1-5000 sınırı.
  let seats;
  if (status === 'CONFIRMED') {
    seats = (reservedSeats != null) ? parseInt(reservedSeats, 10) : reservation.guestCount;
    if (isNaN(seats) || seats < 1 || seats > 5000) {
      throw new HttpError(400, { error: 'Rezerve koltuk sayısı 1-5000 arasında olmalıdır.' });
    }
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      status,
      rejectionReason: status === 'REJECTED' ? rejectionReason.trim() : null,
      reservedSeats: status === 'CONFIRMED' ? seats : undefined,
    },
    select: RESERVATION_SELECT,
  });

  const notifType = status === 'CONFIRMED' ? 'RESERVATION_CONFIRMED' : 'RESERVATION_REJECTED';
  const notifTitle = status === 'CONFIRMED' ? '✅ Rezervasyonunuz Onaylandı!' : '❌ Rezervasyonunuz Reddedildi';
  const notifBody = status === 'CONFIRMED'
    ? `${profile.businessName} ${reservation.date} / ${reservation.time} rezervasyonunuzu onayladı.`
    : `${profile.businessName}: ${rejectionReason.trim()}`;

  createNotification(reservation.userId, notifType, notifTitle, notifBody, { reservationId: id }).catch(() => {});

  return { reservation, updated };
}

// ─── Katılım işaretleme ──────────────────────────────────────────────────────

async function markAttendance(userId, id, { attended }) {
  if (typeof attended !== 'boolean') {
    throw new HttpError(400, { error: 'attended boolean olmalıdır.' });
  }

  const profile = await requireRestaurantProfile(userId);

  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation || reservation.restaurantId !== profile.id) {
    throw new HttpError(404, { error: 'Rezervasyon bulunamadı.' });
  }
  if (reservation.status !== 'CONFIRMED') {
    throw new HttpError(400, { error: 'Yalnızca onaylanmış rezervasyonlar için katılım işaretlenebilir.' });
  }
  if (reservation.attended !== null) {
    throw new HttpError(400, { error: 'Katılım durumu zaten işaretlenmiş.' });
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: { status: 'COMPLETED', attended },
    select: RESERVATION_SELECT,
  });

  if (attended) {
    // Katılım sağlandı: ekstra yıldız ver
    awardStars(
      reservation.userId,
      'RESERVATION_ATTENDED',
      `${profile.businessName ?? profile.placeName} rezervasyonuna katılım`,
      id,
    ).catch(() => {});

    createNotification(
      reservation.userId,
      'RESERVATION_ATTENDED',
      '⭐ Rezervasyon Katılım Puanı!',
      `${profile.businessName} rezervasyonuna katıldığın için +20 yıldız kazandın!`,
      { reservationId: id },
    ).catch(() => {});
  } else {
    // Gelmedi: yıldız düş
    deductStars(
      reservation.userId,
      RESERVATION_NO_SHOW_PENALTY,
      `${profile.businessName ?? profile.placeName} rezervasyonuna gelmedi`,
      id,
    ).catch(() => {});

    createNotification(
      reservation.userId,
      'RESERVATION_NO_SHOW',
      '⚠️ Rezervasyon Uyarısı',
      `${profile.businessName} rezervasyonuna gelmedin. ${RESERVATION_NO_SHOW_PENALTY} yıldız düşüldü.`,
      { reservationId: id },
    ).catch(() => {});
  }

  return { profile, reservation, updated };
}

// ─── Mesajlaşma ──────────────────────────────────────────────────────────────

/** @param {{ id: string, displayName: string }} actor */
async function sendMessage(actor, id, { content }) {
  if (!content?.trim()) throw new HttpError(400, { error: 'Mesaj içeriği boş olamaz.' });
  if (content.length > 1000) throw new HttpError(400, { error: 'Mesaj en fazla 1000 karakter olabilir.' });

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { restaurant: { select: { userId: true, businessName: true } } },
  });
  if (!reservation) throw new HttpError(404, { error: 'Rezervasyon bulunamadı.' });

  const isUser = reservation.userId === actor.id;
  const isRestaurant = reservation.restaurant.userId === actor.id;
  if (!isUser && !isRestaurant) throw new HttpError(403, { error: 'Bu rezervasyona erişim yetkiniz yok.' });

  const senderRole = isRestaurant ? 'RESTAURANT' : 'USER';

  const message = await prisma.reservationMessage.create({
    data: { reservationId: id, senderId: actor.id, senderRole, content: content.trim() },
  });

  // Diğer tarafa bildirim gönder
  const recipientId = isRestaurant ? reservation.userId : reservation.restaurant.userId;
  const notifTitle = isRestaurant ? '💬 Restorandan Mesaj' : '💬 Rezervasyon Mesajı';
  const notifBody = isRestaurant
    ? `${reservation.restaurant.businessName}: ${content.trim().substring(0, 80)}`
    : `${actor.displayName}: ${content.trim().substring(0, 80)}`;

  createNotification(recipientId, 'RESERVATION_MESSAGE', notifTitle, notifBody, { reservationId: id }).catch(() => {});

  return message;
}

async function getMessages(userId, id) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { restaurant: { select: { userId: true } } },
  });
  if (!reservation) throw new HttpError(404, { error: 'Rezervasyon bulunamadı.' });

  const isUser = reservation.userId === userId;
  const isRestaurant = reservation.restaurant.userId === userId;
  if (!isUser && !isRestaurant) throw new HttpError(403, { error: 'Bu rezervasyona erişim yetkiniz yok.' });

  return prisma.reservationMessage.findMany({
    where: { reservationId: id },
    orderBy: { createdAt: 'asc' },
  });
}

module.exports = {
  getAvailability,
  createReservation,
  getMyReservations,
  cancelReservation,
  updateReservation,
  getReservationDetail,
  getRestaurantReservations,
  updateReservationStatus,
  markAttendance,
  sendMessage,
  getMessages,
  assertReservationQuota,
  RESERVATION_SELECT,
};
