const https = require('https');
const { cacheGet, cacheSet } = require('./redis');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const NEARBY_TTL = parseInt(process.env.REDIS_NEARBY_TTL || '3600');
const DETAILS_TTL = parseInt(process.env.REDIS_PLACE_DETAILS_TTL || '86400');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function getNearbyRestaurants(lat, lng, radiusMeters, type = 'restaurant') {
  // rankby=distance: mesafeye göre sırala, AVM içi ve düşük puanlı yerleri kaçırma
  // radius parametresi rankby=distance ile kullanılamaz — filtreleme controller'da yapılır
  const cacheKey = `nearby3:${lat.toFixed(3)}:${lng.toFixed(3)}:${type}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const baseUrl =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&rankby=distance&type=${type}&language=tr&key=${API_KEY}`;

  const data = await fetchJson(baseUrl);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places Nearby Search error: ${data.status}`);
  }

  let results = data.results || [];

  // Sayfa 2 — Google next_page_token için 2 saniyelik bekleme zorunlu
  if (data.next_page_token) {
    await new Promise(r => setTimeout(r, 2000));
    const page2 = await fetchJson(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?pagetoken=${data.next_page_token}&key=${API_KEY}`
    );
    if (page2.status === 'OK') {
      results = [...results, ...(page2.results || [])];

      // Sayfa 3
      if (page2.next_page_token) {
        await new Promise(r => setTimeout(r, 2000));
        const page3 = await fetchJson(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
          `?pagetoken=${page2.next_page_token}&key=${API_KEY}`
        );
        if (page3.status === 'OK') {
          results = [...results, ...(page3.results || [])];
        }
      }
    }
  }

  await cacheSet(cacheKey, results, NEARBY_TTL);
  return results;
}

/**
 * Fast mode — tek sayfa, pagination delay'i yok (Sprint-2 Task #1).
 *
 * `getNearbyRestaurants` 3 sayfa çekiyor (max 60 sonuç, 2× 2sn delay = +4sn).
 * AI öneri için max 20 aday yeterli, ekstra sayfalara değmez. Bu fonksiyon
 * tek API çağrısı yapar (max 20 sonuç) ve cache pattern korur.
 *
 * Mevcut `getNearbyRestaurants` /api/restaurants/nearby endpoint'i için
 * (60 sonuç gerektiriyor) kalır — dokunulmamış.
 *
 * Cache key: `nearbyFast:{lat3}:{lng3}:{type}` (paralel data ile çakışmaz)
 */
async function getNearbyRestaurantsFast(lat, lng, type = 'restaurant') {
  const cacheKey = `nearbyFast:${lat.toFixed(3)}:${lng.toFixed(3)}:${type}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&rankby=distance&type=${type}&language=tr&key=${API_KEY}`;

  const data = await fetchJson(url);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places Nearby Search error: ${data.status}`);
  }

  const results = data.results || [];
  await cacheSet(cacheKey, results, NEARBY_TTL);
  return results;
}

const ROUTE_WAYPOINTS_TTL = 3600; // 1 saat — rota sık değişmez

/**
 * Google Directions API → rota boyunca arama noktaları döner.
 *
 * Arama bölgesi: rotanın orta yarısı (%25 → %75).
 * D = toplam mesafe, x = D/4 olduğunda çıkıştan x km sonrası ile
 * varıştan x km öncesi arasındaki segment aranır.
 *
 *   ≤ 20 km: 1 waypoint (%50 — orta nokta)
 *   > 20 km: 3 waypoint (%25, %50, %75)
 *
 * Örnek (800 km): 200 km, 400 km, 600 km noktaları → çıkış/varışa yakın
 * lokasyonlar hiç dahil edilmez.
 *
 * @returns {{ waypoints: Array<{lat,lng}>, totalDistanceKm: number, totalDurationMin: number } | null}
 *   null → rota bulunamadı (geçersiz koordinat, ulaşılamaz)
 */
async function getRouteWaypoints(originLat, originLng, destLat, destLng) {
  // v2: orta-bölge mantığı — cache key güncellendi
  const cacheKey = `routeWaypoints2:${originLat.toFixed(3)}:${originLng.toFixed(3)}:${destLat.toFixed(3)}:${destLng.toFixed(3)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${originLat},${originLng}&destination=${destLat},${destLng}` +
    `&mode=driving&language=tr&key=${API_KEY}`;

  const data = await fetchJson(url);

  if (data.status !== 'OK' || !data.routes?.length) {
    return null;
  }

  const route = data.routes[0];
  const allSteps = route.legs.flatMap((leg) => leg.steps);

  const totalDistanceM = route.legs.reduce((s, l) => s + l.distance.value, 0);
  const totalDurationS = route.legs.reduce((s, l) => s + l.duration.value, 0);
  const totalDistanceKm = Math.round((totalDistanceM / 1000) * 10) / 10;
  const totalDurationMin = Math.round(totalDurationS / 60);

  // Sadece ortadaki %50'yi tara: çıkıştan D/4 sonrası — varıştan D/4 öncesi
  const targets = totalDistanceKm > 20
    ? [totalDistanceM * 0.25, totalDistanceM * 0.5, totalDistanceM * 0.75]
    : [totalDistanceM * 0.5];

  const waypoints = [];
  let cumDist = 0;
  let targetIdx = 0;
  for (const step of allSteps) {
    if (targetIdx >= targets.length) break;
    cumDist += step.distance.value;
    if (cumDist >= targets[targetIdx]) {
      waypoints.push({ lat: step.end_location.lat, lng: step.end_location.lng });
      targetIdx++;
    }
  }

  const result = { waypoints, totalDistanceKm, totalDurationMin };
  await cacheSet(cacheKey, result, ROUTE_WAYPOINTS_TTL);
  return result;
}

async function getPlaceDetails(placeId) {
  const cacheKey = `place:${placeId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // popular_times Google Places API'de geçersiz field — kaldırıldı
  const fields = [
    'name', 'rating', 'user_ratings_total', 'formatted_phone_number',
    'formatted_address', 'opening_hours', 'photos', 'price_level',
    'geometry', 'types', 'reviews',
  ].join(',');

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}&fields=${fields}&language=tr&key=${API_KEY}`;

  const data = await fetchJson(url);
  if (data.status !== 'OK') {
    throw new Error(`Google Places Details error: ${data.status}`);
  }

  const result = data.result;
  await cacheSet(cacheKey, result, DETAILS_TTL);
  return result;
}

function getPhotoUrl(photoReference, maxWidth = 800) {
  return (
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${API_KEY}`
  );
}

module.exports = { getNearbyRestaurants, getNearbyRestaurantsFast, getRouteWaypoints, getPlaceDetails, getPhotoUrl };
