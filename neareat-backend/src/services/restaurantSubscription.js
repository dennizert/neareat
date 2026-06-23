'use strict';

// S19-1: Restoran tarafı tek-tip zorunlu ücretli modele geçti (premium/free ayrımı kalktı).
// Onay anında 15 günlük ÜCRETSIZ TRIAL açılır; trial sonunda ödeme yoksa restoran pasifleşir.
// Aylık ücret 1.299,90 TL (gerçek tahsilat Google Play Console'da; kod fiyat tutmaz).

const prisma = require('../utils/prisma');

const RESTAURANT_TRIAL_DAYS = parseInt(process.env.RESTAURANT_TRIAL_DAYS || '15', 10);
// Dokümantasyon/fallback metin — gerçek tahsilat Play Console'da.
const RESTAURANT_MONTHLY_PRICE_TEXT = '1.299,90';

/** Trial bitiş zamanı (now + RESTAURANT_TRIAL_DAYS gün). Saf. */
function trialExpiry(now = new Date()) {
  return new Date(now.getTime() + RESTAURANT_TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Restoran onaylandığında 15 günlük trial aboneliği başlatır. Yalnızca abonelik YOKSA
 * oluşturur (mevcut aktif/ödenmiş aboneliği EZMEZ → idempotent, tekrar onay güvenli).
 * Best-effort: hata yutulur (onay akışını bloklamasın).
 * @returns {Promise<{ created: boolean }>}
 */
async function startTrialForRestaurant(userId, now = new Date()) {
  try {
    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing) return { created: false };
    await prisma.subscription.create({
      data: {
        userId,
        planType: 'monthly',
        status: 'trial',
        startedAt: now,
        expiresAt: trialExpiry(now),
      },
    });
    return { created: true };
  } catch (err) {
    console.error('[restaurantSubscription] trial start error:', err.message);
    return { created: false, error: err.message };
  }
}

module.exports = {
  RESTAURANT_TRIAL_DAYS,
  RESTAURANT_MONTHLY_PRICE_TEXT,
  trialExpiry,
  startTrialForRestaurant,
};
