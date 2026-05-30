const https = require('https');
const { cacheGet, cacheSet } = require('./redis');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const NEARBY_TTL = parseInt(process.env.REDIS_NEARBY_TTL || '3600');
const DETAILS_TTL = parseInt(process.env.REDIS_PLACE_DETAILS_TTL || '86400');
const TEXT_SEARCH_TTL = parseInt(process.env.REDIS_TEXT_SEARCH_TTL || '1800');
const TEXT_SEARCH_BIAS_METERS = 25000;

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

/**
 * İsim/serbest metin araması — Google Places Text Search (Sprint-6 #82).
 *
 * "Tarihi yarımadada pizza" gibi sorgular için kullanılır. Lat/lng verilirse
 * konum bias (25 km) uygulanır — sonuçlar bias dışına da çıkabilir, kullanıcı
 * çok uzaktaki bilinen bir mekanı arayabilir. Kalite filtresi (rating + isim
 * elemesi) controller katmanında uygulanır.
 *
 * Cache key: `placesText:{lower-q}:{lat3}:{lng3}` (lat/lng yoksa "x")
 */
async function searchPlacesByText(query, lat, lng) {
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return [];

  const latKey = typeof lat === 'number' ? lat.toFixed(3) : 'x';
  const lngKey = typeof lng === 'number' ? lng.toFixed(3) : 'x';
  const cacheKey = `placesTextV3:${q.toLocaleLowerCase('tr-TR')}:${latKey}:${lngKey}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  let url =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(q)}&type=food&language=tr&key=${API_KEY}`;
  if (typeof lat === 'number' && typeof lng === 'number') {
    url += `&location=${lat},${lng}&radius=${TEXT_SEARCH_BIAS_METERS}`;
  }

  const data = await fetchJson(url);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places Text Search error: ${data.status}`);
  }

  const results = data.results || [];
  await cacheSet(cacheKey, results, TEXT_SEARCH_TTL);
  return results;
}

const ROUTE_WAYPOINTS_TTL = 3600; // 1 saat — rota sık değişmez

// Uzun rotada zone-dağıtım eşiği. ≥300 km'lik rotalarda orta 4x segment
// 3 eşit zone'a bölünür ve waypoint'ler zone midpoint'lerine konur.
const LONG_ROUTE_THRESHOLD_KM = 300;

/**
 * Google Directions API → rota boyunca arama noktaları döner.
 *
 * Mesafe katmanları (D = toplam km):
 *   ≤ 20 km                                : 1 waypoint @ %50, zone yok
 *   20 < D < LONG_ROUTE_THRESHOLD_KM       : 3 waypoint @ %25/%50/%75, zone yok
 *   ≥ LONG_ROUTE_THRESHOLD_KM (300)        : 3 waypoint @ %33/%50/%67 (3 zone
 *                                            midpoint), her birinde zoneIndex
 *                                            etiketi → orta 4x stretch'in
 *                                            3 eşit zone'una karşılık
 *
 * Tüm modlarda "ortadaki yarı" (D/4 → 3D/4 = 2x → 6x) içinde arama yapılır,
 * çıkış/varışa yakın yerler kapsam dışında kalır.
 *
 * @returns {{
 *   waypoints: Array<{
 *     lat: number, lng: number,
 *     zoneIndex: number | null,        // 1,2,3 (long route) ya da null
 *     distanceFromStartKm: number
 *   }>,
 *   totalDistanceKm: number,
 *   totalDurationMin: number,
 *   isLongRoute: boolean,              // ≥300 km flag
 *   zoneCount: number,                 // long → 3, others → 0
 *   xKm: number,                       // x = D/8 (long route min-gap için)
 * } | null}
 */
async function getRouteWaypoints(originLat, originLng, destLat, destLng) {
  // v3: zone metadata eklendi — cache key bump
  const cacheKey = `routeWaypoints3:${originLat.toFixed(3)}:${originLng.toFixed(3)}:${destLat.toFixed(3)}:${destLng.toFixed(3)}`;
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

  const isLongRoute = totalDistanceKm >= LONG_ROUTE_THRESHOLD_KM;
  const xKm = totalDistanceKm / 8;

  // Target distances + zone tags (sırayla aynı index'te)
  let targets;
  let zoneTags;
  if (isLongRoute) {
    // 3 zone midpoint: orta 4x (2x..6x) içinde 3 eşit zone
    // Zone midpoint'leri: 2.67x, 4x, 5.33x → D'nin %33.3, %50, %66.7'si
    targets = [totalDistanceM * (1 / 3), totalDistanceM * 0.5, totalDistanceM * (2 / 3)];
    zoneTags = [1, 2, 3];
  } else if (totalDistanceKm > 20) {
    // Mevcut: 3 waypoint orta yarıda, zone yok
    targets = [totalDistanceM * 0.25, totalDistanceM * 0.5, totalDistanceM * 0.75];
    zoneTags = [null, null, null];
  } else {
    // Çok kısa: tek waypoint
    targets = [totalDistanceM * 0.5];
    zoneTags = [null];
  }

  const waypoints = [];
  let cumDist = 0;
  let targetIdx = 0;
  for (const step of allSteps) {
    if (targetIdx >= targets.length) break;
    cumDist += step.distance.value;
    if (cumDist >= targets[targetIdx]) {
      waypoints.push({
        lat: step.end_location.lat,
        lng: step.end_location.lng,
        zoneIndex: zoneTags[targetIdx],
        distanceFromStartKm: Math.round((cumDist / 1000) * 10) / 10,
      });
      targetIdx++;
    }
  }

  const result = {
    waypoints,
    totalDistanceKm,
    totalDurationMin,
    isLongRoute,
    zoneCount: isLongRoute ? 3 : 0,
    xKm,
  };
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

/**
 * Google Places opening_hours.periods formatına göre belirli bir gün+saatte açık mı kontrol eder.
 *
 * @param {Array} periods - Place Details opening_hours.periods dizisi
 * @param {number} dayOfWeek - 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi (lokal saat)
 * @param {string} timeHHMM  - "HHMM" formatında lokal saat (örn. "1430")
 * @returns {boolean|null} true=açık, false=kapalı, null=belirsiz (periods eksik)
 */
function isOpenAtTime(periods, dayOfWeek, timeHHMM) {
  if (!Array.isArray(periods) || periods.length === 0) return null;

  // 24/7: tek eleman, close yok
  if (periods.length === 1 && !periods[0].close) return true;

  for (const period of periods) {
    if (!period.open) continue;
    const openDay  = period.open.day;
    const openTime = period.open.time;
    if (!period.close) continue;
    const closeDay  = period.close.day;
    const closeTime = period.close.time;

    if (openDay === closeDay) {
      // Aynı gün kapanıyor
      if (openDay === dayOfWeek && timeHHMM >= openTime && timeHHMM < closeTime) return true;
    } else {
      // Gece yarısını geçiyor
      if (openDay === dayOfWeek && timeHHMM >= openTime) return true;
      if (closeDay === dayOfWeek && timeHHMM < closeTime) return true;
    }
  }
  return false;
}

/**
 * Google kalite filtresi — tüm liste ve önerilerde ortak eşik.
 * Reject if:
 *   - user_ratings_total yoksa veya < MIN_USER_RATINGS (2)
 *   - rating yoksa veya < MIN_RATING (2.4)
 *
 * Bu filtre Keşfet listesi, "Şimdi ne yesem?" ve "Yolda ne yesem?" akışlarında
 * uygulanır. Henüz puanlanmamış (yeni) yerler de elenir — kullanıcı açık talebi.
 */
const QUALITY_MIN_RATING = 2.4;
const QUALITY_MIN_USER_RATINGS = 2;

/**
 * İsim bazlı dışlama — restoran olmayan/istenmeyen mekanlar.
 * Google "restaurant"/"food" tipi bazen fırın, market, büfe, oyun salonu gibi
 * yerleri döndürüyor; isimde bu anahtar kelimeler geçiyorsa eleriz.
 *
 * Eşleştirme Türkçe karakter + büyük/küçük harf duyarsız (normalizeName ile ASCII'ye
 * indirgenir). Anahtar kelime, sözcük başında (kelime sınırı) aranır ve yalnızca
 * Türkçe ek (ünlü ya da 's' ile başlayan) gelebilir; başka bir ünsüz gelirse eşleşmez.
 * Böylece "Kıraathanesi/Fırını/Marketi/Büfesi" yakalanır ama "Bayındır" (bayi+n),
 * "Oyuncak" (oyun+c) gibi farklı kökler yanlışlıkla elenmez. "supermarket" ayrı listelenir.
 */
const EXCLUDED_NAME_KEYWORDS = [
  // bayi
  'bayi', 'dealer',
  // kıraathane / kahvehane (geleneksel kahvehane tipi mekanlar)
  'kiraathane', 'kirathane', 'kahvehane', 'cayhane',
  // çay bahçesi
  'cay bahcesi', 'cay evi', 'tea garden', 'tea house', 'teahouse',
  // ekmek
  'ekmek', 'ekmekci', 'bread',
  // fırın
  'firin', 'bakery',
  // pilates
  'pilates',
  // studio / stüdyo
  'studio', 'studyo',
  // büfe
  'bufe',
  // market
  'market', 'supermarket',
  // playstation
  'playstation',
  // oyun / game
  'oyun', 'game', 'gaming',

  // ─── Grup A: yiyecek-dışı hizmet/dükkan ───
  // Not: bare 'salon' tarafsız ("Kebap Salonu", "Çay Salonu" gibi yemek bağlamlarına
  // çakışıyordu). Yerine spesifik kuaför + güzellik salonu ifadeleri kullanılıyor.
  'berber', 'kuafor', 'guzellik salonu', 'barber', 'hairdresser',
  'eczane', 'pharmacy',
  'gym', 'fitness', 'crossfit', 'spor salonu',
  'banka', 'bank',
  'akaryakit', 'benzin', 'benzinlik', 'petrol', 'gas station', 'fuel',
  'hastane', 'klinik', 'klinig', 'hospital', 'clinic', 'dental',
  'okul', 'kurs', 'dershane', 'akademi', 'kolej', 'lise', 'universite',
  'school', 'course', 'academy', 'college', 'university',
  'emlak', 'emlakci', 'gayrimenkul', 'real estate',
  'veteriner', 'veterinary',
  'optik', 'optician', 'gozluk', 'gozlukcu',
  'kutuphane', 'library',
  'kuyumcu', 'kuyumculuk', 'jeweler', 'jewellery', 'jewelry',
  'mobilya', 'furniture', 'nalbur', 'hirdavat', 'hardware', 'kirtasiye', 'stationery',
  'giyim', 'butik', 'magaza', 'boutique', 'store', 'clothing',
  'cicek', 'cicekci', 'florist',
  'kres', 'anaokulu', 'kindergarten', 'nursery',

  // ─── Grup B: mekan/eğlence (restoran değil) ───
  'otel', 'hotel', 'motel', 'pansiyon', 'hostel',
  'dugun', 'dugun salonu', 'banquet', 'wedding',
  'avm', 'mall', 'pasaj', 'alisveris merkezi',
  'bilardo', 'bowling', 'langirt', 'snooker',
  'internet kafe', 'internet cafe', 'netcafe',
  'nargile', 'shisha', 'hookah',
  'ofis', 'office', 'plaza', 'is merkezi', 'business center',

  // ─── Grup C: dükkan/gıda satışı (yeme-içme değil) ───
  'kasap', 'butcher',
  'manav', 'greengrocer',
  'sarkuteri', 'delicatessen',
  'kuruyemis', 'kuru yemis',
  'tekel', 'icki', 'liquor',

  // ─── Grup D: otomotiv / teknik servis ───
  // 'oto': oto+ünsüz ("otobus","otopark","otomatik") yakalamaz; "Oto Tamir/Servis" vs gibi kalıpları yakalar
  'oto', 'otomotiv', 'egzoz', 'mekanik', 'elektrik', 'iklimlendirme', 'muhendislik',

  // ─── Grup E: güzellik / eğlence / ticaret ───
  'spa', 'club', 'pazarlama', 'kamping', 'hali', 'petshop',
];

function normalizeName(s) {
  return String(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/[ÂâÄä]/g, 'a').replace(/[Îîïİ]/g, 'i').replace(/[Ûûü]/g, 'u')
    .toLowerCase();
}

// Anahtar kelimeleri normalize edip regex'e derle (tek seferlik).
// \b<kw> = sözcük başı; (?![bcdf...]) = ardından 's'/ünlü dışında ünsüz gelmesin (ek toleransı).
const EXCLUDED_NAME_PATTERNS = EXCLUDED_NAME_KEYWORDS.map((kw) => {
  const norm = normalizeName(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${norm}(?![bcdfghjklmnpqrtvwxyz])`);
});

function isExcludedByName(name) {
  const norm = normalizeName(name);
  if (!norm) return false;
  return EXCLUDED_NAME_PATTERNS.some((re) => re.test(norm));
}

function passesQualityFilter(place) {
  if (isExcludedByName(place?.name)) return false;
  const total = place?.user_ratings_total;
  const rating = place?.rating;
  if (typeof total !== 'number' || total < QUALITY_MIN_USER_RATINGS) return false;
  if (typeof rating !== 'number' || rating < QUALITY_MIN_RATING) return false;
  return true;
}

module.exports = {
  getNearbyRestaurants,
  getNearbyRestaurantsFast,
  searchPlacesByText,
  getRouteWaypoints,
  getPlaceDetails,
  getPhotoUrl,
  isOpenAtTime,
  passesQualityFilter,
  isExcludedByName,
  normalizeName,
  EXCLUDED_NAME_KEYWORDS,
  QUALITY_MIN_RATING,
  QUALITY_MIN_USER_RATINGS,
  LONG_ROUTE_THRESHOLD_KM,
};
