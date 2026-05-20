const prisma = require('../utils/prisma');
const { awardStars, deductStars, RESERVATION_NO_SHOW_PENALTY } = require('../utils/stars');
const { createNotification } = require('../services/notificationService');
const { logRequest } = require('../services/logService');

const RESERVATION_SELECT = {
  id: true, userId: true, restaurantId: true, placeId: true, placeName: true,
  date: true, time: true, guestCount: true, occasion: true, specialRequests: true,
  status: true, rejectionReason: true, attended: true,
  createdAt: true, updatedAt: true,
  user: { select: { id: true, displayName: true, photoUrl: true } },
  restaurant: { select: { id: true, businessName: true, placePhotoUrl: true, userId: true } },
};

// ─── Kullanıcı — Rezervasyon Oluştur ─────────────────────────────────────────

// POST /api/reservations
async function createReservation(req, res, next) {
  try {
    const { placeId, date, time, guestCount, occasion, specialRequests } = req.body;

    if (!placeId || !date || !time || !guestCount) {
      return res.status(400).json({ error: 'placeId, date, time ve guestCount zorunludur.' });
    }
    if (guestCount < 1 || guestCount > 50) {
      return res.status(400).json({ error: 'Misafir sayısı 1-50 arasında olmalıdır.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Tarih YYYY-MM-DD formatında olmalıdır.' });
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ error: 'Saat HH:MM formatında olmalıdır.' });
    }

    // Restoranın rezervasyona açık ve onaylı olduğunu kontrol et
    const restaurant = await prisma.restaurantProfile.findFirst({
      where: { placeId, status: 'APPROVED', acceptsReservations: true },
      select: { id: true, businessName: true, userId: true, placeName: true },
    });
    if (!restaurant) {
      return res.status(400).json({ error: 'Bu restoran rezervasyona açık değil veya bulunamadı.' });
    }

    // Aynı gün aynı saate aktif rezervasyon var mı?
    const existing = await prisma.reservation.findFirst({
      where: {
        userId: req.user.id,
        restaurantId: restaurant.id,
        date,
        time,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'Bu restoran için aynı gün ve saatte zaten aktif bir rezervasyonunuz var.' });
    }

    const reservation = await prisma.reservation.create({
      data: {
        userId: req.user.id,
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

    logRequest({ req, page: 'Rezervasyonlar', action: 'Rezervasyon oluşturdu', details: `${reservation.placeName} — ${date} ${time}, ${guestCount} kişi` }).catch(() => {});
    // Kullanıcıya rezervasyon oluşturma puanı ver
    awardStars(req.user.id, 'RESERVATION', `${restaurant.placeName || restaurant.businessName} için rezervasyon talebi`, reservation.id).catch(() => {});

    // Restoran kullanıcısına bildirim gönder
    createNotification(
      restaurant.userId,
      'RESERVATION_REQUEST',
      '📅 Yeni Rezervasyon Talebi',
      `${req.user.displayName} — ${date} tarihinde ${guestCount} kişi için rezervasyon talep etti.`,
      { reservationId: reservation.id },
    ).catch(() => {});

    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
}

// ─── Kullanıcı — Rezervasyonlarım ────────────────────────────────────────────

// GET /api/reservations/me
async function getMyReservations(req, res, next) {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user.id },
      select: RESERVATION_SELECT,
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
    });
    res.json(reservations);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/reservations/:id — kullanıcı iptal eder
async function cancelReservation(req, res, next) {
  try {
    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { restaurant: { select: { userId: true, businessName: true } } },
    });
    if (!reservation || reservation.userId !== req.user.id) {
      return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    }
    if (!['PENDING', 'CONFIRMED'].includes(reservation.status)) {
      return res.status(400).json({ error: 'Bu rezervasyon artık iptal edilemez.' });
    }
    await prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Restoran kullanıcısına bildirim gönder
    createNotification(
      reservation.restaurant.userId,
      'RESERVATION_CANCELLED',
      '❌ Rezervasyon İptal Edildi',
      `${req.user.displayName}, ${reservation.date} tarihli ${reservation.time} rezervasyonunu iptal etti.`,
      { reservationId: id },
    ).catch(() => {});

    logRequest({ req, page: 'Rezervasyonlar', action: 'Rezervasyon iptal etti', details: `${reservation.placeName} — ${reservation.date} ${reservation.time}` }).catch(() => {});
    res.json({ message: 'Rezervasyon iptal edildi.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/reservations/:id — kullanıcı rezervasyonu günceller (eski iptal + yeni talep)
async function updateReservation(req, res, next) {
  try {
    const { id } = req.params;
    const { date, time, guestCount, occasion, specialRequests } = req.body;

    if (!date || !time || !guestCount) {
      return res.status(400).json({ error: 'date, time ve guestCount zorunludur.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Tarih YYYY-MM-DD formatında olmalıdır.' });
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ error: 'Saat HH:MM formatında olmalıdır.' });
    }

    const old = await prisma.reservation.findUnique({
      where: { id },
      include: { restaurant: { select: { userId: true, businessName: true } } },
    });
    if (!old || old.userId !== req.user.id) {
      return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    }
    if (!['PENDING', 'CONFIRMED'].includes(old.status)) {
      return res.status(400).json({ error: 'Bu rezervasyon artık güncellenemez.' });
    }

    const [, newReservation] = await prisma.$transaction([
      prisma.reservation.update({ where: { id }, data: { status: 'CANCELLED' } }),
      prisma.reservation.create({
        data: {
          userId: req.user.id,
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
      `${req.user.displayName} rezervasyonunu güncelledi: ${date} ${time}, ${parseInt(guestCount)} kişi. Yeniden onay bekleniyor.`,
      { reservationId: newReservation.id },
    ).catch(() => {});

    logRequest({ req, page: 'Rezervasyonlar', action: 'Rezervasyon güncelledi', details: `${old.placeName} — ${date} ${time}, ${guestCount} kişi` }).catch(() => {});
    res.status(201).json(newReservation);
  } catch (err) {
    next(err);
  }
}

// ─── Ortak — Rezervasyon Detayı ───────────────────────────────────────────────

// GET /api/reservations/:id
async function getReservationDetail(req, res, next) {
  try {
    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: RESERVATION_SELECT,
    });
    if (!reservation) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });

    const isUser = reservation.userId === req.user.id;
    const isRestaurant = reservation.restaurant.userId === req.user.id;
    if (!isUser && !isRestaurant) return res.status(403).json({ error: 'Bu rezervasyona erişim yetkiniz yok.' });

    res.json(reservation);
  } catch (err) {
    next(err);
  }
}

// ─── Restoran — Rezervasyonlar ────────────────────────────────────────────────

// GET /api/reservations/restaurant
async function getRestaurantReservations(req, res, next) {
  try {
    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı.' });

    const { status, date } = req.query;
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
    res.json(reservations);
  } catch (err) {
    next(err);
  }
}

// PUT /api/reservations/:id/status — restoran onaylar/reddeder
async function updateReservationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['CONFIRMED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'status CONFIRMED veya REJECTED olmalıdır.' });
    }
    if (status === 'REJECTED' && !rejectionReason?.trim()) {
      return res.status(400).json({ error: 'Reddetmek için red nedeni zorunludur.' });
    }

    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı.' });

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation || reservation.restaurantId !== profile.id) {
      return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    }
    if (reservation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Yalnızca bekleyen rezervasyonlar güncellenebilir.' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason.trim() : null,
      },
      select: RESERVATION_SELECT,
    });

    const notifType = status === 'CONFIRMED' ? 'RESERVATION_CONFIRMED' : 'RESERVATION_REJECTED';
    const notifTitle = status === 'CONFIRMED' ? '✅ Rezervasyonunuz Onaylandı!' : '❌ Rezervasyonunuz Reddedildi';
    const notifBody = status === 'CONFIRMED'
      ? `${profile.businessName} ${reservation.date} / ${reservation.time} rezervasyonunuzu onayladı.`
      : `${profile.businessName}: ${rejectionReason.trim()}`;

    createNotification(reservation.userId, notifType, notifTitle, notifBody, { reservationId: id }).catch(() => {});

    const logAction = status === 'CONFIRMED' ? 'Rezervasyon onayladı' : 'Rezervasyon reddetti';
    logRequest({ req, page: 'Restoran Paneli', action: logAction, details: `${reservation.placeName} — ${reservation.date} ${reservation.time}` }).catch(() => {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// PUT /api/reservations/:id/attendance — restoran katılım işaretler
async function markAttendance(req, res, next) {
  try {
    const { id } = req.params;
    const { attended } = req.body;

    if (typeof attended !== 'boolean') {
      return res.status(400).json({ error: 'attended boolean olmalıdır.' });
    }

    const profile = await prisma.restaurantProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Restoran profili bulunamadı.' });

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation || reservation.restaurantId !== profile.id) {
      return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });
    }
    if (reservation.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Yalnızca onaylanmış rezervasyonlar için katılım işaretlenebilir.' });
    }
    if (reservation.attended !== null) {
      return res.status(400).json({ error: 'Katılım durumu zaten işaretlenmiş.' });
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

    const attendanceLog = attended ? 'Rezervasyon katılımını işaretledi (geldi)' : 'Rezervasyon katılımını işaretledi (gelmedi)';
    logRequest({ req, page: 'Restoran Paneli', action: attendanceLog, details: `${profile.businessName} — ${reservation.date} ${reservation.time}` }).catch(() => {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ─── Mesajlaşma ───────────────────────────────────────────────────────────────

// POST /api/reservations/:id/messages
async function sendMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Mesaj içeriği boş olamaz.' });
    if (content.length > 1000) return res.status(400).json({ error: 'Mesaj en fazla 1000 karakter olabilir.' });

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { restaurant: { select: { userId: true, businessName: true } } },
    });
    if (!reservation) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });

    const isUser = reservation.userId === req.user.id;
    const isRestaurant = reservation.restaurant.userId === req.user.id;
    if (!isUser && !isRestaurant) return res.status(403).json({ error: 'Bu rezervasyona erişim yetkiniz yok.' });

    const senderRole = isRestaurant ? 'RESTAURANT' : 'USER';

    const message = await prisma.reservationMessage.create({
      data: {
        reservationId: id,
        senderId: req.user.id,
        senderRole,
        content: content.trim(),
      },
    });

    // Diğer tarafa bildirim gönder
    const recipientId = isRestaurant ? reservation.userId : reservation.restaurant.userId;
    const notifTitle = isRestaurant ? '💬 Restorandan Mesaj' : '💬 Rezervasyon Mesajı';
    const notifBody = isRestaurant
      ? `${reservation.restaurant.businessName}: ${content.trim().substring(0, 80)}`
      : `${req.user.displayName}: ${content.trim().substring(0, 80)}`;

    createNotification(recipientId, 'RESERVATION_MESSAGE', notifTitle, notifBody, { reservationId: id }).catch(() => {});

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

// GET /api/reservations/:id/messages
async function getMessages(req, res, next) {
  try {
    const { id } = req.params;
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { restaurant: { select: { userId: true } } },
    });
    if (!reservation) return res.status(404).json({ error: 'Rezervasyon bulunamadı.' });

    const isUser = reservation.userId === req.user.id;
    const isRestaurant = reservation.restaurant.userId === req.user.id;
    if (!isUser && !isRestaurant) return res.status(403).json({ error: 'Bu rezervasyona erişim yetkiniz yok.' });

    const messages = await prisma.reservationMessage.findMany({
      where: { reservationId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json(messages);
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};
