/**
 * Restoran hesabı servisi — mobil `neareat-mobile/src/services/restaurantAccount.ts`'in AYNASI
 * (aynı fonksiyon adları ve parametreler). Uçlar değişmez; yalnızca kimlik çerezle taşınır.
 */
import api, { getStatus, getErrorBody } from '../api/client';
import type {
  AppReview, RestaurantAnalytics, RestaurantMenuItemMeta, RestaurantPhoto, RestaurantPhotoKind,
  RestaurantProfile, RestaurantStats, WeeklyReport, OpeningHours,
} from '../types';

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
  /** data URL (base64) vergi levhası */
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

export async function updateHours(openingHours: OpeningHours): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/hours', { openingHours });
  return data;
}

export interface UpdateInfoPayload {
  reservationUrl?: string;
  phone?: string;
  altPhone?: string | null;
  contactEmail?: string;
  address?: string;
  displayName?: string | null;
  acceptsReservations?: boolean;
  tableCount?: number | null;
  seatCapacity?: number | null;
}

export async function updateInfo(payload: UpdateInfoPayload): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/info', payload);
  return data;
}

// ─── Foto galerileri (S10-5): getPhotoUploadUrl → uploadPhotoToS3 → addRestaurantPhoto ─────

export class PhotoStorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoStorageUnavailableError';
  }
}

export async function getPhotoUploadUrl(
  kind: RestaurantPhotoKind,
  contentType: string,
): Promise<{ uploadUrl: string; key: string; publicUrl: string; expiresIn: number }> {
  try {
    const { data } = await api.post('/restaurant-account/photos/upload-url', { kind, contentType });
    return data;
  } catch (err) {
    if (getStatus(err) === 503) {
      const body = getErrorBody(err);
      throw new PhotoStorageUnavailableError(
        (typeof body?.error === 'string' && body.error) || 'Fotoğraf yükleme yakında aktifleşecek.',
      );
    }
    throw err;
  }
}

/** Depo yüklemesini reddettiğinde (CORS/403/ağ) fırlatılır; kayıt oluşturulmaz. */
export class PhotoUploadRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoUploadRejectedError';
  }
}

/**
 * Dosyayı presigned URL'e doğrudan PUT eder. axios DEĞİL: çerez/CSRF/baseURL eklenmemeli
 * (depo başka origin; `credentials: 'omit'`). Mobilde `fileUri` alır, web'de `Blob`.
 */
export async function uploadPhotoToS3(uploadUrl: string, file: Blob, contentType: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
      credentials: 'omit',
    });
  } catch {
    throw new PhotoUploadRejectedError('Fotoğraf depoya yüklenemedi. Depo bu adresten yüklemeye izin vermiyor olabilir.');
  }
  if (!res.ok) {
    throw new PhotoUploadRejectedError(`Fotoğraf depoya yüklenemedi (${res.status}).`);
  }
}

export async function addRestaurantPhoto(kind: RestaurantPhotoKind, url: string): Promise<RestaurantPhoto> {
  const { data } = await api.post('/restaurant-account/photos', { kind, url });
  return data;
}

export async function listRestaurantPhotos(kind?: RestaurantPhotoKind): Promise<RestaurantPhoto[]> {
  const { data } = await api.get('/restaurant-account/photos', { params: kind ? { kind } : {} });
  return data;
}

export async function deleteRestaurantPhoto(id: string): Promise<void> {
  await api.delete(`/restaurant-account/photos/${id}`);
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

export async function getRestaurantAnalytics(): Promise<RestaurantAnalytics> {
  const { data } = await api.get('/restaurant-account/analytics');
  return data;
}

export async function getWeeklyReport(): Promise<WeeklyReport> {
  const { data } = await api.get('/restaurant-account/report');
  return data;
}

export type CampaignAudience = 'favorites' | 'reservations' | 'all';

export class CampaignLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignLimitError';
  }
}

export async function sendCampaign(
  message: string,
  audience: CampaignAudience = 'all',
): Promise<{ sent: number; audience: CampaignAudience }> {
  try {
    const { data } = await api.post('/restaurant-account/campaign', { message, audience });
    return data;
  } catch (err) {
    const body = getErrorBody(err);
    if (getStatus(err) === 429 && body?.error === 'CAMPAIGN_LIMIT_EXCEEDED') {
      throw new CampaignLimitError((typeof body.message === 'string' && body.message) || 'Bugün zaten bir kampanya gönderdiniz.');
    }
    throw err;
  }
}
