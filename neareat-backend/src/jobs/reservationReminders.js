// Rezervasyon cron'ları: (1) her gün 09:00 TR'de bugünkü CONFIRMED rezervasyonlar için
// kullanıcıya hatırlatma; (2) her saat başı 24 saatten uzun süredir PENDING kalan
// rezervasyonları escalate eder (restoran + kullanıcı bildirimi). Replika-güvenli (withCronLock),
// `pendingReminderSentAt` ile idempotent.
const cron = require('node-cron');
const prisma = require('../utils/prisma');
const { createNotification } = require('../services/notificationService');
const { withCronLock } = require('../services/cronLock');

// Türkiye yerel tarihi (YYYY-MM-DD, UTC+3) — "bugünkü" rezervasyonları eşlemek için.
function getTurkeyDateString() {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0];
}

// 24 saatten uzun süredir PENDING kalan rezervasyonlar için escalation eşiği
const PENDING_ESCALATION_HOURS = 24;

/**
 * Restoran 24 saat içinde yanıt vermediyse PENDING rezervasyonu escalate eder:
 * restorana "yanıt bekleyen rezervasyon" hatırlatması + kullanıcıya bilgi.
 * `pendingReminderSentAt` ile idempotent — her cron turunda tekrar göndermez.
 *
 * @returns {Promise<number>} işlenen rezervasyon sayısı
 */
async function runPendingReservationEscalation() {
  const cutoff = new Date(Date.now() - PENDING_ESCALATION_HOURS * 60 * 60 * 1000);
  let processed = 0;
  try {
    const stale = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: cutoff },
        pendingReminderSentAt: null,
      },
      select: {
        id: true,
        userId: true,
        date: true,
        time: true,
        guestCount: true,
        user: { select: { displayName: true } },
        restaurant: { select: { userId: true, businessName: true, placeName: true } },
      },
    });

    for (const r of stale) {
      const place = r.restaurant.placeName || r.restaurant.businessName;
      // Restorana escalation hatırlatması
      await createNotification(
        r.restaurant.userId,
        'RESERVATION_PENDING_REMINDER',
        '⏰ Yanıt bekleyen rezervasyon',
        `${r.user.displayName} adlı kullanıcının ${r.date} ${r.time} (${r.guestCount} kişi) rezervasyonu 24 saattir yanıt bekliyor. Lütfen onaylayın veya reddedin.`,
        { reservationId: r.id },
      ).catch(() => {});

      // Kullanıcıya bilgi
      await createNotification(
        r.userId,
        'RESERVATION_PENDING_REMINDER',
        '⏳ Rezervasyonun hâlâ yanıt bekliyor',
        `${place} için ${r.date} ${r.time} rezervasyon talebin restoran tarafından henüz yanıtlanmadı. Restoranı hatırlattık.`,
        { reservationId: r.id },
      ).catch(() => {});

      await prisma.reservation.update({
        where: { id: r.id },
        data: { pendingReminderSentAt: new Date() },
      });
      processed++;
    }

    console.log(`[CronJob] ${processed} PENDING rezervasyon escalate edildi.`);
  } catch (err) {
    console.error('[CronJob] PENDING rezervasyon escalation hatası:', err.message);
  }
  return processed;
}

function scheduleReservationReminders() {
  // Her sabah 09:00 Türkiye saatinde (UTC+3 = 06:00 UTC) — günlük hatırlatma
  cron.schedule('0 6 * * *', () => withCronLock('reservationDailyReminder', async () => {
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
  }), { timezone: 'UTC' });

  // Her saat başı — 24h+ PENDING rezervasyon escalation (S5-1)
  cron.schedule('0 * * * *', () => withCronLock('reservationEscalation', runPendingReservationEscalation), { timezone: 'UTC' });

  console.log('[CronJob] Rezervasyon hatırlatma + PENDING escalation zamanlaması aktif.');
}

module.exports = { scheduleReservationReminders, runPendingReservationEscalation, PENDING_ESCALATION_HOURS };
