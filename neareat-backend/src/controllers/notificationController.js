// Bildirim controller'ı: kullanıcının FCM push token kaydı + uygulama içi bildirim
// listeleme / okundu işaretleme uçları.
const prisma = require('../utils/prisma');

// Cihazın FCM push token'ını kullanıcıya kaydeder (push gönderiminde kullanılır).
async function updateFcmToken(req, res, next) {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { fcmToken },
    });

    res.json({ message: 'FCM token updated' });
  } catch (err) {
    next(err);
  }
}

// Geriye dönük uyumluluk için tutulan no-op uç (gerçek tercihler notificationPrefsController'da).
async function updatePreferences(req, res, next) {
  res.json({ message: 'Preferences updated' });
}

// GET /api/notifications?page=1&limit=20 — kullanıcının bildirimlerini sayfalı döner (limit max 50).
async function getNotifications(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user.id } }),
    ]);

    res.json({ notifications, total, page, hasMore: skip + limit < total });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/unread-count
async function getUnreadCount(req, res, next) {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/:id/read — tek bildirimi okundu işaretler (sahiplik kontrolüyle).
async function markAsRead(req, res, next) {
  try {
    // Başka kullanıcının bildirimini açığa çıkarmamak için 404 (sahip değilse) döndür.
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif || notif.userId !== req.user.id) return res.status(404).json({ error: 'Bulunamadı' });

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json({ message: 'Okundu' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/read-all — kullanıcının tüm okunmamış bildirimlerini topluca okundu yapar.
async function markAllAsRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'Tümü okundu' });
  } catch (err) {
    next(err);
  }
}

module.exports = { updateFcmToken, updatePreferences, getNotifications, getUnreadCount, markAsRead, markAllAsRead };
