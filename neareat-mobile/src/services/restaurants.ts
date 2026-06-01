/**
 * Restoran Servisi
 *
 * Restoran listeleme, detay görüntüleme ve yorum (review) işlemlerini yönetir.
 * Google Places API üzerinden backend'e istek atar.
 * MOCK_MODE aktifken sahte verilerle çalışır — backend gerektirmez.
 */
import { MOCK_MODE } from '../config';
import {
  MOCK_RESTAURANTS,
  MOCK_RESTAURANT_DETAILS,
  MOCK_APP_REVIEWS,
} from '../mocks/data';
import api from './api';
import { saveCache, loadCache, isNetworkError } from './offlineCache';
import type { Restaurant, RestaurantDetail, AppReview, StarEvent, Reward } from '../types';

/** Mock modda session boyunca tutulan geçici yorum listesi */
let sessionReviews: AppReview[] = [...MOCK_APP_REVIEWS];

/**
 * Kullanıcının konumuna yakın restoranları getirir.
 * Backend, Google Places Nearby Search API'yi çağırır ve sonuçları döner.
 *
 * @param lat - Kullanıcının enlemi
 * @param lng - Kullanıcının boylamı
 * @param type - Restoran türü filtresi (varsayılan: 'all')
 * @returns Restoran listesi ve arama yarıçapı
 */
export async function fetchNearby(
  lat: number,
  lng: number,
  type: string = 'all',
): Promise<{ results: Restaurant[]; radiusKm: number }> {
  if (MOCK_MODE) {
    return { results: MOCK_RESTAURANTS, radiusKm: 5 };
  }
  // Konuma göre kaba anahtar — çevrimdışıyken aynı bölgenin son sonuçlarını göster
  const cacheKey = `nearby:${type}:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  try {
    const { data } = await api.get('/restaurants/nearby', { params: { lat, lng, type } });
    saveCache(cacheKey, data); // başarılıyı önbelleğe al (fire-and-forget)
    return data;
  } catch (err) {
    if (isNetworkError(err)) {
      const cached = await loadCache<{ results: Restaurant[]; radiusKm: number }>(cacheKey);
      if (cached) return cached;
    }
    throw err;
  }
}

/**
 * Restoran adı / serbest metin araması (Sprint-6 #82).
 * Backend Google Places Text Search'ü çağırır; lat/lng verilirse konum bias uygulanır.
 *
 * @param q - Arama metni (ör. "tarihi yarımadada pizza")
 * @param lat - Kullanıcı enlemi (opsiyonel — konum bias için)
 * @param lng - Kullanıcı boylamı (opsiyonel)
 */
export async function searchPlaces(
  q: string,
  lat?: number,
  lng?: number,
): Promise<{ results: Restaurant[]; query: string }> {
  if (MOCK_MODE) {
    const needle = q.trim().toLowerCase();
    const results = needle
      ? MOCK_RESTAURANTS.filter((r) => r.name.toLowerCase().includes(needle))
      : [];
    return { results, query: q };
  }
  const params: Record<string, string | number> = { q };
  if (typeof lat === 'number' && typeof lng === 'number') {
    params.lat = lat;
    params.lng = lng;
  }
  const { data } = await api.get('/places/search', { params });
  return data;
}

/**
 * Belirli bir restoranın detay bilgilerini getirir.
 * Fotoğraflar, çalışma saatleri, yorumlar, menü, indirim bilgileri vb. içerir.
 *
 * @param placeId - Google Places ID
 * @param lat - Mesafe hesabı için kullanıcı enlemi (opsiyonel)
 * @param lng - Mesafe hesabı için kullanıcı boylamı (opsiyonel)
 * @returns Restoran detay bilgisi
 */
export async function fetchRestaurantDetail(
  placeId: string,
  lat?: number,
  lng?: number
): Promise<RestaurantDetail> {
  if (MOCK_MODE) {
    const detail = MOCK_RESTAURANT_DETAILS[placeId];
    if (!detail) throw new Error('Restoran bulunamadı');
    return detail;
  }
  const { data } = await api.get(`/restaurants/${placeId}`, { params: { lat, lng } });
  return data;
}

/**
 * Belirli bir restoranın uygulama içi yorumlarını getirir.
 * Google yorumlarından ayrıdır — Eatlas kullanıcılarının yazdığı yorumlardır.
 *
 * @param placeId - Google Places ID
 * @returns Yorum listesi
 */
export async function fetchAppReviews(placeId: string): Promise<AppReview[]> {
  if (MOCK_MODE) {
    return sessionReviews.filter((r) => r.placeId === placeId);
  }
  const { data } = await api.get(`/reviews/${placeId}`);
  return data;
}

/** createReview fonksiyonunun dönüş tipi */
export interface CreateReviewResult {
  review: AppReview;
  /** Yorum yazarak kazanılan yıldız olayı (ilk yorum ise) */
  starEvent: StarEvent | null;
  /** Güncel toplam yıldız sayısı */
  newStarCount: number | null;
  /** Yeni açılan ödüller */
  newRewards: Reward[];
}

/**
 * Restoran için yeni yorum oluşturur veya mevcut yorumu günceller.
 * İlk kez yorum yazan kullanıcı 5 yıldız kazanır (gamification).
 *
 * @param placeId - Google Places ID
 * @param rating - Puan (1-5)
 * @param body - Yorum metni
 * @param placeName - Restoran adı (yıldız olayı açıklaması için)
 * @returns Oluşturulan yorum, yıldız olayı ve yeni ödüller
 */
export async function createReview(
  placeId: string,
  rating: number,
  body: string,
  placeName?: string,
): Promise<CreateReviewResult> {
  if (MOCK_MODE) {
    const isNew = !sessionReviews.some(r => r.placeId === placeId && r.userId === 'mock-user-001');
    const review: AppReview = {
      id: `rev_mock_${Date.now()}`,
      userId: 'mock-user-001',
      placeId,
      rating,
      body,
      createdAt: new Date().toISOString(),
      user: { displayName: 'Test Kullanıcı', photoUrl: null },
    };
    sessionReviews = [review, ...sessionReviews.filter((r) => r.placeId !== placeId)];
    const label = placeName || placeId;
    const starEvent: StarEvent | null = isNew
      ? { id: `se-${Date.now()}`, type: 'review', amount: 5, description: `${label} için yorum yazdın`, createdAt: new Date().toISOString() }
      : null;
    return { review, starEvent, newStarCount: null, newRewards: [] };
  }
  const { data } = await api.post('/reviews', { placeId, rating, body, placeName });
  return data;
}

/**
 * Mevcut yorumu günceller (puan ve metin değiştirilebilir).
 *
 * @param reviewId - Güncellenecek yorumun ID'si
 * @param rating - Yeni puan
 * @param body - Yeni yorum metni
 * @returns Güncellenmiş yorum
 */
export async function updateReview(
  reviewId: string,
  rating: number,
  body: string
): Promise<AppReview> {
  if (MOCK_MODE) {
    const idx = sessionReviews.findIndex((r) => r.id === reviewId);
    if (idx !== -1) sessionReviews[idx] = { ...sessionReviews[idx], rating, body };
    return sessionReviews[idx];
  }
  const { data } = await api.put(`/reviews/${reviewId}`, { rating, body });
  return data;
}

/**
 * Yorumu siler.
 *
 * @param reviewId - Silinecek yorumun ID'si
 */
export async function deleteReview(reviewId: string): Promise<void> {
  if (MOCK_MODE) {
    sessionReviews = sessionReviews.filter((r) => r.id !== reviewId);
    return;
  }
  await api.delete(`/reviews/${reviewId}`);
}
