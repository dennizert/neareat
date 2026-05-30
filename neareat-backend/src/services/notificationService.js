const prisma = require('../utils/prisma');

async function isNotificationEnabled(userId, type) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
    select: { enabled: true },
  });
  // Kayıt yoksa varsayılan: açık (opt-out modeli)
  return pref === null ? true : pref.enabled;
}

async function createNotification(userId, type, title, body, data = null) {
  try {
    const enabled = await isNotificationEnabled(userId, type);
    if (!enabled) return null;
    return await prisma.notification.create({
      data: { userId, type, title, body, data },
    });
  } catch (err) {
    console.error('[notification] create failed:', err.message);
  }
}

async function createNotificationsForUsers(userIds, type, title, body, data = null) {
  if (!userIds || userIds.length === 0) return;
  try {
    // Toplu tercih kontrolü — devre dışı bırakan kullanıcıları filtrele
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, type, enabled: false },
      select: { userId: true },
    });
    const disabledSet = new Set(prefs.map(p => p.userId));
    const activeIds = userIds.filter(id => !disabledSet.has(id));
    if (activeIds.length === 0) return;
    await prisma.notification.createMany({
      data: activeIds.map(userId => ({ userId, type, title, body, data })),
    });
  } catch (err) {
    console.error('[notification] bulk create failed:', err.message);
  }
}

module.exports = { createNotification, createNotificationsForUsers, isNotificationEnabled };
