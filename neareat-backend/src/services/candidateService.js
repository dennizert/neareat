/**
 * AI öneri motoru için restoran aday filtreleme servisi (Sprint-1 Task #3).
 *
 * Mimari karar: NearEat'te restoran tablosu yok — Google Places API canlı çekiliyor
 * (cf. memory/project_restaurant_discovery.md). Dolayısıyla "Prisma query" yerine
 * Google Places'ten alınan listeyi user history + scoring ile daraltıyoruz.
 *
 * Çağrı zinciri:
 *   getCandidates(userId, {lat,lng})
 *     → fetchUserPrefs(userId)              [DB: User.favoriteCuisines + history]
 *     → getNearbyRestaurants(lat,lng,...)   [Google Places, Redis cached]
 *     → enrich: distance, scoring
 *     → filter: open_now ≠ false, rating > MIN_RATING
 *     → sort: skor desc → top MAX_CANDIDATES
 *
 * LLM (Task #5) bu listeden seçer ve açıklamasını üretir.
 */

const { getNearbyRestaurantsFast, getPlaceDetails, getPhotoUrl } = require('./googlePlaces');
const { haversineKm } = require('../utils/haversine');
const prisma = require('../utils/prisma');

const PHOTO_ENRICH_COUNT = 5; // Sadece top N aday için Place Details çekimi

const MAX_CANDIDATES = 20;
const MIN_RATING = 3.5;
const FETCH_TYPE = 'restaurant';

/**
 * Kullanıcı tercihlerini DB'den topla.
 * - favoriteCuisines: kullanıcının onboarding'de söylediği serbest metinler ("Türk", "İtalyan")
 * - recentPlaceIds: son 30 favori/yorum → "yakın zamanda denedi" sinyali (penalty)
 * - cuisineHints: Recommendation tablosundaki place_types[] → string seti
 */
async function fetchUserPrefs(userId) {
  const [user, recentFavorites, recentReviews, sentRecs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteCuisines: true },
    }),
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { placeId: true },
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { placeId: true, rating: true },
    }),
    prisma.recommendation.findMany({
      where: { fromUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { placeTypes: true },
    }),
  ]);

  const recentPlaceIds = new Set([
    ...recentFavorites.map((f) => f.placeId),
    ...recentReviews.map((r) => r.placeId),
  ]);

  // Recommendation.placeTypes'tan ekstra cuisine sinyali çıkar
  const cuisineHints = new Set(
    (user?.favoriteCuisines || []).map((c) => c.toLowerCase())
  );
  for (const rec of sentRecs) {
    for (const t of rec.placeTypes || []) {
      cuisineHints.add(String(t).toLowerCase());
    }
  }

  return {
    favoriteCuisines: user?.favoriteCuisines || [],
    cuisineHints,
    recentPlaceIds,
    likedPlaceIds: new Set(
      recentReviews.filter((r) => r.rating >= 4).map((r) => r.placeId)
    ),
  };
}

/**
 * Google Places sonucu (yeni Google Places "Places (New)" değil legacy nearbysearch)
 * için tip listesini lower-case set'e çevir.
 */
function placeTypesSet(place) {
  return new Set((place.types || []).map((t) => String(t).toLowerCase()));
}

/**
 * place.types ve user tercihleri arasındaki örtüşme.
 * - Doğrudan type eşleşmesi: "italian_restaurant" ∈ user hints
 * - Substring eşleşmesi: user "italian" → "italian_restaurant"
 */
function cuisineMatchScore(placeTypes, cuisineHints) {
  if (cuisineHints.size === 0 || placeTypes.size === 0) return 0;

  let matches = 0;
  for (const type of placeTypes) {
    if (cuisineHints.has(type)) {
      matches += 2; // tam eşleşme
      continue;
    }
    for (const hint of cuisineHints) {
      if (type.includes(hint) || hint.includes(type)) {
        matches += 1; // substring
        break;
      }
    }
  }
  return matches;
}

/**
 * Bir adayın skoru. Daha yüksek daha iyi.
 *
 * Skor bileşenleri:
 *   - distance: yakınsa pozitif (5 / (1 + km))
 *   - rating: ortalama puan (>MIN_RATING'i geçmiş olanlarda doğrudan değer)
 *   - cuisineMatch: kullanıcı tercihleri ile örtüşme
 *   - popularity: log10(user_ratings_total) — küçük etki
 *   - novelty: zaten ziyaret edilmişse -2 penalty
 *   - liked: zaten 4+ yıldız verdiği yer ise +1 (LLM'in "tekrar dene" kararı için)
 */
function scoreCandidate(place, distanceKm, prefs) {
  const distanceScore = 5 / (1 + distanceKm); // 0 km → 5; 4 km → 1
  const ratingScore = Number(place.rating || 0); // 0..5
  const types = placeTypesSet(place);
  const cuisineScore = cuisineMatchScore(types, prefs.cuisineHints);
  const popularityScore = Math.log10(1 + Number(place.user_ratings_total || 0)) * 0.3;

  let noveltyScore = 0;
  if (prefs.recentPlaceIds.has(place.place_id)) {
    noveltyScore = prefs.likedPlaceIds.has(place.place_id) ? 1 : -2;
  }

  return distanceScore + ratingScore + cuisineScore + popularityScore + noveltyScore;
}

/**
 * Google Places place objesini LLM-dostu hafif şekle dönüştür.
 * Token tasarrufu için sadece gerekli alanlar.
 */
function toCandidate(place, distanceKm, score, photoUrl = null) {
  return {
    placeId: place.place_id,
    name: place.name,
    types: place.types || [],
    rating: place.rating ?? null,
    userRatingsTotal: place.user_ratings_total ?? null,
    priceLevel: place.price_level ?? null,
    vicinity: place.vicinity ?? null,
    location: place.geometry?.location
      ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
      : null,
    distanceKm: Number(distanceKm.toFixed(2)),
    openNow: place.opening_hours?.open_now ?? null, // null = bilinmiyor
    photoUrl,
    score: Number(score.toFixed(3)),
  };
}

/**
 * Ana giriş — kullanıcıya AI öneri için max 20 aday restoran döndür.
 *
 * @param {string} userId
 * @param {{ lat: number, lng: number }} location
 * @returns {Promise<{ candidates: Array, meta: object }>}
 */
async function getCandidates(userId, { lat, lng }) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('candidateService: lat ve lng sayı olmalı');
  }

  const t0 = Date.now();
  // Sprint-2 Task #1: getNearbyRestaurantsFast — tek sayfa, no 2× pagination delay.
  // Önceki getNearbyRestaurants 3 sayfa çekerek ~5sn ekliyordu; bu sürüm <1sn (cache miss'te).
  const [prefs, places] = await Promise.all([
    fetchUserPrefs(userId),
    getNearbyRestaurantsFast(lat, lng, FETCH_TYPE),
  ]);

  const enriched = [];
  for (const place of places || []) {
    if (!place.place_id || !place.geometry?.location) continue;

    // Açıkça kapalı olanları ele (null = bilinmiyor → bırak)
    if (place.opening_hours?.open_now === false) continue;

    // Düşük puanlıları ele (rating yoksa bırak — yeni restoran olabilir)
    if (typeof place.rating === 'number' && place.rating < MIN_RATING) continue;

    const distanceKm = haversineKm(
      lat,
      lng,
      place.geometry.location.lat,
      place.geometry.location.lng
    );
    const score = scoreCandidate(place, distanceKm, prefs);
    enriched.push({ place, distanceKm, score });
  }

  enriched.sort((a, b) => b.score - a.score);
  const top = enriched.slice(0, MAX_CANDIDATES);

  // Top 5 için paralel Place Details çekimi → photoUrl (Sprint-2 Task #3).
  // Hata durumunda o aday photoUrl=null alır, akış bozulmaz.
  const photoMap = new Map();
  await Promise.all(
    top.slice(0, PHOTO_ENRICH_COUNT).map(async ({ place }) => {
      try {
        const details = await getPlaceDetails(place.place_id);
        const ref = details?.photos?.[0]?.photo_reference;
        if (ref) photoMap.set(place.place_id, getPhotoUrl(ref, 400));
      } catch {
        // non-critical — photo yoksa null
      }
    })
  );

  const candidates = top.map((e) =>
    toCandidate(e.place, e.distanceKm, e.score, photoMap.get(e.place.place_id) ?? null)
  );

  return {
    candidates,
    meta: {
      fetchedPlaces: places?.length ?? 0,
      afterFilter: enriched.length,
      returned: candidates.length,
      latencyMs: Date.now() - t0,
      userPrefsSummary: {
        favoriteCuisines: prefs.favoriteCuisines.length,
        cuisineHints: prefs.cuisineHints.size,
        recentPlaceIds: prefs.recentPlaceIds.size,
      },
    },
  };
}

module.exports = {
  MAX_CANDIDATES,
  MIN_RATING,
  getCandidates,
  // export internals for unit tests (Task #6)
  __test: {
    fetchUserPrefs,
    placeTypesSet,
    cuisineMatchScore,
    scoreCandidate,
    toCandidate,
  },
};
