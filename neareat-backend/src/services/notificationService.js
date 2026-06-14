// Uygulama içi bildirim yazma servisi: kullanıcı bildirim tercihlerine (opt-out)
// saygı duyarak tekil veya toplu Notification kaydı oluşturur. Tüm yazımlar
// fire-and-forget'tir — hata fırlatmaz ki asıl iş akışını bozmasın.
const prisma = require('../utils/prisma');

// Kullanıcının belirli bir bildirim tipini kapatıp kapatmadığını döner. Opt-out modeli:
// kayıt yoksa varsayılan AÇIK (kullanıcı bir tipi açıkça kapatmadıkça bildirim alır).
async function isNotificationEnabled(userId, type) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
    select: { enabled: true },
  });
  // Kayıt yoksa varsayılan: açık (opt-out modeli)
  return pref === null ? true : pref.enabled;
}

// Tek kullanıcıya in-app bildirim yazar (kullanıcı tercihine saygı duyarak). Fire-and-forget
// çağrılır; hata fırlatmaz (bildirim yazımı asıl iş akışını bozmamalı).
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

// Birden çok kullanıcıya tek seferde bildirim yazar (örn. restoran kampanyası, grup daveti).
// Tek toplu sorguyla tercihleri kontrol edip kapatanları eler → N+1 sorgudan kaçınır.
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
