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

const { getNearbyRestaurantsFast, getPlaceDetails, getPhotoUrl, passesQualityFilter } = require('./googlePlaces');
const { haversineKm } = require('../utils/haversine');
const prisma = require('../utils/prisma');

const PHOTO_ENRICH_COUNT = 5;        // Sadece top N aday için Place Details çekimi
const PHOTO_ENRICH_CONCURRENCY = 2; // Aynı anda max N paralel getPlaceDetails isteği

const MAX_CANDIDATES = 20;
// AI öneri kalite eşiği — passesQualityFilter (rating ≥ 2.4, en az 2 puanlama)
// üzerine ekstra "iyi öneri" eşiği uygulanır.
const MIN_RATING = 3.5;
const FETCH_TYPE = 'restaurant';

/**
 * Arkadaşların opt-in (shareWithFriendsRecommender=true) aktivitelerinden
 * sosyal sinyal placeId setleri oluşturur.
 * KVKK: opt-in olmayan arkadaşların verisi kesinlikle dahil edilmez.
 */
async function fetchFriendSocialSignals(userId) {
  const empty = { friendFavPlaceIds: new Set(), friendHighRatedPlaceIds: new Set(), friendCollectionPlaceIds: new Set() };

  const friendRequests = await prisma.friendRequest.findMany({
    where: { status: 'ACCEPTED', OR: [{ fromUserId: userId }, { toUserId: userId }] },
    select: { fromUserId: true, toUserId: true },
  });
  if (!friendRequests.length) return empty;

  const rawIds = friendRequests.map((fr) => (fr.fromUserId === userId ? fr.toUserId : fr.fromUserId));
  const uniqueFriendIds = [...new Set(rawIds)];

  const optInFriends = await prisma.user.findMany({
    where: { id: { in: uniqueFriendIds }, shareWithFriendsRecommender: true },
    select: { id: true },
  });
  if (!optInFriends.length) return empty;

  const optInIds = optInFriends.map((f) => f.id);

  const [favs, highReviews, collItems, recItems] = await Promise.all([
    prisma.favorite.findMany({ where: { userId: { in: optInIds } }, select: { placeId: true } }),
    prisma.review.findMany({ where: { userId: { in: optInIds }, rating: { gte: 4 } }, select: { placeId: true } }),
    prisma.collectionItem.findMany({
      where: { collection: { userId: { in: optInIds } } },
      select: { placeId: true },
    }),
    prisma.recommendation.findMany({ where: { fromUserId: { in: optInIds } }, select: { placeId: true } }),
  ]);

  return {
    friendFavPlaceIds: new Set(favs.map((f) => f.placeId)),
    friendHighRatedPlaceIds: new Set(highReviews.map((r) => r.placeId)),
    friendCollectionPlaceIds: new Set([
      ...collItems.map((c) => c.placeId),
      ...recItems.map((r) => r.placeId),
    ]),
  };
}

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

  // Sosyal sinyal — arkadaşların opt-in verileri (KVKK uyumlu)
  let socialScore = 0;
  const pid = place.place_id;
  if (prefs.friendFavPlaceIds?.has(pid)) socialScore += 1.5;      // arkadaş favorisi: güçlü sinyal
  if (prefs.friendHighRatedPlaceIds?.has(pid)) socialScore += 1.0; // arkadaş 4+ puan: orta sinyal
  if (prefs.friendCollectionPlaceIds?.has(pid)) socialScore += 0.5; // koleksiyon/öneri: zayıf sinyal

  // Discovery boost — kullanıcının daha önce hiç favorilememediği veya yorum yazmadığı yer
  const discoveryBoost = prefs.recentPlaceIds.has(pid) ? 0 : 0.5;

  return distanceScore + ratingScore + cuisineScore + popularityScore + noveltyScore + socialScore + discoveryBoost;
}

/**
 * Google Places place objesini LLM-dostu hafif şekle dönüştür.
 * Token tasarrufu için sadece gerekli alanlar.
 */
function toCandidate(place, distanceKm, score, photoUrl = null, neverVisited = false) {
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
    openNow: place.opening_hours?.open_now ?? null,
    photoUrl,
    neverVisited,
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
  const [prefs, places, friendSignals] = await Promise.all([
    fetchUserPrefs(userId),
    getNearbyRestaurantsFast(lat, lng, FETCH_TYPE),
    fetchFriendSocialSignals(userId),
  ]);

  // Sosyal sinyalleri prefs'e aktar — scoreCandidate erişmesi için
  prefs.friendFavPlaceIds = friendSignals.friendFavPlaceIds;
  prefs.friendHighRatedPlaceIds = friendSignals.friendHighRatedPlaceIds;
  prefs.friendCollectionPlaceIds = friendSignals.friendCollectionPlaceIds;

  const enriched = [];
  for (const place of places || []) {
    if (!place.place_id || !place.geometry?.location) continue;

    // Açıkça kapalı olanları ele (null = bilinmiyor → bırak)
    if (place.opening_hours?.open_now === false) continue;

    // Google kalite filtresi: en az 2 puanlama VE rating ≥ 2.4
    // (Puanlanmamış yerler de elenir — kullanıcı açık talebi.)
    if (!passesQualityFilter(place)) continue;

    // AI önerisi için ekstra kalite eşiği — uygun adayları LLM'e gönder
    if (place.rating < MIN_RATING) continue;

    const distanceKm = haversineKm(
      lat,
      lng,
      place.geometry.location.lat,
      place.geometry.location.lng
    );
    const score = scoreCandidate(place, distanceKm, prefs);
    const neverVisited = !prefs.recentPlaceIds.has(place.place_id);
    enriched.push({ place, distanceKm, score, neverVisited });
  }

  enriched.sort((a, b) => b.score - a.score);
  const top = enriched.slice(0, MAX_CANDIDATES);

  // Top 5 için Place Details çekimi → photoUrl (Sprint-2 Task #3).
  // Circuit breaker: PHOTO_ENRICH_CONCURRENCY'li batch'ler halinde çalıştır;
  // Google Places rate limit koruması. Hata durumunda o aday photoUrl=null alır.
  const photoMap = new Map();
  const photoTargets = top.slice(0, PHOTO_ENRICH_COUNT);
  for (let i = 0; i < photoTargets.length; i += PHOTO_ENRICH_CONCURRENCY) {
    await Promise.allSettled(
      photoTargets.slice(i, i + PHOTO_ENRICH_CONCURRENCY).map(async ({ place }) => {
        try {
          const details = await getPlaceDetails(place.place_id);
          const ref = details?.photos?.[0]?.photo_reference;
          if (ref) photoMap.set(place.place_id, getPhotoUrl(ref, 400));
        } catch {
          // non-critical — photo yoksa null
        }
      })
    );
  }

  const candidates = top.map((e) =>
    toCandidate(e.place, e.distanceKm, e.score, photoMap.get(e.place.place_id) ?? null, e.neverVisited)
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
