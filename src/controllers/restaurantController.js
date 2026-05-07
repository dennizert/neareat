const prisma = require('../utils/prisma');
const { getNearbyRestaurants, getPlaceDetails, getPhotoUrl } = require('../services/googlePlaces');
const { haversineKm } = require('../utils/haversine');
const { isPremiumUser } = require('../utils/premiumCheck');

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

    const premium = await isPremiumUser(req.user.id);
    const radiusKm = premium ? PREMIUM_RADIUS_KM : FREE_RADIUS_KM;
    const radiusMeters = radiusKm * 1000;

    let rawPlaces;
    if (placeType === 'all') {
      // 5 tip paralel çek: restaurant + cafe + meal_takeaway + meal_delivery + bakery
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

    const results = rawPlaces
      .filter((place) => {
        if (!place.geometry?.location) return false;
        const d = haversineKm(userLat, userLng, place.geometry.location.lat, place.geometry.location.lng);
        return d <= radiusKm;
      })
      .map((place) => ({
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
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 60);

    res.json({ results, radiusKm });
  } catch (err) {
    next(err);
  }
}

async function getDetails(req, res, next) {
  try {
    const { placeId } = req.params;
    const { lat, lng } = req.query;

    const place = await getPlaceDetails(placeId);

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
