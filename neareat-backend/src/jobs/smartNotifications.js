const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { createNotification, createNotificationsForUsers } = require('../services/notificationService');
const { cacheGet, cacheSet } = require('../services/redis');

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getTurkeyNow() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}

function todayTR() {
  return getTurkeyNow().toISOString().split('T')[0];
}

// ─── 1. Favori restoran kapanıyor ─────────────────────────────────────────────
// Saatte bir çalışır. Kapanmaya 30-75 dakika kalan restoranları favorileyen
// kullanıcılara bildirim gönderir. Redis ile günde bir kez sınırlandırılır.
async function runFavoriteClosingSoon() {
  try {
    const now = getTurkeyNow();
    const dayName = DAY_NAMES[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const today = todayTR();

    const restaurants = await prisma.restaurantProfile.findMany({
      where: { status: 'APPROVED', placeId: { not: null }, openingHours: { not: null } },
      select: { placeId: true, placeName: true, businessName: true, openingHours: true },
    });

    let sent = 0;
    for (const rest of restaurants) {
      const hours = rest.openingHours?.[dayName];
      if (!hours || hours.closed || !hours.close) continue;

      const [closeH, closeM] = hours.close.split(':').map(Number);
      const closeMinutes = closeH * 60 + closeM;
      const diff = closeMinutes - currentMinutes;

      if (diff < 30 || diff > 75) continue;

      const displayName = rest.placeName || rest.businessName;
      const favUsers = await prisma.favorite.findMany({
        where: { placeId: rest.placeId },
        select: { userId: true },
      });

      for (const fav of favUsers) {
        const key = `notif:closing:${fav.userId}:${rest.placeId}:${today}`;
        if (await cacheGet(key)) continue;

        createNotification(
          fav.userId,
          'FAVORITE_CLOSING_SOON',
          '⏰ Favori restoranın kapanıyor!',
          `${displayName} yaklaşık ${diff} dakika içinde kapanıyor. Şimdi fırsatı değerlendir!`,
          { placeId: rest.placeId, placeName: displayName },
        ).catch(() => {});

        await cacheSet(key, 1, 24 * 3600);
        sent++;
      }
    }

    console.log(`[SmartNotif] Kapanıyor bildirimi: ${sent} gönderildi.`);
  } catch (err) {
    console.error('[SmartNotif] closingSoon hatası:', err.message);
  }
}

// ─── 2. Grup anketi oy hatırlatması ──────────────────────────────────────────
// 2 saatte bir çalışır. 2 saatten uzun süredir açık anketlerde oy vermemiş
// üyelere hatırlatma gönderir. Redis ile 4 saatte bir tekrarlanır.
async function runPollVoteReminder() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const openPolls = await prisma.restaurantPoll.findMany({
      where: { status: 'OPEN', createdAt: { lt: twoHoursAgo } },
      select: {
        id: true,
        groupId: true,
        group: {
          select: {
            name: true,
            members: {
              where: { status: 'ACCEPTED' },
              select: { userId: true },
            },
          },
        },
        options: { select: { votes: { select: { userId: true } } } },
      },
    });

    let sent = 0;
    for (const poll of openPolls) {
      const votedIds = new Set(poll.options.flatMap(o => o.votes.map(v => v.userId)));
      const unvoted = poll.group.members.filter(m => !votedIds.has(m.userId));

      for (const member of unvoted) {
        const key = `notif:poll_reminder:${member.userId}:${poll.id}`;
        if (await cacheGet(key)) continue;

        createNotification(
          member.userId,
          'POLL_VOTE_REMINDER',
          '🗳️ Oyunu kullanmayı unutma!',
          `"${poll.group.name}" grubundaki anket hâlâ açık. Hangi restorana gideceğinize karar ver!`,
          { groupId: poll.groupId, pollId: poll.id },
        ).catch(() => {});

        await cacheSet(key, 1, 4 * 3600);
        sent++;
      }
    }

    console.log(`[SmartNotif] Anket oy hatırlatması: ${sent} gönderildi.`);
  } catch (err) {
    console.error('[SmartNotif] pollVoteReminder hatası:', err.message);
  }
}

// ─── 3. Haftalık aktivite özeti ───────────────────────────────────────────────
// Her Pazar 10:00 TR çalışır. Bu hafta arkadaşlardan öneri almış kullanıcılara
// özet bildirim gönderir.
async function runWeeklyDigest() {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recGroups = await prisma.recommendation.groupBy({
      by: ['toUserId'],
      where: { toUserId: { not: null }, createdAt: { gte: oneWeekAgo } },
      _count: { id: true },
    });

    let sent = 0;
    for (const rec of recGroups) {
      if (!rec.toUserId) continue;
      const count = rec._count.id;

      createNotification(
        rec.toUserId,
        'WEEKLY_DIGEST',
        '📊 Haftalık Özet',
        `Bu hafta ${count} arkadaşın sana restoran tavsiye etti. Hepsine göz atmak ister misin?`,
        { screen: 'Profile' },
      ).catch(() => {});

      sent++;
    }

    console.log(`[SmartNotif] Haftalık özet: ${sent} gönderildi.`);
  } catch (err) {
    console.error('[SmartNotif] weeklyDigest hatası:', err.message);
  }
}

// ─── 4. Aktif olmayan kullanıcı hatırlatması ─────────────────────────────────
// Her Pazartesi 11:00 TR çalışır. 14 gündür giriş yapmamış ve en az bir
// favorisi olan kullanıcılara haftalık bir kez hatırlatma gönderir.
async function runInactivityReminder() {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const inactiveUsers = await prisma.user.findMany({
      where: {
        role: 'USER',
        isSuspended: false,
        lastLoginAt: { lt: fourteenDaysAgo, not: null },
        favorites: { some: {} },
      },
      select: {
        id: true,
        favorites: { select: { placeName: true }, take: 1 },
      },
      take: 500,
    });

    let sent = 0;
    for (const user of inactiveUsers) {
      const key = `notif:inactivity:${user.id}`;
      if (await cacheGet(key)) continue;

      const favName = user.favorites[0]?.placeName;
      createNotification(
        user.id,
        'INACTIVITY_REMINDER',
        '👋 Seni özledik!',
        favName
          ? `${favName} dahil favori restoranlarında yeni indirimler olabilir. Keşfet!`
          : "NearEat'te çok şey kaçırıyor olabilirsin. Hemen keşfet!",
        { screen: 'Home' },
      ).catch(() => {});

      await cacheSet(key, 1, 7 * 24 * 3600);
      sent++;
    }

    console.log(`[SmartNotif] Aktiflik hatırlatması: ${sent} gönderildi.`);
  } catch (err) {
    console.error('[SmartNotif] inactivityReminder hatası:', err.message);
  }
}

function scheduleSmartNotifications() {
  // Favori restoran kapanıyor — saatte bir (UTC)
  cron.schedule('0 * * * *', runFavoriteClosingSoon, { timezone: 'UTC' });

  // Anket oy hatırlatması — 2 saatte bir
  cron.schedule('0 */2 * * *', runPollVoteReminder, { timezone: 'UTC' });

  // Haftalık özet — Pazar 10:00 TR = 07:00 UTC
  cron.schedule('0 7 * * 0', runWeeklyDigest, { timezone: 'UTC' });

  // Aktif olmayan kullanıcı — Pazartesi 11:00 TR = 08:00 UTC
  cron.schedule('0 8 * * 1', runInactivityReminder, { timezone: 'UTC' });

  console.log('[SmartNotif] Akıllı bildirim zamanlamaları aktif (4 cron).');
}

module.exports = { scheduleSmartNotifications };
