import { MOCK_MODE } from '../config';
import { MOCK_FAVORITES } from '../mocks/data';
import api from './api';
import type { Favorite, RestaurantDetail } from '../types';

// in-memory state for mock session
let sessionFavorites: Favorite[] = [...MOCK_FAVORITES];

export async function fetchFavorites(): Promise<Favorite[]> {
  if (MOCK_MODE) return [...sessionFavorites];
  const { data } = await api.get('/favorites');
  return data;
}

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

export async function removeFavorite(placeId: string): Promise<void> {
  if (MOCK_MODE) {
    sessionFavorites = sessionFavorites.filter((f) => f.placeId !== placeId);
    return;
  }
  await api.delete(`/favorites/${placeId}`);
}
