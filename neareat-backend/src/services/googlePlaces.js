// Google Places entegrasyonu: yakındaki restoranlar (nearby), metin/isim araması (text),
// mekan detayı (details) ve rota (directions). Sonuçlar Redis'te tile/sorgu bazlı önbelleğe
// alınır (maliyet düşürme); kalite filtresi (passesQualityFilter) fırın/market/eczane gibi
// alakasız tipleri eler. Her cache-miss çağrısı SKU başına recordExternalCall ile harcama
// metriğine işlenir (S16-4 → googleDailyUsd alarmı).
const https = require('https');
const { cacheGet, cacheSet } = require('./redis');
const { recordExternalCall } = require('./metrics'); // S16-4 — Google harcama metriği
const { TimeoutError, readTimeoutEnv } = require('../utils/httpTimeout'); // S20-1
const { withRetry, isTransientNetworkError, DEFAULT_RETRIES } = require('../utils/retry'); // S20-2

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
// S16-4 — cache TTL/tile env ile ayarlanabilir; maliyet/güncellik dengesi. Nearby
// TTL varsayılanı 1sa→2sa'ya çıkarıldı (yoğun bölgede isabet artar; freshness sinyalleri
// minutesUntilClose/isNewlyOpened her istekte taze hesaplanır). Tile ondalığı 3=~110m.
const NEARBY_TTL = parseInt(process.env.REDIS_NEARBY_TTL || '7200');
const NEARBY_TILE_DECIMALS = parseInt(process.env.NEARBY_TILE_DECIMALS || '3', 10);
const DETAILS_TTL = parseInt(process.env.REDIS_PLACE_DETAILS_TTL || '86400');
const TEXT_SEARCH_TTL = parseInt(process.env.REDIS_TEXT_SEARCH_TTL || '1800');
const TEXT_SEARCH_BIAS_METERS = 25000;

// S20-1 — dış çağrı zaman aşımı. Zaman aşımsız bir Google çağrısı, upstream
// yanıt vermediğinde soketi süresiz açık tutar; yeterince birikirse istek havuzu
// tükenir ve keşif akışının tamamı kilitlenir. 8sn, Google Places'in normal yanıt
// süresinin belirgin üstünde — meşru yavaş yanıtları kesmez.
const HTTP_TIMEOUT_MS = readTimeoutEnv('GOOGLE_HTTP_TIMEOUT_MS', 8000);

// S16-4 — Google Places SKU başına yaklaşık $ (faturalandırma kademe-bağımlı; kaba
// tahmin, S16-2 metriği + googleDailyUsd alarmı için). Gerçek fatura Google Cloud'da.
const GOOGLE_COST = Object.freeze({
  nearby: 0.032,    // Nearby Search
  text: 0.032,      // Text Search
  details: 0.017,   // Place Details
  directions: 0.005,// Directions
});

// Gerçek (cache-miss) Google çağrısını metriğe yazar. Metrik asla akışı bozmamalı.
function recordGoogleCall(sku) {
  try { recordExternalCall('google', GOOGLE_COST[sku] || 0); } catch { /* ignore */ }
}

// ── S20-2: idempotent GET çağrıları için yeniden deneme ──────────────────────
// Yalnızca BU dosyadaki salt-okunur Google sorguları sarmalanır. Yan etkili
// çağrılar (e-posta gönderimi, AI üretimi, satın alma doğrulama) kapsam DIŞIDIR:
// böyle bir çağrının tekrarlanması çift e-posta / çift ücret üretir.
const RETRY_MAX = Number.isFinite(parseInt(process.env.GOOGLE_RETRY_MAX, 10))
  ? Math.max(0, parseInt(process.env.GOOGLE_RETRY_MAX, 10))
  : DEFAULT_RETRIES;

/** Upstream 5xx — geçici sunucu hatası, yeniden denenebilir. */
class UpstreamServerError extends Error {
  constructor(statusCode) {
    super(`Google Places upstream ${statusCode} döndü.`);
    this.name = 'UpstreamServerError';
    this.statusCode = statusCode;
  }
}

/**
 * Google'ın geçici sunucu hatası. Gövde HTTP 200 ile döner ama `status`
 * alanı `UNKNOWN_ERROR`'dur — Google'ın kendi dokümantasyonu bu durumda
 * isteğin tekrarlanmasını önerir.
 */
class TransientGoogleStatusError extends Error {
  constructor(status) {
    super(`Google Places geçici hata döndürdü: ${status}`);
    this.name = 'TransientGoogleStatusError';
    this.status = status;
  }
}

/**
 * Hangi hatalar yeniden denenir — allowlist.
 *
 * Kasıtlı olarak DIŞARIDA bırakılanlar: `OVER_QUERY_LIMIT` ve `REQUEST_DENIED`
 * (kota/kimlik sorunu — tekrar denemek yalnızca maliyeti ve yükü çarpar, sorunu
 * da maskeler), 4xx, ve JSON parse hataları (kalıcı, bozuk yanıt).
 * `ZERO_RESULTS` zaten hata değildir; hiç bu yola girmez.
 */
function isRetryableGoogleError(err) {
  return (
    isTransientNetworkError(err) ||
    err instanceof UpstreamServerError ||
    err instanceof TransientGoogleStatusError
  );
}

/**
 * Retry'lı Google Places çağrısı (S20-2).
 *
 * Denemeler tükendiğinde `UNKNOWN_ERROR` gövdesi çağırana AYNEN geri verilir —
 * fırlatılmaz. Böylece her çağrı yerinin kendi `status` kontrolü ve ona bağlı
 * davranışı (kimi yerde `throw`, `getRouteWaypoints`'te `return null`) bugünkü
 * gibi çalışmaya devam eder; retry tamamen şeffaf bir katman olarak kalır.
 *
 * @param {string} url
 * @returns {Promise<object>} parse edilmiş JSON gövdesi
 */
async function fetchGoogleJson(url) {
  let lastBody = null;

  try {
    return await withRetry(
      async () => {
        const body = await fetchJson(url);
        lastBody = body;
        if (body && body.status === 'UNKNOWN_ERROR') {
          throw new TransientGoogleStatusError(body.status);
        }
        return body;
      },
      { retries: RETRY_MAX, isRetryable: isRetryableGoogleError }
    );
  } catch (err) {
    if (err instanceof TransientGoogleStatusError && lastBody) return lastBody;
    throw err;
  }
}

/**
 * Google Places JSON çağrısı — TOPLAM süre bütçesiyle (S20-1).
 *
 * Bütçe kasıtlı olarak `req.setTimeout` (soketin BOŞTA kalma süresi) değil, açık bir
 * zamanlayıcıdır: düzenli ama çok yavaş veri gönderen bir upstream soket boşta
 * sayılmadığı için idle timeout'a hiç takılmaz, oysa istek yine de sonsuza yakın
 * sürebilir. Açık zamanlayıcı "bu istek en fazla şu kadar sürer" garantisi verir.
 *
 * Zaman aşımında soket kapatılır (`req.destroy`) ve ayırt edilebilir bir
 * `TimeoutError` fırlatılır (S20-2 retry kararı bunu kullanacak).
 *
 * @param {string} url
 * @param {number} [timeoutMs] toplam süre bütçesi (varsayılan GOOGLE_HTTP_TIMEOUT_MS)
 * @returns {Promise<object>} parse edilmiş JSON gövdesi
 */
function fetchJson(url, timeoutMs = HTTP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let req = null;

    // Tek seferlik sonuçlandırma. Zaman aşımı ile 'error' yarışabilir: destroy()
    // sonrasında soket bir ECONNRESET üretir ve buraya ikinci kez düşer — yutulur,
    // aksi halde çözülmüş bir promise ikinci kez reddedilmeye çalışılırdı.
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      // Soketi kapat — yanıtsız bağlantı havuzda asılı kalmasın.
      if (req && typeof req.destroy === 'function') req.destroy();
      settle(reject, new TimeoutError(timeoutMs, 'Google Places isteği'));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    req = https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        // 5xx = upstream'in geçici sunucu hatası; gövdeyi parse etmeye çalışmak
        // yerine yeniden denenebilir bir hata üret (S20-2). 2xx/4xx yolu bugünkü
        // gibi parse edilir — Google Places hataları zaten 200 + status alanıdır.
        if (res.statusCode >= 500) {
          settle(reject, new UpstreamServerError(res.statusCode));
          return;
        }
        try {
          settle(resolve, JSON.parse(data));
        } catch (e) {
          settle(reject, e);
        }
      });
    });

    if (req && typeof req.on === 'function') req.on('error', (e) => settle(reject, e));
  });
}

/**
 * Keşfet listesi için yakındaki yerleri çeker (S15-P1).
 *
 * rankby=distance: mesafeye göre sırala, AVM içi ve düşük puanlı yerleri kaçırma.
 * radius parametresi rankby=distance ile kullanılamaz — yarıçap filtresi controller'da
 * haversine ile uygulanır (radiusMeters yalnızca imza uyumu için tutulur).
 *
 * Neden tek sayfa (S15-P1): Google'ın next_page_token kuralı sayfalar arasında 2'şer
 * saniye zorunlu bekleme gerektiriyordu; `type=all` listesi 5 tipi paralel çekerken bu
 * beklemeler soğuk yüklemeyi ~4-5sn'ye çıkarıyordu. Liste zaten 60 ile sınırlı
 * (LIST_LIMIT) ve 5 tip × ~20 ilk-sayfa sonucu dedup sonrası bu sınırı fazlasıyla
 * dolduruyor; ekstra sayfalara değmez. Tek API çağrısı yapılır, 2sn beklemeler kalkar.
 */
async function getNearbyRestaurants(lat, lng, radiusMeters, type = 'restaurant') {
  // Cache anahtarı v4; tile ondalığı env ile ayarlanabilir (S16-4).
  const cacheKey = `nearby4:${lat.toFixed(NEARBY_TILE_DECIMALS)}:${lng.toFixed(NEARBY_TILE_DECIMALS)}:${type}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const baseUrl =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&rankby=distance&type=${type}&language=tr&key=${API_KEY}`;

  const data = await fetchGoogleJson(baseUrl);
  recordGoogleCall('nearby'); // S16-4 — gerçek (cache-miss) çağrı maliyeti
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places Nearby Search error: ${data.status}`);
  }

  // Yalnızca ilk sayfa — next_page_token ve 2sn beklemeleri kasıtlı olarak atlanır.
  const results = data.results || [];
  await cacheSet(cacheKey, results, NEARBY_TTL);
  return results;
}

/**
 * Fast mode — tek sayfa, pagination delay'i yok (Sprint-2 Task #1).
 *
 * AI öneri / grup akışı için max ~20 aday yeterli; tek API çağrısı yapar ve ayrı
 * cache anahtarı kullanır. (S15-P1'den beri `getNearbyRestaurants` de tek sayfa;
 * bu fonksiyon farklı cache anahtarı + AI akışına özel kullanım için ayrı tutulur.)
 *
 * Cache key: `nearbyFast:{lat3}:{lng3}:{type}` (liste cache'iyle çakışmaz)
 */
async function getNearbyRestaurantsFast(lat, lng, type = 'restaurant') {
  const cacheKey = `nearbyFast:${lat.toFixed(NEARBY_TILE_DECIMALS)}:${lng.toFixed(NEARBY_TILE_DECIMALS)}:${type}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&rankby=distance&type=${type}&language=tr&key=${API_KEY}`;

  const data = await fetchGoogleJson(url);
  recordGoogleCall('nearby'); // S16-4
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
  const cacheKey = `placesTextV4:${q.toLocaleLowerCase('tr-TR')}:${latKey}:${lngKey}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  // "restoran " öneki: Google'ın "Didim", "Kilis" gibi bilinen yer adlarını
  // şehir sorgusu değil restoran isim araması olarak yorumlaması için.
  const googleQuery = `restoran ${q}`;

  let url =
    `https://maps.googleapis.com/maps/api/place/textsearch/json` +
    `?query=${encodeURIComponent(googleQuery)}&type=restaurant&language=tr&key=${API_KEY}`;
  if (typeof lat === 'number' && typeof lng === 'number') {
    url += `&location=${lat},${lng}&radius=${TEXT_SEARCH_BIAS_METERS}`;
  }

  const data = await fetchGoogleJson(url);
  recordGoogleCall('text'); // S16-4
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

  const data = await fetchGoogleJson(url);
  recordGoogleCall('directions'); // S16-4

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

  const data = await fetchGoogleJson(url);
  recordGoogleCall('details'); // S16-4
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

// Google Places `types` ile yiyecek-dışı eleme (isim listesi bunları yakalayamıyor;
// ör. "Wings Ankara" adlı bir plaza isimde anahtar kelime taşımaz). Aşağıdaki
// tiplerden biri varsa, yer 'restaurant' tipini de taşısa bile (karma kullanımlı
// plaza/iş merkezi/güzellik vb.) elenir.
const NON_FOOD_TYPES = new Set([
  'lodging',
  'premise', // adlandırılmış bina/plaza → genelde restoran değil
  'real_estate_agency',
  'beauty_salon', 'hair_care', 'spa', 'nail_salon',
  'gym', 'doctor', 'dentist', 'hospital', 'pharmacy', 'physiotherapist',
  'school', 'university', 'primary_school', 'secondary_school',
  'bank', 'atm', 'finance', 'insurance_agency', 'accounting', 'lawyer',
  'car_repair', 'car_dealer', 'car_wash', 'gas_station',
  'shopping_mall', 'department_store', 'furniture_store', 'hardware_store',
  'clothing_store', 'shoe_store', 'electronics_store', 'home_goods_store',
  'grocery_or_supermarket', 'supermarket', 'convenience_store',
  'storage', 'moving_company', 'electrician', 'plumber', 'painter',
  'veterinary_care', 'pet_store',
  'travel_agency', 'local_government_office', 'courthouse', 'police',
  'church', 'mosque', 'hindu_temple', 'synagogue', 'place_of_worship',
]);

// Gerçek bir yeme-içme tipi (en az biri olmalı). `types` mevcutsa zorunludur.
const FOOD_TYPES = new Set([
  'restaurant', 'cafe', 'bakery', 'meal_takeaway', 'meal_delivery', 'bar', 'food',
]);

// Anlamlı bir ada sahip mi? Normalize edilmiş adda en az 2 harf olmalı —
// ".." / "-" / yalnızca emoji gibi çöp kayıtları eler.
function hasMeaningfulName(name) {
  return normalizeName(name).replace(/[^a-z]/g, '').length >= 2;
}

function passesQualityFilter(place) {
  if (!hasMeaningfulName(place?.name)) return false;
  if (isExcludedByName(place?.name)) return false;
  // Tip bazlı eleme: yiyecek-dışı tip varsa ele; `types` varsa en az bir yeme-içme tipi şart.
  const types = Array.isArray(place?.types) ? place.types : [];
  if (types.some((t) => NON_FOOD_TYPES.has(t))) return false;
  if (types.length > 0 && !types.some((t) => FOOD_TYPES.has(t))) return false;
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
  hasMeaningfulName,
  normalizeName,
  NON_FOOD_TYPES,
  FOOD_TYPES,
  EXCLUDED_NAME_KEYWORDS,
  QUALITY_MIN_RATING,
  QUALITY_MIN_USER_RATINGS,
  LONG_ROUTE_THRESHOLD_KM,
};
