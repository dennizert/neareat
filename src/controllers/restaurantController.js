const prisma = require('../utils/prisma');
const { getNearbyRestaurants, getPlaceDetails, getPhotoUrl } = require('../services/googlePlaces');
const { haversineKm } = require('../utils/haversine');
const { isPremiumUser } = require('../utils/premiumCheck');
const { getLevel, STAR_LEVEL_DISCOUNTS } = require('../utils/stars');

const FREE_RADIUS_KM = parseInt(process.env.FREE_RADIUS_KM || '5');
const PREMIUM_RADIUS_KM = parseInt(process.env.PREMIUM_RADIUS_KM || '25');

// Supported Google Places types for category tabs
const VALID_TYPES = new Set(['restaurant', 'cafe', 'meal_takeaway', 'meal_delivery', 'bakery', 'all']);

async function getNearby(req, res, next) {
  try {
    const { lat, lng, type = 'all' } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const placeType = VALID_TYPES.has(type) ? type : 'all';

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

    const filtered = rawPlaces
      .filter((place) => {
        if (!place.geometry?.location) return false;
        const d = haversineKm(userLat, userLng, place.geometry.location.lat, place.geometry.location.lng);
        return d <= radiusKm;
      })
      .sort((a, b) => {
        const da = haversineKm(userLat, userLng, a.geometry.location.lat, a.geometry.location.lng);
        const db = haversineKm(userLat, userLng, b.geometry.location.lat, b.geometry.location.lng);
        return da - db;
      })
      .slice(0, 60);

    // Attach discount info from our DB for matching placeIds
    const placeIds = filtered.map((p) => p.place_id);
    const now = new Date();
    const userLevel = req.user ? getLevel(req.user.starCount).level : 1;
    const discountProfiles = await prisma.restaurantProfile.findMany({
      where: {
        placeId: { in: placeIds },
        status: 'APPROVED',
        OR: [{ discountEnabled: true }, { discountActiveUntil: { gt: now } }],
      },
      select: {
        placeId: true, discountEnabled: true, discountPercent: true,
        discountNote: true, discountActiveUntil: true,
        announcement: true, announcementActive: true, reservationUrl: true,
      },
    });
    const discountMap = Object.fromEntries(discountProfiles.map((p) => [p.placeId, p]));

    const results = filtered.map((place) => {
      const dp = discountMap[place.place_id] || null;
      const instantActive = !!(dp?.discountActiveUntil && new Date(dp.discountActiveUntil) > now);
      const starDiscountPercent = dp?.discountEnabled && userLevel >= 2
        ? (STAR_LEVEL_DISCOUNTS[userLevel] ?? 0)
        : null;
      const hasDiscount = dp && (dp.discountEnabled || instantActive);
      return {
        placeId: place.place_id,
        name: place.name,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        priceLevel: place.price_level,
        types: place.types,
        isOpenNow: place.opening_hours?.open_now ?? null,
        location: place.geometry?.location,
        distanceKm: haversineKm(userLat, userLng, place.geometry.location.lat, place.geometry.location.lng),
        photoUrl: place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null,
        discount: hasDiscount ? {
          starDiscountEnabled: !!dp.discountEnabled,
          starDiscountPercent,
          instantActive,
          instantPercent: instantActive ? dp.discountPercent : null,
          note: dp.discountNote,
          activeUntil: dp.discountActiveUntil,
        } : null,
        announcement: dp?.announcementActive ? dp.announcement : null,
      };
    });

    res.json({ results, radiusKm });
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

module.exports = { getNearby, getDetails };
