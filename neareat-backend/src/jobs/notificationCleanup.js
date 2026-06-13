'use strict';

/**
 * Bildirim otomatik temizlik — haftalık cron (Sprint-8 #101).
 *
 * Pazar 02:00 Istanbul (23:00 UTC) çalışır.
 * 90 günden eski OKUNMUŞ bildirimleri siler.
 * Okunmamışlar (isRead=false) korunur.
 */

const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { withCronLock } = require('../services/cronLock');

const RETENTION_DAYS = 90;

async function runNotificationCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: cutoff },
      },
    });
    console.log(`[notificationCleanup] ${count} eski okunmuş bildirim silindi (cutoff: ${cutoff.toISOString()})`);
    return count;
  } catch (err) {
    console.error('[notificationCleanup] hata:', err.message);
    return 0;
  }
}

function scheduleNotificationCleanup() {
  // Pazar 02:00 Istanbul = 23:00 UTC Cumartesi
  cron.schedule('0 23 * * 6', () => withCronLock('notificationCleanup', runNotificationCleanup), { timezone: 'UTC' });
  console.log('[notificationCleanup] Haftalık temizlik planlandı (Pazar 02:00 Istanbul)');
}

module.exports = { scheduleNotificationCleanup, runNotificationCleanup };
