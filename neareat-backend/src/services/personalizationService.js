'use strict';

/**
 * Kişiselleştirme çekirdeği (Sprint-17 #366).
 *
 * SAF modül: harici API/DB çağrısı yapmaz. Controller, kullanıcının davranış
 * sinyallerini (favoriler, yorumlar, rezervasyonlar, öneriler, günlük, check-in,
 * favori mutfaklar, AI-feedback beğenilen tipler) DB'den toplar ve buraya verir;
 * burada deterministik bir "damak profili" çıkarılır ve aday mekanlar puanlanır.
 * Bu sayede mantık jest ile birebir test edilebilir (friendSuggestionService deseni).
 */

// Damak profilinde mutfak etiketi (cuisine tag) ağırlık katsayıları.
const W = Object.freeze({
  favoriteCuisine: 3,    // Kullanıcının profilinde seçtiği favori mutfak (string eşleşmesi)
  likedType: 2,          // AI-feedback ile beğenilen Google place type
  favoritePlaceTag: 1.5, // Favorilediği mekanların mutfak etiketi
  ratedPlaceTag: 1.2,    // Yüksek puan (≥4) verdiği mekanların etiketi
  otherEngagedTag: 1,    // Rezervasyon/öneri/günlük/check-in mekanlarının etiketi
});

// Puanlama katsayıları.
const SCORE = Object.freeze({
  cuisineWeightCap: 6,   // Tek mekan için mutfak ağırlığı katkısı tavanı
  likedTypeBonus: 2,     // Mekanın tipi beğenilen tiplerden biriyse
  frequentBonus: 4,      // Sık gidilen mekan (≥2 ziyaret sinyali)
  triedPenalty: 1.5,     // "Senin İçin" keşfinde yakın geçmişte denenmişe küçük ceza
  qualityHighRating: 4.5,// Bu eşik üstü "Yüksek puanlı" sayılır
  qualityBonus: 1,
  distanceFullKm: 5,     // Bu mesafeye kadar yakınlık bonusu doğrusal azalır
  distanceBonusMax: 0.5,
});

/**
 * Bir string'i karşılaştırma için normalize eder (küçük harf + trim).
 * @param {string} s
 */
function norm(s) {
  return String(s || '').toLocaleLowerCase('tr').trim();
}

/**
 * Toplanan sinyallerden deterministik damak profili üretir.
 *
 * @param {object} signals
 * @param {string[]} [signals.favoriteCuisines]  Profil favori mutfakları (string)
 * @param {string[]} [signals.likedTypes]        AI-feedback beğenilen Google tipleri
 * @param {Array<{tags?: string[], weightKey?: keyof typeof W}>} [signals.weightedTags]
 *        Etkileşilen her mekanın mutfak etiketleri + hangi ağırlık sınıfında olduğu
 * @param {string[]} [signals.triedPlaceIds]     Kullanıcının daha önce denediği mekanlar
 * @param {string[]} [signals.highRatedPlaceIds] Yüksek puan verdiği mekanlar
 * @param {Object<string, number>} [signals.placeFrequency] placeId → ziyaret sayısı
 * @returns {{cuisineWeights: Map<string, number>, favoriteCuisines: string[], likedTypes: Set<string>, triedPlaceIds: Set<string>, highRatedPlaceIds: Set<string>, frequentPlaceIds: Set<string>}}
 */
function buildTasteProfile(signals = {}) {
  const cuisineWeights = new Map();
  const addTag = (tag, w) => {
    if (!tag) return;
    cuisineWeights.set(tag, (cuisineWeights.get(tag) || 0) + w);
  };

  // Etkileşilen mekanların etiketlerini ağırlık sınıfına göre topla.
  for (const entry of signals.weightedTags || []) {
    const w = W[entry.weightKey] ?? W.otherEngagedTag;
    for (const tag of entry.tags || []) addTag(tag, w);
  }

  const frequentPlaceIds = new Set(
    Object.entries(signals.placeFrequency || {})
      .filter(([, count]) => count >= 2)
      .map(([placeId]) => placeId),
  );

  return {
    cuisineWeights,
    favoriteCuisines: (signals.favoriteCuisines || []).map(norm).filter(Boolean),
    likedTypes: new Set(signals.likedTypes || []),
    triedPlaceIds: new Set(signals.triedPlaceIds || []),
    highRatedPlaceIds: new Set(signals.highRatedPlaceIds || []),
    frequentPlaceIds,
  };
}

/**
 * Bir aday mekanı damak profiline göre puanlar ve kullanıcıya gösterilecek
 * "neden" gerekçelerini üretir. Yüksek skor = daha alakalı.
 *
 * @param {{placeId: string, name?: string, types?: string[], cuisineTags?: string[], rating?: number, distanceKm?: number}} place
 * @param {ReturnType<typeof buildTasteProfile>} profile
 * @returns {{score: number, reasons: string[]}}
 */
function scorePlace(place, profile) {
  if (!place || !profile) return { score: 0, reasons: [] };
  const tags = place.cuisineTags || [];
  const reasons = [];
  let score = 0;

  // 1) Mutfak etiketi ağırlığı — en güçlü eşleşen etiketi gerekçe olarak sun.
  let cuisineContribution = 0;
  let bestTag = null;
  let bestTagWeight = 0;
  for (const tag of tags) {
    const w = profile.cuisineWeights.get(tag) || 0;
    cuisineContribution += w;
    if (w > bestTagWeight) { bestTagWeight = w; bestTag = tag; }
  }
  cuisineContribution = Math.min(cuisineContribution, SCORE.cuisineWeightCap);
  score += cuisineContribution;

  // 2) Profil favori mutfakları — etiket veya mekan adında geçiyorsa.
  const nameNorm = norm(place.name);
  let favoriteCuisineHit = null;
  for (const fav of profile.favoriteCuisines) {
    const inTag = tags.some((t) => norm(t) === fav || norm(t).includes(fav) || fav.includes(norm(t)));
    if (inTag || (nameNorm && nameNorm.includes(fav))) {
      favoriteCuisineHit = fav;
      score += W.favoriteCuisine;
      break;
    }
  }

  // 3) Beğenilen Google tipleri.
  if ((place.types || []).some((t) => profile.likedTypes.has(t))) {
    score += SCORE.likedTypeBonus;
  }

  // Mutfak temelli gerekçe (etiket eşleşmesi favori mutfak hit'ten önce gelir).
  if (bestTag && bestTagWeight > 0) {
    reasons.push(`Sevdiğin mutfak: ${bestTag}`);
  } else if (favoriteCuisineHit) {
    reasons.push('Damak tadına uygun');
  }

  // 4) Sık gidilen mekan → güçlü "tekrar?" sinyali.
  if (profile.frequentPlaceIds.has(place.placeId)) {
    score += SCORE.frequentBonus;
    reasons.push('Sık gittiğin yer');
  } else if (profile.triedPlaceIds.has(place.placeId)) {
    // Keşifte yeniliği teşvik etmek için daha önce denenmişe küçük ceza.
    score -= SCORE.triedPenalty;
  }

  // 5) Kalite + yakınlık ince ayarları.
  if ((place.rating ?? 0) >= SCORE.qualityHighRating) {
    score += SCORE.qualityBonus;
    if (reasons.length === 0) reasons.push('Yüksek puanlı');
  }
  if (typeof place.distanceKm === 'number') {
    const proximity = Math.max(0, 1 - place.distanceKm / SCORE.distanceFullKm);
    score += proximity * SCORE.distanceBonusMax;
  }

  return { score, reasons };
}

/**
 * Aday listesini kişisel skora göre azalan sıralar; her öğeye personalScore +
 * reasons ekler. Skoru pozitif olmayan (hiç sinyal eşleşmeyen) öğeler de korunur
 * ama sona düşer — böylece liste asla boşalmaz.
 *
 * @param {Array<object>} places mapPlaceToResultRow çıktısı satırları
 * @param {ReturnType<typeof buildTasteProfile>} profile
 * @returns {Array<object>} skorlanmış + sıralanmış kopya
 */
function rankForYou(places, profile) {
  return (places || [])
    .map((p) => {
      const { score, reasons } = scorePlace(p, profile);
      return { ...p, personalScore: score, reasons };
    })
    .sort((a, b) => b.personalScore - a.personalScore);
}

module.exports = { buildTasteProfile, scorePlace, rankForYou, W, SCORE };
