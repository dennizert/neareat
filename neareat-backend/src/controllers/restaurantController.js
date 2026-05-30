const prisma = require('../utils/prisma');
const { getNearbyRestaurants, getPlaceDetails, getPhotoUrl, passesQualityFilter, searchPlacesByText } = require('../services/googlePlaces');
const { haversineKm } = require('../utils/haversine');
const { isPremiumUser } = require('../utils/premiumCheck');
const { getLevel, STAR_LEVEL_DISCOUNTS } = require('../utils/stars');
const { deriveCuisineTags, parseCuisineTagFilter } = require('../utils/cuisineTags');
const { deriveFreshness } = require('../utils/freshnessTags');

const FREE_RADIUS_KM = parseInt(process.env.FREE_RADIUS_KM || '5');
const PREMIUM_RADIUS_KM = parseInt(process.env.PREMIUM_RADIUS_KM || '25');

// Keşfet listesi sıralama parametreleri
const HIGH_RATING_THRESHOLD = 4.5;   // ilk 15 sırada bu eşiğin altı yer almaz
const TOP_BUCKET_SIZE = 15;          // ilk N sıra "high-rated only"
const LIST_LIMIT = 60;               // toplam liste boyutu

/**
 * Sıralama için birleşik skor:
 *   - Rating (0..5): %45 ağırlık — yemek kalitesi öncelik
 *   - Mesafe (0..radius): %35 ağırlık — yakınlık keşif için önemli
 *   - Açıklık (true/false/unknown): %20 ağırlık — açık tercihli ama
 *     unknown nötr (0.5), kapalı sıfır
 * Çıktı: 0..1 arası (yüksek = daha iyi)
 */
function combinedRankingScore(place, maxDistanceKm) {
  const distScore = Math.max(0, 1 - (place._dist / maxDistanceKm));
  const ratingScore = (place.rating ?? 0) / 5;
  const openNow = place.opening_hours?.open_now;
  const openScore = openNow === true ? 1.0 : openNow === false ? 0.0 : 0.5;
  return ratingScore * 0.45 + distScore * 0.35 + openScore * 0.20;
}

function computeIsOpenFromOverride(override) {
  if (!override || typeof override !== 'object') return null;
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  // Railway runs UTC; restaurant hours are entered in Turkey local time (UTC+3)
  const turkey = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const day = override[days[turkey.getUTCDay()]];
  if (!day) return null;
  if (day.closed) return false;
  const [oh, om] = (day.open || '00:00').split(':').map(Number);
  const [ch, cm] = (day.close || '00:00').split(':').map(Number);
  const cur = turkey.getUTCHours() * 60 + turkey.getUTCMinutes();
  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  if (close <= open) return cur >= open || cur < close;
  return cur >= open && cur < close;
}

// Supported Google Places types for category tabs
const VALID_TYPES = new Set(['restaurant', 'cafe', 'meal_takeaway', 'meal_delivery', 'bakery', 'all']);

/**
 * Tek bir Google Places sonucunu API response satırına çevirir.
 * Discount + override hours + announcement gibi DB enrichment'i `dp` üzerinden uygular.
 * `distanceKm` getNearby'de hesaplanır; serbest metin aramada lat/lng yoksa null kalır.
 */
function mapPlaceToResultRow(place, dp, now, userLevel, distanceKm) {
  const instantActive = !!(dp?.discountActiveUntil && new Date(dp.discountActiveUntil) > now);
  const starDiscountPercent = dp?.discountEnabled && userLevel >= 2
    ? (STAR_LEVEL_DISCOUNTS[userLevel] ?? 0)
    : null;
  const hasDiscount = dp && (dp.discountEnabled || instantActive);
  const overrideIsOpen = dp?.openingHours ? computeIsOpenFromOverride(dp.openingHours) : null;
  const isOpenNow = overrideIsOpen !== null ? overrideIsOpen : (place.opening_hours?.open_now ?? null);
  const { minutesUntilClose, isNewlyOpened } = deriveFreshness(place, dp?.openingHours || null, now);
  return {
    placeId: place.place_id,
    name: place.name,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    priceLevel: place.price_level,
    types: place.types,
    isOpenNow,
    location: place.geometry?.location,
    distanceKm,
    photoUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
    cuisineTags: deriveCuisineTags(place),
    minutesUntilClose: isOpenNow === true ? minutesUntilClose : null,
    isNewlyOpened,
    discount: hasDiscount ? {
      starDiscountEnabled: !!dp.discountEnabled,
      starDiscountPercent,
      instantActive,
      instantPercent: instantActive ? dp.discountPercent : null,
      note: dp.discountNote,
      activeUntil: dp.discountActiveUntil,
    } : null,
    announcement: dp?.announcementActive ? dp.announcement : null,
    acceptsReservations: dp?.acceptsReservations ?? false,
  };
}

async function getNearby(req, res, next) {
  try {
    const { lat, lng, type = 'all', cuisineTag } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const placeType = VALID_TYPES.has(type) ? type : 'all';
    const cuisineFilter = parseCuisineTagFilter(cuisineTag);

    const premium = req.user ? await isPremiumUser(req.user.id) : false;
    const radiusKm = premium ? PREMIUM_RADIUS_KM : FREE_RADIUS_KM;
    const radiusMeters = radiusKm * 1000;

    let rawPlaces;
    if (placeType === 'all') {
      // 5 tip paralel çek, rankby=distance ile (AVM içi ve düşük puanlı yerler dahil)
      const [restaurants, cafes, takeaways, deliveries, bakeries] = await Promise.all([
        getNearbyRestaurants(userLat, userLng, radiusMeters, 'restaurant'),
        getNearbyRestaurants(userLat, userLng, radiusMeters, 'cafe'),
        getNearbyRestaurants(userLat, userLng, radiusMeters, 'meal_takeaway'),
        getNearbyRestaurants(userLat, userLng, radiusMeters, 'meal_delivery'),
        getNearbyRestaurants(userLat, userLng, radiusMeters, 'bakery'),
      ]);
      const seen = new Set();
      rawPlaces = [...restaurants, ...cafes, ...takeaways, ...deliveries, ...bakeries].filter((p) => {
        if (seen.has(p.place_id)) return false;
        seen.add(p.place_id);
        return true;
      });
    } else {
      rawPlaces = await getNearbyRestaurants(userLat, userLng, radiusMeters, placeType);
    }

    // Kalite filtresi (rating ≥ 2.4, en az 2 puanlama) + haversine + combined score
    const scored = rawPlaces
      .map((place) => {
        if (!place.geometry?.location) return null;
        if (!passesQualityFilter(place)) return null;
        if (cuisineFilter.length > 0) {
          const tags = deriveCuisineTags(place);
          if (!cuisineFilter.some((t) => tags.includes(t))) return null;
        }
        const _dist = haversineKm(userLat, userLng, place.geometry.location.lat, place.geometry.location.lng);
        if (_dist > radiusKm) return null;
        const enriched = { ...place, _dist };
        enriched._combinedScore = combinedRankingScore(enriched, radiusKm);
        return enriched;
      })
      .filter(Boolean);

    // İlk 15 sıra: yalnızca rating ≥ 4.5 (combined score'a göre).
    // Sonrası: kalan high-rated + tüm low-rated, combined score'a göre.
    const high = scored
      .filter((p) => (p.rating ?? 0) >= HIGH_RATING_THRESHOLD)
      .sort((a, b) => b._combinedScore - a._combinedScore);
    const low = scored
      .filter((p) => (p.rating ?? 0) < HIGH_RATING_THRESHOLD)
      .sort((a, b) => b._combinedScore - a._combinedScore);

    const topBucket = high.slice(0, TOP_BUCKET_SIZE);
    const restPool = [...high.slice(TOP_BUCKET_SIZE), ...low]
      .sort((a, b) => b._combinedScore - a._combinedScore);

    const filtered = [...topBucket, ...restPool].slice(0, LIST_LIMIT);

    // Attach discount + override hours from our DB for matching placeIds
    const placeIds = filtered.map((p) => p.place_id);
    const now = new Date();
    const userLevel = req.user ? getLevel(req.user.starCount).level : 1;
    const allProfiles = await prisma.restaurantProfile.findMany({
      where: { placeId: { in: placeIds }, status: 'APPROVED' },
      select: {
        placeId: true, discountEnabled: true, discountPercent: true,
        discountNote: true, discountActiveUntil: true,
        announcement: true, announcementActive: true, reservationUrl: true,
        openingHours: true, acceptsReservations: true,
      },
    });
    const discountMap = Object.fromEntries(allProfiles.map((p) => [p.placeId, p]));

    const results = filtered.map((place) =>
      mapPlaceToResultRow(place, discountMap[place.place_id] || null, now, userLevel, place._dist),
    );

    res.json({ results, radiusKm });
  } catch (err) {
    next(err);
  }
}

// Sprint-6 #82 — serbest metin / isim bazlı arama (Google Places Text Search).
// GET /api/places/search?q=...&lat=...&lng=...
// Konum bias 25 km; sonuçlar bias dışına da çıkabilir (kullanıcı uzaktaki bir
// mekanı arayabilir). Quality filter (rating + isim elemesi) uygulanır.
const SEARCH_RESULT_LIMIT = 20;

async function searchByText(req, res, next) {
  try {
    const { q, lat, lng, cuisineTag } = req.query;
    const query = String(q || '').trim();
    if (!query) return res.status(400).json({ error: 'q parametresi gerekli' });
    if (query.length < 2) return res.status(400).json({ error: 'En az 2 karakter girin' });

    const userLat = lat ? parseFloat(lat) : undefined;
    const userLng = lng ? parseFloat(lng) : undefined;
    const hasLocation = Number.isFinite(userLat) && Number.isFinite(userLng);
    const cuisineFilter = parseCuisineTagFilter(cuisineTag);

    const rawPlaces = await searchPlacesByText(
      query,
      hasLocation ? userLat : undefined,
      hasLocation ? userLng : undefined,
    );

    // Kalite + isim filtresi (passesQualityFilter içinde her ikisi de var)
    const filtered = rawPlaces
      .map((place) => {
        if (!place.geometry?.location) return null;
        if (!passesQualityFilter(place)) return null;
        if (cuisineFilter.length > 0) {
          const tags = deriveCuisineTags(place);
          if (!cuisineFilter.some((t) => tags.includes(t))) return null;
        }
        const distanceKm = hasLocation
          ? haversineKm(userLat, userLng, place.geometry.location.lat, place.geometry.location.lng)
          : null;
        return { ...place, _dist: distanceKm };
      })
      .filter(Boolean)
      .slice(0, SEARCH_RESULT_LIMIT);

    // DB enrichment — getNearby ile aynı shape
    const placeIds = filtered.map((p) => p.place_id);
    const now = new Date();
    const userLevel = req.user ? getLevel(req.user.starCount).level : 1;
    const profiles = placeIds.length
      ? await prisma.restaurantProfile.findMany({
          where: { placeId: { in: placeIds }, status: 'APPROVED' },
          select: {
            placeId: true, discountEnabled: true, discountPercent: true,
            discountNote: true, discountActiveUntil: true,
            announcement: true, announcementActive: true, reservationUrl: true,
            openingHours: true, acceptsReservations: true,
          },
        })
      : [];
    const discountMap = Object.fromEntries(profiles.map((p) => [p.placeId, p]));

    const results = filtered.map((place) =>
      mapPlaceToResultRow(place, discountMap[place.place_id] || null, now, userLevel, place._dist),
    );

    res.json({ results, query });
  } catch (err) {
    next(err);
  }
}

async function getDetails(req, res, next) {
  try {
    const { placeId } = req.params;
    const { lat, lng } = req.query;

    const [place, restaurantProfile, premium] = await Promise.all([
      getPlaceDetails(placeId),
      prisma.restaurantProfile.findFirst({
        where: { placeId, status: 'APPROVED' },
        include: {
          menuItems: {
            select: { id: true, data: true, mimeType: true, fileName: true, sortOrder: true, uploadedAt: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),
      isPremiumUser(req.user.id),
    ]);

    const now = new Date();
    const rp = restaurantProfile;
    const instantActive = !!(rp?.discountActiveUntil && new Date(rp.discountActiveUntil) > now);
    const userLevel = getLevel(req.user.starCount).level;
    const starDiscountPercent = rp?.discountEnabled && userLevel >= 2
      ? (STAR_LEVEL_DISCOUNTS[userLevel] ?? 0)
      : null;
    const hasDiscount = rp && (rp.discountEnabled || instantActive);

    const detail = {
      placeId,
      name: place.name,
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      priceLevel: place.price_level,
      types: place.types,
      formattedAddress: place.formatted_address,
      formattedPhoneNumber: place.formatted_phone_number,
      openingHours: place.opening_hours,
      location: place.geometry?.location,
      photos: (place.photos || []).map((p) => getPhotoUrl(p.photo_reference)),
      googleReviews: place.reviews || [],
      popularTimes: null,
      // Restaurant profile extras
      discount: hasDiscount ? {
        starDiscountEnabled: !!rp.discountEnabled,
        starDiscountPercent,
        instantActive,
        instantPercent: instantActive ? rp.discountPercent : null,
        note: rp.discountNote,
        activeUntil: rp.discountActiveUntil,
      } : null,
      announcement: rp?.announcementActive ? rp.announcement : null,
      reservationUrl: rp?.reservationUrl ?? null,
      openingHoursOverride: rp?.openingHours ?? null,
      acceptsReservations: rp?.acceptsReservations ?? false,
      restaurantId: rp?.id ?? null,
      // Menu only for premium users
      menu: premium && rp ? rp.menuItems : [],
      hasMenu: rp ? rp.menuItems.length > 0 : false,
    };

    if (lat && lng) {
      detail.distanceKm = haversineKm(
        parseFloat(lat),
        parseFloat(lng),
        place.geometry.location.lat,
        place.geometry.location.lng
      );
    }

    res.json(detail);
  } catch (err) {
    next(err);
  }
}

module.exports = { getNearby, getDetails, searchByText };
