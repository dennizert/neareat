/**
 * Restoran trial bitiş hatırlatması (S19-1).
 *
 * Günlük olarak, trial'ı yakında (REMINDER_DAYS gün içinde) bitecek restoranları bulur ve
 * sahibine "aboneliğini başlat" bildirimi gönderir. Trial sonunda ödeme yoksa restoran
 * pasifleşir; bu hatırlatma dönüşümü artırmak ve sürprizi önlemek için.
 *
 * Idempotency: her (userId, expiresAt-günü) için bir kez gönderilir (Redis damgası).
 * Replika-güvenli (withCronLock). Redis yoksa: kilit fail-open + damga yazılamazsa tekrar
 * gönderebilir (zararsız, günde en fazla 1).
 */

const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { withCronLock } = require('../services/cronLock');
const { cacheGet, cacheSet } = require('../services/redis');
const { createNotification } = require('../services/notificationService');
const { RESTAURANT_MONTHLY_PRICE_TEXT } = require('../services/restaurantSubscription');

const REMINDER_DAYS = parseInt(process.env.RESTAURANT_TRIAL_REMINDER_DAYS || '3', 10);

/** [now, now+days] penceresi. Saf. */
function reminderWindow(now = new Date(), days = REMINDER_DAYS) {
  return { gte: now, lte: new Date(now.getTime() + days * 24 * 60 * 60 * 1000) };
}

async function runSubscriptionReminders(now = new Date()) {
  try {
    const win = reminderWindow(now);
    const subs = await prisma.subscription.findMany({
      where: { status: 'trial', expiresAt: { gt: win.gte, lte: win.lte } },
      select: { userId: true, expiresAt: true },
    });

    let sent = 0;
    for (const sub of subs) {
      const dayKey = new Date(sub.expiresAt).toISOString().slice(0, 10);
      const key = `trial-reminder:${sub.userId}:${dayKey}`;
      let already = false;
      try { already = !!(await cacheGet(key)); } catch { already = false; }
      if (already) continue;

      const daysLeft = Math.max(1, Math.ceil((new Date(sub.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      createNotification(
        sub.userId,
        'SUBSCRIPTION_TRIAL_ENDING',
        '⏳ Deneme süren bitiyor',
        `Ücretsiz deneme süren ${daysLeft} gün içinde sona eriyor. Kesintisiz devam için aboneliğini başlat (${RESTAURANT_MONTHLY_PRICE_TEXT} TL/ay).`,
        { daysLeft, screen: 'Paywall' },
      ).catch(() => {});
      cacheSet(key, '1', 8 * 24 * 60 * 60).catch(() => {});
      sent++;
    }
    if (sent) console.log(`[subscriptionReminders] ${sent} restorana trial hatırlatması gönderildi`);
    return { found: subs.length, sent };
  } catch (err) {
    console.error('[subscriptionReminders] error:', err.message);
    return { found: 0, sent: 0, error: err.message };
  }
}

function scheduleSubscriptionReminders() {
  // Her gün 10:00 (Türkiye) — replika-güvenli.
  cron.schedule('0 10 * * *', () => withCronLock('subscriptionReminders', runSubscriptionReminders), { timezone: 'Europe/Istanbul' });
}

module.exports = { scheduleSubscriptionReminders, runSubscriptionReminders, reminderWindow, REMINDER_DAYS };
