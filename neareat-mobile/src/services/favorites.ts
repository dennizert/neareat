/**
 * Favori Servisi
 *
 * Kullanıcının favori restoranlarını ekleme, listeleme ve silme işlemlerini yönetir.
 * Restoran detay ekranında kalp ikonuna basıldığında bu servis kullanılır.
 * MOCK_MODE'da sahte in-memory liste ile çalışır.
 */
import { MOCK_MODE } from '../config';
import { MOCK_FAVORITES } from '../mocks/data';
import api from './api';
import { saveCache, loadCache, isNetworkError } from './offlineCache';
import type { Favorite, Restaurant, RestaurantDetail } from '../types';

const FAVORITES_CACHE_KEY = 'favorites';

/** Mock modda session boyunca tutulan geçici favori listesi */
let sessionFavorites: Favorite[] = [...MOCK_FAVORITES];

/**
 * Kullanıcının tüm favorilerini getirir.
 * Favoriler ekranı ve uygulama başlangıcında çağrılır.
 *
 * @returns Favori restoran listesi
 */
export async function fetchFavorites(): Promise<Favorite[]> {
  if (MOCK_MODE) return [...sessionFavorites];
  try {
    const { data } = await api.get('/favorites');
    saveCache(FAVORITES_CACHE_KEY, data); // başarılıyı önbelleğe al (fire-and-forget)
    return data;
  } catch (err) {
    // Ağ koptuysa son bilinen favorileri göster (çevrimdışı)
    if (isNetworkError(err)) {
      const cached = await loadCache<Favorite[]>(FAVORITES_CACHE_KEY);
      if (cached) return cached;
    }
    throw err;
  }
}

/**
 * Restoranı favorilere ekler.
 * Restoran detay bilgilerinden gerekli alanlar çıkarılarak backend'e gönderilir.
 * Zaten favoride olan restoran tekrar eklenmez (mock modda kontrol edilir).
 *
 * @param restaurant - Favoriye eklenecek restoranın detay bilgisi
 * @returns Oluşturulan favori kaydı
 */
export async function addFavorite(restaurant: RestaurantDetail): Promise<Favorite> {
  if (MOCK_MODE) {
    const already = sessionFavorites.find((f) => f.placeId === restaurant.placeId);
    if (already) return already;
    const fav: Favorite = {
      id: `fav_mock_${Date.now()}`,
      placeId: restaurant.placeId,
      placeName: restaurant.name,
      placeAddress: restaurant.formattedAddress,
      placeLat: restaurant.location.lat,
      placeLng: restaurant.location.lng,
      placePhone: restaurant.formattedPhoneNumber,
      placePhotoUrl: restaurant.photos?.[0] ?? null,
      placeRating: restaurant.rating,
    };
    sessionFavorites = [fav, ...sessionFavorites];
    return fav;
  }
  const { data } = await api.post('/favorites', {
    placeId: restaurant.placeId,
    placeName: restaurant.name,
    placeAddress: restaurant.formattedAddress,
    placeLat: restaurant.location.lat,
    placeLng: restaurant.location.lng,
    placePhone: restaurant.formattedPhoneNumber,
    placePhotoUrl: restaurant.photos?.[0] ?? null,
    placeRating: restaurant.rating,
  });
  return data;
}

/**
 * Restoranı liste/harita kartındaki hafif `Restaurant` verisinden favoriye ekler
 * (Sprint-17 #367). Detay ekranı `addFavorite` kullanmaya devam eder; bu sürüm
 * harita alt önizleme kartının hızlı favori aksiyonu içindir (telefon bilgisi yok).
 *
 * @param r - Favoriye eklenecek restoranın liste verisi
 * @returns Oluşturulan favori kaydı
 */
export async function addFavoriteFromRestaurant(r: Restaurant): Promise<Favorite> {
  const payload = {
    placeId: r.placeId,
    placeName: r.name,
    placeAddress: r.formattedAddress ?? null,
    placeLat: r.location.lat,
    placeLng: r.location.lng,
    placePhone: null,
    placePhotoUrl: r.photoUrl ?? null,
    placeRating: r.rating ?? null,
  };
  if (MOCK_MODE) {
    const already = sessionFavorites.find((f) => f.placeId === r.placeId);
    if (already) return already;
    const fav: Favorite = { id: `fav_mock_${Date.now()}`, ...payload };
    sessionFavorites = [fav, ...sessionFavorites];
    return fav;
  }
  const { data } = await api.post('/favorites', payload);
  return data;
}

/**
 * Restoranı favorilerden çıkarır.
 *
 * @param placeId - Favoriden çıkarılacak restoranın Google Places ID'si
 */
export async function removeFavorite(placeId: string): Promise<void> {
  if (MOCK_MODE) {
    sessionFavorites = sessionFavorites.filter((f) => f.placeId !== placeId);
    return;
  }
  await api.delete(`/favorites/${placeId}`);
}
