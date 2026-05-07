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
  const cacheKey = `nearby:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusMeters}:${type}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&radius=${radiusMeters}&type=${type}&key=${API_KEY}`;

  const data = await fetchJson(url);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places Nearby Search error: ${data.status}`);
  }

  const results = data.results || [];
  await cacheSet(cacheKey, results, NEARBY_TTL);
  return results;
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

module.exports = { getNearbyRestaurants, getPlaceDetails, getPhotoUrl };
