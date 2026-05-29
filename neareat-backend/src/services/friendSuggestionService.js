/**
 * Arkadaş Önerisi Motoru.
 *
 * Kullanıcıları aşağıdaki uyum sinyallerine göre puanlayıp birbirine önerir:
 *   - Aynı şehir (il) / aynı ülke (profilde seçilen konum)
 *   - Ortak favori restoranlar
 *   - Ortak koleksiyon (liste) restoranları
 *   - Ortak mutfak tercihleri (favoriteCuisines)
 *   - Ortak paylaşılan/önerilen restoranlar (Recommendation)
 *   - Ortak rezervasyon yapılan mekanlar (Reservation)
 *   - Ortak grup anketi mekanları (oluşturma + oylama — RestaurantPoll / PollVote)
 *   - Ortak beğenilen mutfak tipleri (AI feedback → FeedbackPreference.likedTypes)
 *   - Benzer AI öneri kullanım seviyesi (AiRecommendationLog sayısı)
 *
 * Puanlama çekirdeği (scoreCandidate) saftır — DB'siz test edilebilir.
 * Toplu hesaplama (computeAllSuggestions) tüm verileri tek seferde çekip
 * her kullanıcı için sonucu Redis'e yazar; gece cron'u ve admin manuel tetikleme
 * bunu kullanır. Endpoint cache miss'te tek kullanıcı için anlık hesaplar.
 */

const prisma = require('../utils/prisma');
const { getLevel } = require('../utils/stars');
const { getCountryCode } = require('../utils/cityCountry');
const { cacheGet, cacheSet } = require('./redis');

// Aday havuzu ve sonuç boyutu sınırları
const CANDIDATE_POOL_LIMIT = 500;
const RESULT_LIMIT = 10;

// Redis: precompute sonuçları (gece 03:00 + admin tetikleme yazar)
const CACHE_PREFIX = 'friend-suggestions:';
const CACHE_TTL_SECONDS = 26 * 60 * 60; // bir sonraki gece çalışmasına kadar + tampon

// Puan ağırlıkları
const W = {
  sameCity: 30,
  sameCountry: 15, // aynı ülke ama farklı il (sameCity ile birlikte verilmez)
  favoritePer: 15, favoriteCap: 60,
  collectionPer: 10, collectionCap: 40,
  cuisinePer: 20, cuisineCap: 60,
  recommendationPer: 12, recommendationCap: 48,
  reservationPer: 12, reservationCap: 48,
  pollPer: 8, pollCap: 32,
  likedTypePer: 15, likedTypeCap: 45,
  aiUsageSimilar: 10,
};

// Teorik tavan — frontend yüzde göstergesi için normalizasyon
const MAX_SCORE =
  W.sameCity + W.favoriteCap + W.collectionCap + W.cuisineCap +
  W.recommendationCap + W.reservationCap + W.pollCap + W.likedTypeCap + W.aiUsageSimilar;

// AI kullanım seviyesi bucket'ı — yakın seviye = uyum sinyali
function aiUsageLevel(count) {
  if (!count) return 0;
  if (count < 5) return 1;
  if (count < 20) return 2;
  return 3;
}

function intersectionCount(setA, setB) {
  let n = 0;
  // küçük olanı gez
  const [small, big] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const x of small) if (big.has(x)) n++;
  return n;
}

/**
 * Saf puanlama çekirdeği. viewer ve candidate önceden hazırlanmış context objeleridir.
 *
 * @param {object} viewer  { city, countryCode, favorites:Set, collections:Set, cuisines:Set,
 *                            recommendations:Set, reservations:Set, polls:Set, likedTypes:Set, aiLevel:number }
 * @param {object} candidate aynı shape + { id, displayName, photoUrl, starCount }
 * @returns {{ score:number, reasons:string[], commonFavorites:number, commonCollections:number,
 *             commonCuisines:number, commonRecommendations:number, commonReservations:number,
 *             commonPolls:number, commonLikedTypes:number }}
 */
function scoreCandidate(viewer, candidate) {
  let score = 0;
  const reasons = [];

  // Konum — aynı il en güçlü, değilse aynı ülke
  if (viewer.city && candidate.city &&
      viewer.city.trim().toLocaleLowerCase('tr-TR') === candidate.city.trim().toLocaleLowerCase('tr-TR')) {
    score += W.sameCity;
    reasons.push('Aynı şehir');
  } else if (viewer.countryCode && candidate.countryCode && viewer.countryCode === candidate.countryCode) {
    score += W.sameCountry;
    reasons.push('Aynı ülke');
  }

  const commonFavorites = intersectionCount(viewer.favorites, candidate.favorites);
  score += Math.min(commonFavorites * W.favoritePer, W.favoriteCap);
  if (commonFavorites > 0) reasons.push(`${commonFavorites} ortak favori`);

  const commonCollections = intersectionCount(viewer.collections, candidate.collections);
  score += Math.min(commonCollections * W.collectionPer, W.collectionCap);
  if (commonCollections > 0) reasons.push(`${commonCollections} ortak liste restoranı`);

  const commonCuisines = intersectionCount(viewer.cuisines, candidate.cuisines);
  score += Math.min(commonCuisines * W.cuisinePer, W.cuisineCap);
  if (commonCuisines > 0) reasons.push(`${commonCuisines} ortak mutfak tercihi`);

  const commonRecommendations = intersectionCount(viewer.recommendations, candidate.recommendations);
  score += Math.min(commonRecommendations * W.recommendationPer, W.recommendationCap);
  if (commonRecommendations > 0) reasons.push(`${commonRecommendations} ortak paylaşılan mekan`);

  const commonReservations = intersectionCount(viewer.reservations, candidate.reservations);
  score += Math.min(commonReservations * W.reservationPer, W.reservationCap);
  if (commonReservations > 0) reasons.push(`${commonReservations} ortak rezervasyon mekanı`);

  const commonPolls = intersectionCount(viewer.polls, candidate.polls);
  score += Math.min(commonPolls * W.pollPer, W.pollCap);
  if (commonPolls > 0) reasons.push(`${commonPolls} ortak anket mekanı`);

  const commonLikedTypes = intersectionCount(viewer.likedTypes, candidate.likedTypes);
  score += Math.min(commonLikedTypes * W.likedTypePer, W.likedTypeCap);
  if (commonLikedTypes > 0) reasons.push('Benzer beğeni profili');

  // AI kullanım seviyesi — ikisi de aktif ve seviyeleri yakınsa
  if (viewer.aiLevel > 0 && candidate.aiLevel > 0 && Math.abs(viewer.aiLevel - candidate.aiLevel) <= 1) {
    score += W.aiUsageSimilar;
    reasons.push('Benzer AI kullanımı');
  }

  return {
    score, reasons,
    commonFavorites, commonCollections, commonCuisines,
    commonRecommendations, commonReservations, commonPolls, commonLikedTypes,
  };
}

function maskName(displayName) {
  const words = (displayName || '').trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2) + '...';
  return words[0].slice(0, 2) + '. ' + words[words.length - 1].slice(0, 2) + '...';
}

function toContext(user, maps) {
  return {
    id: user.id,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    city: user.city,
    countryCode: getCountryCode(user.city),
    starCount: user.starCount,
    favorites: maps.fav.get(user.id) || EMPTY_SET,
    collections: maps.coll.get(user.id) || EMPTY_SET,
    cuisines: new Set((user.favoriteCuisines || []).map((c) => String(c).trim().toLocaleLowerCase('tr-TR'))),
    recommendations: maps.rec.get(user.id) || EMPTY_SET,
    reservations: maps.res.get(user.id) || EMPTY_SET,
    polls: maps.poll.get(user.id) || EMPTY_SET,
    likedTypes: maps.liked.get(user.id) || EMPTY_SET,
    aiLevel: aiUsageLevel(maps.ai.get(user.id) || 0),
  };
}

const EMPTY_SET = new Set();

/**
 * Bir viewer için aday context'leri puanlar, ilişkide olunanları eler, ilk N'i döndürür.
 * @param {object} viewerCtx
 * @param {object[]} candidateCtxs
 * @param {Set<string>} excludedIds  viewer.id + mevcut PENDING/ACCEPTED ilişkiler
 */
function rankForViewer(viewerCtx, candidateCtxs, excludedIds) {
  const scored = [];
  for (const cand of candidateCtxs) {
    if (excludedIds.has(cand.id)) continue;
    const r = scoreCandidate(viewerCtx, cand);
    if (r.score <= 0) continue;
    scored.push({
      userId: cand.id,
      maskedName: maskName(cand.displayName),
      photoUrl: cand.photoUrl,
      city: cand.city,
      starCount: cand.starCount,
      ...getLevel(cand.starCount),
      matchScore: r.score,
      matchPercent: Math.min(Math.round((r.score / MAX_SCORE) * 100), 100),
      matchReasons: r.reasons,
      commonFavorites: r.commonFavorites,
      commonCollections: r.commonCollections,
      commonCuisines: r.commonCuisines,
      commonRecommendations: r.commonRecommendations,
      commonReservations: r.commonReservations,
      commonPolls: r.commonPolls,
      commonLikedTypes: r.commonLikedTypes,
    });
  }
  scored.sort((a, b) => b.matchScore - a.matchScore || a.userId.localeCompare(b.userId));
  return scored.slice(0, RESULT_LIMIT);
}

// ─── Veri yükleme ───────────────────────────────────────────────────────────

function addToSetMap(map, userId, placeId) {
  if (!userId || !placeId) return;
  let s = map.get(userId);
  if (!s) { s = new Set(); map.set(userId, s); }
  s.add(placeId);
}

/**
 * Verilen kullanıcı id'leri için tüm sinyal map'lerini tek seferde çeker.
 */
async function loadSignalMaps(userIds) {
  const idFilter = { in: userIds };
  const [favs, collItems, recs, ress, pollVotes, polls, likedPrefs, aiGroups] = await Promise.all([
    prisma.favorite.findMany({ where: { userId: idFilter }, select: { userId: true, placeId: true } }),
    prisma.collectionItem.findMany({
      where: { collection: { userId: idFilter } },
      select: { placeId: true, collection: { select: { userId: true } } },
    }),
    prisma.recommendation.findMany({ where: { fromUserId: idFilter }, select: { fromUserId: true, placeId: true } }),
    prisma.reservation.findMany({ where: { userId: idFilter }, select: { userId: true, placeId: true } }),
    // Ankette oy veren kullanıcı → mekan
    prisma.pollVote.findMany({
      where: { userId: idFilter },
      select: { userId: true, option: { select: { placeId: true } } },
    }),
    // Anket oluşturan kullanıcı → eklediği mekanlar
    prisma.restaurantPoll.findMany({
      where: { creatorId: idFilter },
      select: { creatorId: true, options: { select: { placeId: true } } },
    }),
    prisma.feedbackPreference.findMany({ where: { userId: idFilter }, select: { userId: true, likedTypes: true } }),
    prisma.aiRecommendationLog.groupBy({ by: ['userId'], where: { userId: idFilter }, _count: { _all: true } }),
  ]);

  const fav = new Map();
  for (const f of favs) addToSetMap(fav, f.userId, f.placeId);

  const coll = new Map();
  for (const ci of collItems) addToSetMap(coll, ci.collection.userId, ci.placeId);

  const rec = new Map();
  for (const r of recs) addToSetMap(rec, r.fromUserId, r.placeId);

  const res = new Map();
  for (const r of ress) addToSetMap(res, r.userId, r.placeId);

  const poll = new Map();
  for (const pv of pollVotes) addToSetMap(poll, pv.userId, pv.option?.placeId);
  for (const p of polls) for (const o of p.options) addToSetMap(poll, p.creatorId, o.placeId);

  const liked = new Map();
  for (const lp of likedPrefs) {
    const s = new Set((lp.likedTypes || []).map((t) => String(t).trim().toLocaleLowerCase('tr-TR')));
    if (s.size) liked.set(lp.userId, s);
  }

  const ai = new Map();
  for (const g of aiGroups) ai.set(g.userId, g._count?._all || 0);

  return { fav, coll, rec, res, poll, liked, ai };
}

async function loadRelationAdjacency(userIds) {
  const idSet = new Set(userIds);
  const relations = await prisma.friendRequest.findMany({
    where: {
      status: { in: ['PENDING', 'ACCEPTED'] },
      OR: [{ fromUserId: { in: userIds } }, { toUserId: { in: userIds } }],
    },
    select: { fromUserId: true, toUserId: true },
  });
  const adj = new Map(); // userId → Set(excluded other user ids)
  const add = (a, b) => {
    if (!idSet.has(a)) return;
    let s = adj.get(a);
    if (!s) { s = new Set(); adj.set(a, s); }
    s.add(b);
  };
  for (const r of relations) {
    add(r.fromUserId, r.toUserId);
    add(r.toUserId, r.fromUserId);
  }
  return adj;
}

// ─── Tekil (on-demand) hesaplama — endpoint cache miss fallback ──────────────

async function computeSuggestionsForUser(userId) {
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, photoUrl: true, city: true, favoriteCuisines: true, starCount: true },
  });
  if (!viewer) return [];

  const candidates = await prisma.user.findMany({
    where: { id: { not: userId }, role: 'USER', isSuspended: false, isPublic: true },
    select: { id: true, displayName: true, photoUrl: true, city: true, favoriteCuisines: true, starCount: true },
    take: CANDIDATE_POOL_LIMIT,
  });
  if (candidates.length === 0) return [];

  const allIds = [viewer.id, ...candidates.map((c) => c.id)];
  const [maps, adj] = await Promise.all([loadSignalMaps(allIds), loadRelationAdjacency([viewer.id])]);

  const viewerCtx = toContext(viewer, maps);
  const candidateCtxs = candidates.map((c) => toContext(c, maps));
  const excluded = new Set([viewer.id, ...(adj.get(viewer.id) || [])]);

  return rankForViewer(viewerCtx, candidateCtxs, excluded);
}

// ─── Toplu hesaplama — gece cron + admin tetikleme ──────────────────────────

/**
 * Tüm aktif kullanıcılar için önerileri hesaplar ve Redis'e yazar.
 * @returns {Promise<{ processed:number, stored:number }>}
 */
async function computeAllSuggestions() {
  // Öneri sunulacak kullanıcılar (viewer) — tüm aktif USER'lar
  const viewers = await prisma.user.findMany({
    where: { role: 'USER', isSuspended: false },
    select: { id: true, displayName: true, photoUrl: true, city: true, favoriteCuisines: true, starCount: true },
  });
  if (viewers.length === 0) return { processed: 0, stored: 0 };

  // Aday havuzu — yalnızca herkese açık profiller
  const publicCandidates = await prisma.user.findMany({
    where: { role: 'USER', isSuspended: false, isPublic: true },
    select: { id: true, displayName: true, photoUrl: true, city: true, favoriteCuisines: true, starCount: true },
    take: CANDIDATE_POOL_LIMIT,
  });

  const allIds = [...new Set([...viewers.map((v) => v.id), ...publicCandidates.map((c) => c.id)])];
  const [maps, adj] = await Promise.all([loadSignalMaps(allIds), loadRelationAdjacency(viewers.map((v) => v.id))]);

  const candidateCtxs = publicCandidates.map((c) => toContext(c, maps));

  let stored = 0;
  for (const viewer of viewers) {
    const viewerCtx = toContext(viewer, maps);
    const excluded = new Set([viewer.id, ...(adj.get(viewer.id) || [])]);
    const suggestions = rankForViewer(viewerCtx, candidateCtxs, excluded);
    await cacheSet(`${CACHE_PREFIX}${viewer.id}`, suggestions, CACHE_TTL_SECONDS);
    stored++;
  }

  return { processed: viewers.length, stored };
}

async function getCachedSuggestions(userId) {
  return cacheGet(`${CACHE_PREFIX}${userId}`);
}

module.exports = {
  scoreCandidate,
  rankForViewer,
  maskName,
  computeSuggestionsForUser,
  computeAllSuggestions,
  getCachedSuggestions,
  aiUsageLevel,
  intersectionCount,
  MAX_SCORE,
  RESULT_LIMIT,
  CACHE_PREFIX,
  CACHE_TTL_SECONDS,
  W,
};
