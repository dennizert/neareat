/**
 * Check-in kontrolcüsü (Sprint-7 #91).
 *
 * - POST /api/checkin    → restorana check-in yap (3h TTL); eski aktif check-in silinir;
 *                          ActivityEvent (CHECKIN) yazılır; arkadaşlara FCM bildirimi.
 * - GET  /api/checkin/me → kullanıcının mevcut aktif check-in'i (yoksa null).
 * - DELETE /api/checkin  → kendi aktif check-in'imi iptal et.
 *
 * Lazy expiry — cron yok. Her okumada `expiresAt > now` filtresi uygulanır.
 */

const prisma = require('../utils/prisma');
const { createNotificationsForUsers } = require('../services/notificationService');
const { logActivity, ACTIVITY_TYPES } = require('../services/logService');

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
    console.warn('[checkin] friend FCM notify failed:', err.message);
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

    // Kullanıcının aktif check-in'lerini sil (tek aktif kayıt)
    await prisma.checkIn.deleteMany({ where: { userId: req.user.id } });

    const checkin = await prisma.checkIn.create({
      data: { userId: req.user.id, placeId, placeName, expiresAt },
      select: { id: true, placeId: true, placeName: true, createdAt: true, expiresAt: true },
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
      select: { id: true, placeId: true, placeName: true, createdAt: true, expiresAt: true },
    });
    res.json(active);
  } catch (err) {
    next(err);
  }
}

async function cancelMyCheckin(req, res, next) {
  try {
    const { count } = await prisma.checkIn.deleteMany({ where: { userId: req.user.id } });
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
