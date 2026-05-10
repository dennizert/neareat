import api from './api';
import type { RestaurantProfile, RestaurantStats, AppReview, RestaurantMenuItemMeta } from '../types';

export interface RegisterRestaurantPayload {
  email: string;
  password: string;
  ownerName: string;
  businessName: string;
  taxNumber: string;
  taxOffice: string;
  phone: string;
  contactEmail: string;
  address: string;
  businessCategory: string;
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  placePhotoUrl?: string;
  taxCertificateData?: string;
}

export async function registerRestaurant(payload: RegisterRestaurantPayload) {
  const { data } = await api.post('/restaurant-account/register', payload);
  return data as { token: string; user: { id: string; email: string; role: string; displayName: string }; restaurantProfile: RestaurantProfile };
}

export async function getMyRestaurantProfile(): Promise<RestaurantProfile> {
  const { data } = await api.get('/restaurant-account/me');
  return data;
}

export async function updateHours(openingHours: Record<string, { open: string; close: string; closed: boolean }>): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/hours', { openingHours });
  return data;
}

export async function updateInfo(payload: { reservationUrl?: string; phone?: string; contactEmail?: string; address?: string }): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/info', payload);
  return data;
}

export async function updateAnnouncement(announcement: string | null, announcementActive: boolean): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/announcement', { announcement, announcementActive });
  return data;
}

export async function getRestaurantStats(): Promise<RestaurantStats> {
  const { data } = await api.get('/restaurant-account/stats');
  return data;
}

export async function getMyRestaurantReviews(): Promise<AppReview[]> {
  const { data } = await api.get('/restaurant-account/reviews');
  return data;
}

export async function uploadMenuItem(payload: { data: string; mimeType: string; fileName?: string }): Promise<RestaurantMenuItemMeta> {
  const { data } = await api.post('/restaurant-account/menu', payload);
  return data;
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  await api.delete(`/restaurant-account/menu/${itemId}`);
}

export async function getMenuItemData(itemId: string): Promise<{ data: string; mimeType: string }> {
  const { data } = await api.get(`/restaurant-account/menu/${itemId}/data`);
  return data;
}

export async function replyToReview(reviewId: string, content: string) {
  const { data } = await api.post(`/restaurant-account/reviews/${reviewId}/reply`, { content });
  return data;
}

export async function deleteReply(reviewId: string): Promise<void> {
  await api.delete(`/restaurant-account/reviews/${reviewId}/reply`);
}

export async function updateDiscount(payload: { starDiscountEnabled: boolean }): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/discount', payload);
  return data;
}

export async function activateInstantDiscount(durationMinutes: number, percent: number, note?: string): Promise<RestaurantProfile> {
  const { data } = await api.post('/restaurant-account/discount/activate', { durationMinutes, percent, note });
  return data;
}

export async function deactivateInstantDiscount(): Promise<RestaurantProfile> {
  const { data } = await api.delete('/restaurant-account/discount/deactivate');
  return data;
}
