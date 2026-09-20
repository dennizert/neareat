/**
 * Check-in kontrolcüsü (Sprint-7 #91).
 *
 * - POST /api/checkin    → restorana check-in yap (3h TTL); eski aktif check-in silinir;
 *                          ActivityEvent (CHECKIN) yazılır; arkadaşlara FCM bildirimi.
 *                          Gövdedeki lat/lng mekâna yakınlık için doğrulanır — yalnızca
 *                          doğrulananlar ziyaret kanıtı (yıldız) sayılır, gerisi sosyal
 *                          olarak normal çalışır. Ayrıntı: utils/checkinVerification.
 * - GET  /api/checkin/me → kullanıcının mevcut aktif check-in'i (yoksa null).
 * - DELETE /api/checkin  → kendi aktif check-in'imi iptal et.
 *
 * Lazy expiry — cron yok. Her okumada `expiresAt > now` filtresi uygulanır.
 */

const prisma = require('../utils/prisma');
const logger = require('../utils/logger'); // S21-2
const { createNotificationsForUsers } = require('../services/notificationService');
const { logActivity, ACTIVITY_TYPES } = require('../services/logService');
const { getPlaceDetails } = require('../services/googlePlaces');
const { verifyCheckinLocation } = require('../utils/checkinVerification');

const CHECKIN_TTL_HOURS = 3;

async function notifyFriendsOfCheckin(user, placeName, placeId) {
  try {
    const friendRequests = await prisma.friendRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ fromUserId: user.id }, { toUserId: user.id }],
      },
      select: { fromUserId: true, toUserId: true },
    });
    const friendIds = friendRequests
      .map((r) => (r.fromUserId === user.id ? r.toUserId : r.fromUserId))
      .filter((id) => id !== user.id);
    if (friendIds.length === 0) return;
    await createNotificationsForUsers(
      friendIds,
      'CHECKIN',
      `${user.displayName} bir mekanda 📍`,
      `${placeName} — şu an oradalar`,
      { userId: user.id, placeId, placeName },
    );
  } catch (err) {
    logger.warn('[checkin] arkadaş bildirimi başarısız', { error: err.message });
  }
}

async function createCheckin(req, res, next) {
  try {
    const placeId = String(req.body?.placeId || '').trim();
    const placeName = String(req.body?.placeName || '').trim().slice(0, 200);
    if (!placeId) return res.status(400).json({ error: 'placeId gerekli' });
    if (!placeName) return res.status(400).json({ error: 'placeName gerekli' });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CHECKIN_TTL_HOURS * 60 * 60 * 1000);

    // S18-3 devamı — konum doğrulaması. Başarısızlık check-in'i ENGELLEMEZ: sosyal
    // özellik (arkadaş bildirimi) çalışmaya devam eder, yalnızca `verified` false kalır
    // ve satır ziyaret kanıtı sayılmaz (starGuards.hasVerifiedVisit).
    const verification = await verifyCheckinLocation({
      lat: req.body?.lat,
      lng: req.body?.lng,
      mocked: req.body?.mocked === true,
      placeId,
      getPlaceDetails,
    });
    if (!verification.verified) {
      logger.info('[checkin] doğrulanmadı — ziyaret kanıtı sayılmayacak', {
        userId: req.user.id,
        placeId,
        reason: verification.reason,
        distanceMeters: verification.distanceMeters,
      });
    }

    // Tek aktif kayıt invariantı: önceki AKTİF check-in yürürlükten kalkmalı.
    // SİLMİYORUZ, süresini dolduruyoruz — satır `starGuards.hasVerifiedVisit`in ziyaret
    // kanıtı. Silinseydi A'ya gidip 1 saat sonra B'ye check-in yapan kullanıcı A'daki
    // gerçek (ve artık konumla doğrulanmış) ziyaretinin kanıtını kaybederdi. `expiresAt`
    // geçmişe çekilince kayıt "aktif" olmaktan çıkar ama kanıt olarak yaşamaya devam eder.
    await prisma.checkIn.updateMany({
      where: { userId: req.user.id, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });

    const checkin = await prisma.checkIn.create({
      data: {
        userId: req.user.id,
        placeId,
        placeName,
        expiresAt,
        lat: verification.lat,
        lng: verification.lng,
        distanceMeters: verification.distanceMeters,
        verified: verification.verified,
        mocked: verification.mocked,
      },
      select: {
        id: true, placeId: true, placeName: true, createdAt: true, expiresAt: true,
        verified: true, distanceMeters: true,
      },
    });

    // ActivityEvent (kalıcı; check-in expire olsa da feed'de yer alır)
    logActivity({
      userId: req.user.id,
      type: ACTIVITY_TYPES.CHECKIN,
      placeId,
      metadata: { placeName },
    }).catch(() => {});

    // Arkadaşlara FCM — fire-and-forget
    notifyFriendsOfCheckin(req.user, placeName, placeId).catch(() => {});

    res.status(201).json(checkin);
  } catch (err) {
    next(err);
  }
}

async function getMyActiveCheckin(req, res, next) {
  try {
    const active = await prisma.checkIn.findFirst({
      where: { userId: req.user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, placeId: true, placeName: true, createdAt: true, expiresAt: true,
        verified: true, distanceMeters: true,
      },
    });
    res.json(active);
  } catch (err) {
    next(err);
  }
}

async function cancelMyCheckin(req, res, next) {
  try {
    // "Check-in'i iptal et" yalnızca aktif olanı kaldırmalı; geçmiş ziyaret kanıtı korunur.
    const { count } = await prisma.checkIn.deleteMany({
      where: { userId: req.user.id, expiresAt: { gt: new Date() } },
    });
    res.json({ deleted: count });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCheckin,
  getMyActiveCheckin,
  cancelMyCheckin,
  CHECKIN_TTL_HOURS,
};
