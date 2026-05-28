/**
 * Feedback döngüsü — haftalık aggregate (Sprint-4 Task #7).
 *
 * RecommendationFeedback thumbs-up/down kayıtları tek başına modeli etkilemiyordu.
 * Bu cron, kullanıcı bazlı beğenilen/beğenilmeyen mutfak/restoran tiplerini
 * haftalık özetler ve FeedbackPreference tablosuna yazar. buildUserProfileSummary
 * bu özeti AI sistem prompt'una enjekte eder ("X mutfağını beğeniyor, Y'yi beğenmiyor").
 */

const cron = require('node-cron');
const prisma = require('../utils/prisma');

// Mutfak sinyali taşımayan, genel Google place type'ları — aggregate'te ele.
const GENERIC_TYPES = new Set([
  'point_of_interest',
  'establishment',
  'food',
  'restaurant',
  'store',
  'meal_takeaway',
  'meal_delivery',
  'cafe',
]);

const MAX_PREFERENCE_TYPES = 8; // prompt'u şişirmemek için her yönde en fazla
const AGGREGATE_WINDOW_DAYS = 60; // bu kadar geriye bakılır

/**
 * Saf aggregate çekirdeği — test edilebilir, DB'siz.
 * Beğenilen feedback'lerdeki tipler +1, beğenilmeyenler -1 net skor alır.
 * Net pozitif → likedTypes, net negatif → dislikedTypes (genel tipler hariç).
 *
 * @param {Array<{ sentiment: string, placeTypes?: string[] }>} records
 * @returns {{ likedTypes: string[], dislikedTypes: string[] }}
 */
function aggregateTypePreferences(records) {
  const score = new Map(); // type → { like, dislike }
  for (const r of records || []) {
    const dir = r.sentiment === 'positive' ? 'like' : r.sentiment === 'negative' ? 'dislike' : null;
    if (!dir) continue;
    for (const raw of r.placeTypes || []) {
      const t = String(raw).trim().toLowerCase();
      if (!t || GENERIC_TYPES.has(t)) continue;
      const cur = score.get(t) || { like: 0, dislike: 0 };
      cur[dir] += 1;
      score.set(t, cur);
    }
  }

  const liked = [];
  const disliked = [];
  for (const [type, { like, dislike }] of score) {
    const net = like - dislike;
    if (net > 0) liked.push({ type, weight: net });
    else if (net < 0) disliked.push({ type, weight: -net });
    // net === 0 → kararsız, dahil etme
  }

  // Deterministik: ağırlığa göre, eşitlikte alfabetik
  const byWeight = (a, b) => b.weight - a.weight || a.type.localeCompare(b.type);
  return {
    likedTypes: liked.sort(byWeight).slice(0, MAX_PREFERENCE_TYPES).map((x) => x.type),
    dislikedTypes: disliked.sort(byWeight).slice(0, MAX_PREFERENCE_TYPES).map((x) => x.type),
  };
}

/**
 * Cron runner — son AGGREGATE_WINDOW_DAYS içinde feedback vermiş kullanıcılar için
 * tercih özetini hesaplayıp FeedbackPreference'a upsert eder.
 */
async function runFeedbackAggregation() {
  const since = new Date(Date.now() - AGGREGATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let updated = 0;
  try {
    // Pencere içinde feedback'i olan kullanıcılar
    const recentUsers = await prisma.recommendationFeedback.findMany({
      where: { createdAt: { gte: since } },
      distinct: ['userId'],
      select: { userId: true },
    });

    for (const { userId } of recentUsers) {
      const records = await prisma.recommendationFeedback.findMany({
        where: { userId, createdAt: { gte: since } },
        select: { sentiment: true, placeTypes: true },
      });

      const { likedTypes, dislikedTypes } = aggregateTypePreferences(records);

      await prisma.feedbackPreference.upsert({
        where: { userId },
        update: { likedTypes, dislikedTypes },
        create: { userId, likedTypes, dislikedTypes },
      });
      updated++;
    }
    console.log(`[feedbackAggregator] ${updated} kullanıcı tercihi güncellendi`);
  } catch (err) {
    console.error('[feedbackAggregator] error:', err.message);
  }
  return updated;
}

function scheduleFeedbackAggregation() {
  // Her Pazartesi 05:00 UTC (haftalık digest ve inactivity reminder ile çakışmaz)
  cron.schedule('0 5 * * 1', runFeedbackAggregation, { timezone: 'UTC' });
}

module.exports = {
  scheduleFeedbackAggregation,
  runFeedbackAggregation,
  aggregateTypePreferences,
  GENERIC_TYPES,
  MAX_PREFERENCE_TYPES,
};
