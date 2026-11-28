/** Başvuru adımı 4 — restoran seçimi. Mobil `services/restaurants.ts` (`fetchNearby`/`searchPlaces`) aynası. */
import api from '../api/client';
import type { PlaceResult } from '../types';

export async function fetchNearby(lat: number, lng: number, type = 'all'): Promise<{ results: PlaceResult[] }> {
  const { data } = await api.get('/restaurants/nearby', { params: { lat, lng, type } });
  return { results: Array.isArray(data?.results) ? data.results : [] };
}

export async function searchPlaces(q: string, lat?: number, lng?: number): Promise<{ results: PlaceResult[] }> {
  const params: Record<string, string | number> = { q };
  if (lat != null && lng != null) { params.lat = lat; params.lng = lng; }
  const { data } = await api.get('/places/search', { params });
  return { results: Array.isArray(data?.results) ? data.results : [] };
}
