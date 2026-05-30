/**
 * Restoran Hesabı Servisi
 *
 * Restoran sahiplerinin hesap yönetimi işlemlerini yönetir:
 * - Restoran kaydı (başvuru)
 * - Profil bilgilerini görüntüleme/güncelleme
 * - Çalışma saatleri yönetimi
 * - Menü yönetimi (fotoğraf yükleme/silme)
 * - İndirim yönetimi (yıldız indirimi ve anlık indirim)
 * - Yorum yanıtlama
 * - Duyuru yönetimi
 * - İstatistikler
 */
import api from './api';
import type { RestaurantProfile, RestaurantStats, AppReview, RestaurantMenuItemMeta } from '../types';

/** Restoran kayıt (başvuru) formu alanları */
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
  /** Base64 encoded vergi belgesi */
  taxCertificateData?: string;
}

/**
 * Yeni restoran hesabı başvurusu oluşturur.
 * Başvuru PENDING durumunda oluşturulur ve admin onayı bekler.
 *
 * @param payload - Restoran kayıt bilgileri
 * @returns JWT token, kullanıcı bilgisi ve restoran profili
 */
export async function registerRestaurant(payload: RegisterRestaurantPayload) {
  const { data } = await api.post('/restaurant-account/register', payload);
  return data as { token: string; user: { id: string; email: string; role: string; displayName: string }; restaurantProfile: RestaurantProfile };
}

/**
 * Restoranın kendi profil bilgilerini getirir.
 * @returns Restoran profili (menü dahil)
 */
export async function getMyRestaurantProfile(): Promise<RestaurantProfile> {
  const { data } = await api.get('/restaurant-account/me');
  return data;
}

/**
 * Restoranın çalışma saatlerini günceller.
 * Her gün için açılış/kapanış saati ve kapalı mı bilgisi gönderilir.
 *
 * @param openingHours - Gün bazlı çalışma saatleri
 * @returns Güncellenmiş restoran profili
 */
export async function updateHours(openingHours: Record<string, { open: string; close: string; closed: boolean }>): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/hours', { openingHours });
  return data;
}

/**
 * Restoranın iletişim bilgilerini günceller.
 * @param payload - Güncellenecek alanlar (telefon, email, adres, rezervasyon URL'i vb.)
 * @returns Güncellenmiş restoran profili
 */
export async function updateInfo(payload: { reservationUrl?: string; phone?: string; contactEmail?: string; address?: string; acceptsReservations?: boolean; tableCount?: number | null }): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/info', payload);
  return data;
}

/**
 * Restoranın duyurusunu günceller. Duyuru restoran kartında ve detayda gösterilir.
 * @param announcement - Duyuru metni (null ile kaldırılır)
 * @param announcementActive - Duyuru aktif mi
 * @returns Güncellenmiş restoran profili
 */
export async function updateAnnouncement(announcement: string | null, announcementActive: boolean): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/announcement', { announcement, announcementActive });
  return data;
}

/**
 * Restoranın istatistiklerini getirir (dashboard için).
 * Favori sayısı, yorum sayısı, ortalama puan, öneri sayısı.
 * @returns Restoran istatistikleri
 */
export async function getRestaurantStats(): Promise<RestaurantStats> {
  const { data } = await api.get('/restaurant-account/stats');
  return data;
}

/**
 * Restorana yapılmış yorumları getirir (yanıtlamak için).
 * @returns Yorum listesi
 */
export async function getMyRestaurantReviews(): Promise<AppReview[]> {
  const { data } = await api.get('/restaurant-account/reviews');
  return data;
}

/**
 * Menüye yeni sayfa/fotoğraf yükler (base64 formatında).
 * @param payload - Base64 veri, MIME tipi ve dosya adı
 * @returns Oluşturulan menü öğesi metadata'sı
 */
export async function uploadMenuItem(payload: { data: string; mimeType: string; fileName?: string }): Promise<RestaurantMenuItemMeta> {
  const { data } = await api.post('/restaurant-account/menu', payload);
  return data;
}

/**
 * Menüden sayfa/fotoğraf siler.
 * @param itemId - Silinecek menü öğesinin ID'si
 */
export async function deleteMenuItem(itemId: string): Promise<void> {
  await api.delete(`/restaurant-account/menu/${itemId}`);
}

/**
 * Menü öğesinin ham verisini getirir (görüntüleme için).
 * @param itemId - Menü öğesi ID'si
 * @returns Base64 veri ve MIME tipi
 */
export async function getMenuItemData(itemId: string): Promise<{ data: string; mimeType: string }> {
  const { data } = await api.get(`/restaurant-account/menu/${itemId}/data`);
  return data;
}

/**
 * Kullanıcı yorumuna restoran olarak yanıt verir.
 * @param reviewId - Yanıtlanacak yorumun ID'si
 * @param content - Yanıt metni
 */
export async function replyToReview(reviewId: string, content: string) {
  const { data } = await api.post(`/restaurant-account/reviews/${reviewId}/reply`, { content });
  return data;
}

/**
 * Yorum yanıtını siler.
 * @param reviewId - Yanıtı silinecek yorumun ID'si
 */
export async function deleteReply(reviewId: string): Promise<void> {
  await api.delete(`/restaurant-account/reviews/${reviewId}/reply`);
}

/**
 * Yıldız seviyesine göre otomatik indirim sistemini açar/kapatır.
 * Kullanıcının yıldız seviyesine göre %10-%25 arası indirim uygulanır.
 *
 * @param payload - Yıldız indirimi aktif mi
 * @returns Güncellenmiş restoran profili
 */
export async function updateDiscount(payload: { starDiscountEnabled: boolean }): Promise<RestaurantProfile> {
  const { data } = await api.put('/restaurant-account/discount', payload);
  return data;
}

/**
 * Anlık (flash) indirim başlatır. Belirli süre ve yüzdeyle sınırlıdır.
 * Yakındaki kullanıcılara bildirim gönderilir.
 *
 * @param durationMinutes - İndirim süresi (dakika)
 * @param percent - İndirim yüzdesi
 * @param note - İndirim notu (opsiyonel, ör. "Akşam menüsünde geçerli")
 * @returns Güncellenmiş restoran profili
 */
export async function activateInstantDiscount(durationMinutes: number, percent: number, note?: string): Promise<RestaurantProfile> {
  const { data } = await api.post('/restaurant-account/discount/activate', { durationMinutes, percent, note });
  return data;
}

/**
 * Aktif anlık indirimi iptal eder.
 * @returns Güncellenmiş restoran profili
 */
export async function deactivateInstantDiscount(): Promise<RestaurantProfile> {
  const { data } = await api.delete('/restaurant-account/discount/deactivate');
  return data;
}

export async function getRestaurantAnalytics(): Promise<import('../types').RestaurantAnalytics> {
  const { data } = await api.get('/restaurant-account/analytics');
  return data;
}

export async function getWeeklyReport(): Promise<import('../types').WeeklyReport> {
  const { data } = await api.get('/restaurant-account/report');
  return data;
}

export type CampaignAudience = 'favorites' | 'reservations' | 'all';

/** Günlük kampanya limiti aşıldığında fırlatılan typed error (429). */
export class CampaignLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignLimitError';
    Object.setPrototypeOf(this, CampaignLimitError.prototype);
  }
}

/**
 * Anlık kampanya gönderir (S5-3). Hedef kitleye INSTANT_DISCOUNT bildirimi.
 * @throws {CampaignLimitError} Günde 1 kampanya limiti aşıldı (429)
 */
export async function sendCampaign(
  message: string,
  audience: CampaignAudience = 'all',
): Promise<{ sent: number; audience: CampaignAudience }> {
  try {
    const { data } = await api.post('/restaurant-account/campaign', { message, audience });
    return data;
  } catch (err: any) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    if (status === 429 && body?.error === 'CAMPAIGN_LIMIT_EXCEEDED') {
      throw new CampaignLimitError(body.message || 'Bugün zaten bir kampanya gönderdiniz.');
    }
    throw err;
  }
}
