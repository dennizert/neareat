const prisma = require('../utils/prisma');

/** Sosyal aktivite akışı olay türleri (Sprint-4 Task #4). */
const ACTIVITY_TYPES = Object.freeze({
  REVIEW: 'REVIEW',
  FAVORITE: 'FAVORITE',
  RESERVATION: 'RESERVATION',
  RECOMMENDATION: 'RECOMMENDATION',
  CHECKIN: 'CHECKIN', // Sprint-7 #91
});

async function logRequest({ req, page, action, details }) {
  try {
    const user = req?.user;
    const forwarded = req?.headers?.['x-forwarded-for'];
    const ip = (forwarded ? forwarded.split(',')[0].trim() : null) || req?.ip || null;

    await prisma.userLog.create({
      data: {
        userId: user?.id || null,
        username: user?.displayName || null,
        email: user?.email || null,
        page,
        action,
        details: details ? String(details).substring(0, 500) : null,
        ip,
      },
    });
  } catch (err) {
    console.error('[logService] error:', err.message);
  }
}

/**
 * Sosyal aktivite akışı (S4-5/S4-6) için olay kaydı — fire-and-forget.
 * Çağıran AWAIT ETMEMELİ; hata yutulur, ana akış bloklanmaz.
 *
 * @param {object} p
 * @param {string} p.userId - olayı üreten kullanıcı
 * @param {string} p.type - ACTIVITY_TYPES'tan biri
 * @param {string} [p.placeId] - Google Places ID
 * @param {object} [p.metadata] - olaya özgü ek bilgi (örn. { placeName })
 */
async function logActivity({ userId, type, placeId = null, metadata = null }) {
  try {
    if (!userId || !type) return;
    await prisma.activityEvent.create({
      data: { userId, type, placeId, metadata: metadata ?? undefined },
    });
  } catch (err) {
    console.error('[logService] logActivity error:', err.message);
  }
}

module.exports = { logRequest, logActivity, ACTIVITY_TYPES };
