import { MOCK_MODE } from '../config';
import {
  MOCK_RESTAURANTS,
  MOCK_RESTAURANT_DETAILS,
  MOCK_APP_REVIEWS,
} from '../mocks/data';
import api from './api';
import type { Restaurant, RestaurantDetail, AppReview, StarEvent, Reward } from '../types';

// in-memory mock reviews for the session
let sessionReviews: AppReview[] = [...MOCK_APP_REVIEWS];

export async function fetchNearby(
  lat: number,
  lng: number,
  type: string = 'all',
): Promise<{ results: Restaurant[]; radiusKm: number }> {
  if (MOCK_MODE) {
    return { results: MOCK_RESTAURANTS, radiusKm: 5 };
  }
  const { data } = await api.get('/restaurants/nearby', { params: { lat, lng, type } });
  return data;
}

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

export async function fetchAppReviews(placeId: string): Promise<AppReview[]> {
  if (MOCK_MODE) {
    return sessionReviews.filter((r) => r.placeId === placeId);
  }
  const { data } = await api.get(`/reviews/${placeId}`);
  return data;
}

export interface CreateReviewResult {
  review: AppReview;
  starEvent: StarEvent | null;
  newStarCount: number | null;
  newRewards: Reward[];
}

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

export async function deleteReview(reviewId: string): Promise<void> {
  if (MOCK_MODE) {
    sessionReviews = sessionReviews.filter((r) => r.id !== reviewId);
    return;
  }
  await api.delete(`/reviews/${reviewId}`);
}
