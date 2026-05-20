/**
 * AI öneri endpoint controller'ı (Sprint-1 Task #5).
 *
 * POST /api/recommendations/dinner-tonight
 *   body: { lat: number, lng: number, mood?: string }
 *   auth: gerekli (authenticate middleware)
 *
 * Tier mantığı:
 *   - Free → günde 3 öneri (AiRecommendationLog tablosundan sayılır), model = Haiku 4.5
 *   - Premium → limitsiz, model = Sonnet 4.6
 *
 * Limit aşımında: 429 { error: 'LIMIT_EXCEEDED', upgrade: true, resetAt }
 * Aday yoksa: 404 { error: 'NO_CANDIDATES' }
 */

const prisma = require('../utils/prisma');
const { isPremiumUser } = require('../utils/premiumCheck');
const { recommend } = require('../services/recommendationService');

const FREE_DAILY_LIMIT = 3;

// Mood input validasyonu — controlled vocabulary değil, kullanıcı serbest giriş
// yapabilir ama uzunluk sınırı koyuyoruz. LLM zaten 7-8 örnek mood'u tanıyor.
const MAX_MOOD_LENGTH = 50;

/**
 * İstanbul gece yarısı UTC. "Bugün" hesabı için (TR saati ile günü dönmek istiyoruz).
 * Istanbul UTC+3 sabit (DST yok).
 */
function getIstanbulMidnightUtc() {
  const now = new Date();
  // Istanbul saatine kaydır
  const istanbul = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  istanbul.setUTCHours(0, 0, 0, 0); // shifted clock'ta gece yarısı
  // UTC'ye geri çevir
  return new Date(istanbul.getTime() - 3 * 60 * 60 * 1000);
}

/**
 * Sonraki İstanbul gece yarısı — limit reset zamanı.
 */
function getNextIstanbulMidnightUtc() {
  const current = getIstanbulMidnightUtc();
  return new Date(current.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Free kullanıcı için "bugün" yapılan öneri sayısını ver.
 */
async function countTodayCalls(userId) {
  const since = getIstanbulMidnightUtc();
  return prisma.aiRecommendationLog.count({
    where: { userId, requestedAt: { gte: since } },
  });
}

async function getDinnerTonight(req, res, next) {
  try {
    const { lat, lng, mood } = req.body || {};

    // Validation
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat ve lng zorunlu (number)' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Geçersiz koordinat' });
    }
    let trimmedMood = null;
    if (mood != null) {
      if (typeof mood !== 'string') {
        return res.status(400).json({ error: 'mood string olmalı' });
      }
      trimmedMood = mood.trim().slice(0, MAX_MOOD_LENGTH);
      if (!trimmedMood) trimmedMood = null;
    }

    // Tier
    const isPremium = await isPremiumUser(req.user.id);
    let remaining = null;

    if (!isPremium) {
      const used = await countTodayCalls(req.user.id);
      remaining = Math.max(0, FREE_DAILY_LIMIT - used);
      if (used >= FREE_DAILY_LIMIT) {
        return res.status(429).json({
          error: 'LIMIT_EXCEEDED',
          message:
            'Günlük 3 AI öneri hakkın doldu. Premium\'a geçerek limitsiz öneri al.',
          upgrade: true,
          remaining: 0,
          resetAt: getNextIstanbulMidnightUtc().toISOString(),
        });
      }
    }

    // LLM çağrısı
    const result = await recommend({
      userId: req.user.id,
      location: { lat, lng },
      mood: trimmedMood,
      isPremium,
    });

    // Aday yoksa
    if (result.noCandidates) {
      return res.status(404).json({
        error: 'NO_CANDIDATES',
        message:
          'Şu an yakınında uygun restoran bulamadık. Konum güncellemeyi dene veya biraz uzaklaş.',
      });
    }

    // Free tier remaining decrement (call başarılı oldu, log yazıldı)
    if (!isPremium) {
      remaining = Math.max(0, remaining - 1);
    }

    // Response shaping — frontend'in beklediği {restaurant, reason} yapısı
    const recommendations = result.recommendations.map((r) => ({
      placeId: r.placeId,
      reason: r.reason,
      restaurant: {
        name: r.candidate.name,
        types: r.candidate.types,
        rating: r.candidate.rating,
        userRatingsTotal: r.candidate.userRatingsTotal,
        priceLevel: r.candidate.priceLevel,
        vicinity: r.candidate.vicinity,
        location: r.candidate.location,
        distanceKm: r.candidate.distanceKm,
        openNow: r.candidate.openNow,
      },
    }));

    return res.json({
      recommendations,
      noteToUser: result.noteToUser,
      tier: result.tier,
      model: result.model,
      remainingToday: isPremium ? null : remaining,
      resetAt: isPremium ? null : getNextIstanbulMidnightUtc().toISOString(),
      latencyMs: result.latencyMs,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDinnerTonight,
  // testable internals
  __test: {
    FREE_DAILY_LIMIT,
    MAX_MOOD_LENGTH,
    countTodayCalls,
    getIstanbulMidnightUtc,
    getNextIstanbulMidnightUtc,
  },
};
