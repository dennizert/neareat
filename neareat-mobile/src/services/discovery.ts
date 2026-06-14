/**
 * Kişiselleştirilmiş keşif servisi (Sprint-17 #366).
 *
 * Backend `/api/places/*` kişiselleştirme uçlarını saran ince katman:
 * - getPersonalizedDiscovery: damak profiline göre raylar + yeniden sıralı liste
 * - getRecentlyViewed: son baktığı mekanlar
 * - recordPlaceView: mekan detayı açılınca görüntülemeyi kaydeder (fire-and-forget)
 *
 * MOCK_MODE'da boş/no-op döner; çağıran ekran her zaman mevcut nearby deneyimine düşebilir.
 */
import { MOCK_MODE } from '../config';
import api from './api';
import type { PersonalizedDiscovery, RecentlyViewedPlace, Restaurant } from '../types';

const EMPTY: PersonalizedDiscovery = {
  tasteProfile: { topCuisines: [] },
  recentlyViewed: [],
  forYou: [],
  revisit: [],
  radiusKm: 5,
};

/** Damak profiline göre kişiselleştirilmiş Keşfet verisini getirir. */
export async function getPersonalizedDiscovery(lat: number, lng: number): Promise<PersonalizedDiscovery> {
  if (MOCK_MODE) return EMPTY;
  const { data } = await api.get('/places/personalized', { params: { lat, lng } });
  return data;
}

/** Kullanıcının son baktığı mekanları getirir. */
export async function getRecentlyViewed(): Promise<RecentlyViewedPlace[]> {
  if (MOCK_MODE) return [];
  const { data } = await api.get('/places/recently-viewed');
  return data.recentlyViewed ?? [];
}

/**
 * Mekan görüntülemesini kaydeder. Fire-and-forget: hata yutulur, UI'ı bloklamaz.
 * Restoran detay ekranı açılışında çağrılır.
 */
export async function recordPlaceView(place: Pick<Restaurant, 'placeId' | 'name' | 'rating' | 'photoUrl' | 'types'> & { address?: string | null }): Promise<void> {
  if (MOCK_MODE) return;
  try {
    await api.post('/places/view', {
      placeId: place.placeId,
      placeName: place.name,
      placeAddress: place.address ?? null,
      placePhotoUrl: place.photoUrl ?? null,
      placeRating: place.rating ?? null,
      placeTypes: place.types ?? [],
    });
  } catch {
    // Sessizce geç — görüntüleme kaydı kritik değil.
  }
}
