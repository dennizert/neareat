const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { createNotification } = require('../services/notificationService');

function getTurkeyDateString() {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0];
}

function scheduleReservationReminders() {
  // Her sabah 09:00 Türkiye saatinde (UTC+3 = 06:00 UTC)
  cron.schedule('0 6 * * *', async () => {
    try {
      const today = getTurkeyDateString();

      const reservations = await prisma.reservation.findMany({
        where: { date: today, status: 'CONFIRMED' },
        select: {
          id: true,
          userId: true,
          time: true,
          restaurant: { select: { businessName: true } },
        },
      });

      for (const res of reservations) {
        createNotification(
          res.userId,
          'RESERVATION_REMINDER',
          '📅 Rezervasyon Hatırlatması',
          `Bugün saat ${res.time}'de ${res.restaurant.businessName} rezervasyonunuz bulunmaktadır. Katılım durumunuzu belirtebilir misiniz?`,
          { reservationId: res.id },
        ).catch(() => {});
      }

      console.log(`[CronJob] ${today} için ${reservations.length} rezervasyon hatırlatması gönderildi.`);
    } catch (err) {
      console.error('[CronJob] Rezervasyon hatırlatması hatası:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('[CronJob] Rezervasyon hatırlatma zamanlaması aktif (her gün 09:00 TR).');
}

module.exports = { scheduleReservationReminders };
