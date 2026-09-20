'use strict';

// S18-3 devamı: check-in'in ziyaret kanıtı olarak sayılabilmesi için konum doğrulaması.
//
// NEDEN: `CheckIn` satırı `starGuards.hasVerifiedVisit`in iki kanıtından biri, o da
// REVIEW/RATING yıldızlarını açıyor, yıldız da özellik erişimini (LEVEL_ACCESS).
// Eskiden `POST /api/checkin` gövdedeki placeId'yi hiç doğrulamadan yazıyordu; tek
// istekle "doğrulanmış ziyaret" üretip seviye atlamak mümkündü.
//
// DÜRÜST SINIR: koordinat istemciden geliyor, yani sahtelenebilir. Bu değişiklik
// saldırıyı ortadan kaldırmıyor — "önemsiz" seviyeden "kasıtlı sahtecilik" seviyesine
// çıkarıyor ve denetim izi (lat/lng/mesafe/mocked) bırakıyor. Sunucu tarafı gerçek
// kanıt için tek yol rezervasyon akışı (attended=true, işletme onaylı).
//
// Saf çekirdek (parseCoord/isWithinRadius) DB ve ağdan bağımsız test edilebilsin diye
// ayrı export edilir.

const { haversineKm } = require('./haversine');

// Google Places geometry'si ile telefon GPS'i arasındaki doğal sapma + kentsel kanyon
// hatası için tolerans. Çok dar tutulursa gerçek ziyaretler reddedilir.
const DEFAULT_MAX_DISTANCE_M = parseInt(process.env.CHECKIN_MAX_DISTANCE_METERS || '250', 10);

/**
 * Gövdeden gelen koordinatı doğrular. Saf.
 * Sayıya çevrilemeyen, NaN/Infinity olan veya aralık dışı değerler `null` döner.
 * @returns {{lat: number, lng: number}|null}
 */
function parseCoord(rawLat, rawLng) {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  // (0,0) Gulf of Guinea — pratikte "koordinat yok" anlamına gelen sentinel değer.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * Mesafe yarıçap içinde mi? Saf. (maxMeters ≤ 0 → doğrulama kapalı → true)
 */
function isWithinRadius(distanceMeters, maxMeters = DEFAULT_MAX_DISTANCE_M) {
  if (!maxMeters || maxMeters <= 0) return true;
  return distanceMeters <= maxMeters;
}

/**
 * Google Places detay yanıtından koordinat çıkarır. Saf.
 * @returns {{lat: number, lng: number}|null}
 */
function extractPlaceCoord(details) {
  const loc = details?.geometry?.location;
  if (!loc) return null;
  return parseCoord(loc.lat, loc.lng);
}

/**
 * Check-in'i doğrular ve kalıcılaştırılacak alanları döner.
 *
 * Asla FIRLATMAZ: Google Places çağrısı başarısız olursa check-in'in kendisi (sosyal
 * özellik — arkadaş bildirimi) çalışmaya devam etmeli, yalnızca `verified` false kalır.
 * Bu bilinçli olarak fail-closed: doğrulayamadığımız bir ziyaret yıldız kazandırmaz.
 *
 * @param {object} args
 * @param {number|string} [args.lat] istemciden gelen enlem
 * @param {number|string} [args.lng] istemciden gelen boylam
 * @param {boolean} [args.mocked] Android expo-location `mocked` bayrağı
 * @param {string} args.placeId
 * @param {(placeId: string) => Promise<object>} args.getPlaceDetails
 * @param {number} [args.maxMeters]
 * @returns {Promise<{verified: boolean, lat: number|null, lng: number|null,
 *                    distanceMeters: number|null, mocked: boolean, reason: string}>}
 */
async function verifyCheckinLocation({
  lat,
  lng,
  mocked = false,
  placeId,
  getPlaceDetails,
  maxMeters = DEFAULT_MAX_DISTANCE_M,
}) {
  const base = { verified: false, lat: null, lng: null, distanceMeters: null, mocked: !!mocked };

  const userCoord = parseCoord(lat, lng);
  // Eski mobil sürümler koordinat göndermiyor. Check-in yine oluşur (sosyal özellik
  // bozulmaz) ama ziyaret kanıtı sayılmaz.
  if (!userCoord) return { ...base, reason: 'no_coords' };

  // Konumu her hâlükârda kaydet — reddedilen denemeler de denetim verisi.
  base.lat = userCoord.lat;
  base.lng = userCoord.lng;

  // Sahte konum uygulaması bildirildiyse doğrulama yok. Bayrak istemciden geldiği için
  // dürüst istemciyi yakalar, saldırganı değil; yine de sinyali kaydediyoruz.
  if (mocked) return { ...base, reason: 'mocked_location' };

  let placeCoord = null;
  try {
    placeCoord = extractPlaceCoord(await getPlaceDetails(placeId));
  } catch {
    return { ...base, reason: 'place_lookup_failed' };
  }
  if (!placeCoord) return { ...base, reason: 'place_has_no_geometry' };

  const distanceMeters = Math.round(
    haversineKm(userCoord.lat, userCoord.lng, placeCoord.lat, placeCoord.lng) * 1000,
  );
  base.distanceMeters = distanceMeters;

  if (!isWithinRadius(distanceMeters, maxMeters)) {
    return { ...base, reason: 'too_far' };
  }
  return { ...base, verified: true, reason: 'ok' };
}

module.exports = {
  DEFAULT_MAX_DISTANCE_M,
  parseCoord,
  isWithinRadius,
  extractPlaceCoord,
  verifyCheckinLocation,
};
