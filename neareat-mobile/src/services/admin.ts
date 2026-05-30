/**
 * Admin Servisi
 *
 * Platform yönetici paneli için gerekli API çağrılarını yönetir:
 * - Admin girişi ve seed (ilk admin oluşturma)
 * - Platform istatistikleri
 * - Restoran başvurularını onaylama/reddetme
 * - Kullanıcı yönetimi (askıya alma/geri alma)
 * - Yorum moderasyonu
 * - Kullanıcı raporlarını yönetme
 */
import api from './api';
import type { AdminStats, AdminRestaurantSummary, AdminUserSummary, AppReview, UserReport, UserLog } from '../types';

export interface LogFilters {
  email?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  limit?: number;
}

/**
 * Kullanıcı aktivite loglarını filtreli ve sayfalı getirir (sadece admin).
 * @param filters - email, tarih/saat aralığı ve sayfalama parametreleri
 */
export async function getLogs(filters: LogFilters = {}): Promise<{ logs: UserLog[]; total: number; page: number; limit: number }> {
  const { data } = await api.get('/logs', { params: filters });
  return data;
}

/**
 * Admin hesabıyla giriş yapar. Sadece ADMIN rolündeki kullanıcılar giriş yapabilir.
 * @param email - Admin email adresi
 * @param password - Admin şifresi
 * @returns JWT token ve admin kullanıcı bilgisi
 */
export async function adminLogin(email: string, password: string) {
  const { data } = await api.post('/admin/login', { email, password });
  return data as { token: string; user: { id: string; email: string; role: string; displayName: string } };
}

/**
 * İlk admin hesabını oluşturur (seed).
 * Sadece veritabanında hiç admin yokken çalışır — güvenlik önlemi.
 * @param payload - Email, şifre ve görünen isim
 */
export async function seedAdmin(payload: { email: string; password: string; displayName: string }) {
  const { data } = await api.post('/admin/seed', payload);
  return data;
}

/**
 * Platform genelindeki istatistikleri getirir (dashboard için).
 * Toplam kullanıcı, restoran, yorum, favori, öneri, premium sayıları vb.
 * @returns Platform istatistikleri
 */
export async function getPlatformStats(): Promise<AdminStats> {
  const { data } = await api.get('/admin/stats');
  return data;
}

/**
 * Restoran başvurularını duruma göre listeler (sayfalı).
 * @param status - Filtre: PENDING, APPROVED veya REJECTED
 * @param page - Sayfa numarası
 * @returns Restoran profil listesi ve toplam sayı
 */
export async function getPendingRestaurants(status = 'PENDING', page = 1): Promise<{ profiles: AdminRestaurantSummary[]; total: number }> {
  const { data } = await api.get('/admin/restaurants', { params: { status, page } });
  return data;
}

/**
 * Belirli bir restoran başvurusunun detayını getirir.
 * @param id - Restoran profil ID'si
 * @returns Restoran detayı (vergi belgesi dahil)
 */
export async function getRestaurantDetail(id: string): Promise<AdminRestaurantSummary & { hasTaxCertificate: boolean }> {
  const { data } = await api.get(`/admin/restaurants/${id}`);
  return data;
}

/**
 * Restoranın yüklediği vergi belgesini getirir (base64 formatında).
 * @param id - Restoran profil ID'si
 * @returns Base64 encoded belge verisi
 */
export async function getTaxCertificate(id: string): Promise<{ data: string }> {
  const { data } = await api.get(`/admin/restaurants/${id}/certificate`);
  return data;
}

/**
 * Restoran başvurusunu onaylar. Restoran APPROVED durumuna geçer.
 * @param id - Onaylanacak restoran profil ID'si
 * @returns Güncellenmiş restoran profili
 */
export async function approveRestaurant(id: string): Promise<AdminRestaurantSummary> {
  const { data } = await api.post(`/admin/restaurants/${id}/approve`);
  return data;
}

/**
 * Restoran başvurusunu reddeder. Sebep belirtilmelidir.
 * @param id - Reddedilecek restoran profil ID'si
 * @param rejectionReason - Reddedilme sebebi
 * @returns Güncellenmiş restoran profili
 */
export async function rejectRestaurant(id: string, rejectionReason: string): Promise<AdminRestaurantSummary> {
  const { data } = await api.post(`/admin/restaurants/${id}/reject`, { rejectionReason });
  return data;
}

/**
 * Kullanıcıları arama ve filtreleme ile listeler.
 * @param search - Arama terimi (isim veya email)
 * @param page - Sayfa numarası
 * @param role - Rol filtresi (USER, RESTAURANT, ADMIN)
 * @returns Kullanıcı listesi ve toplam sayı
 */
export async function getUsers(search = '', page = 1, role = 'USER'): Promise<{ users: AdminUserSummary[]; total: number }> {
  const { data } = await api.get('/admin/users', { params: { search, page, role } });
  return data;
}

/**
 * Kullanıcıyı askıya alır. Askıya alınan kullanıcı giriş yapamaz.
 * @param id - Askıya alınacak kullanıcının ID'si
 */
export async function suspendUser(id: string) {
  const { data } = await api.post(`/admin/users/${id}/suspend`);
  return data;
}

/**
 * Kullanıcının askıya alma durumunu kaldırır.
 * @param id - Askısı kaldırılacak kullanıcının ID'si
 */
export async function unsuspendUser(id: string) {
  const { data } = await api.post(`/admin/users/${id}/unsuspend`);
  return data;
}

/**
 * İşaretlenmiş (flagged) yorumları getirir — moderasyon için.
 * @returns İşaretlenmiş yorum listesi
 */
export async function getFlaggedReviews(): Promise<AppReview[]> {
  const { data } = await api.get('/admin/reviews');
  return data;
}

/**
 * Uygunsuz içerik barındıran yorumu siler (admin yetkisiyle).
 * @param id - Silinecek yorumun ID'si
 */
export async function adminDeleteReview(id: string): Promise<void> {
  await api.delete(`/admin/reviews/${id}`);
}

/**
 * Kullanıcı raporlarını duruma göre listeler.
 * @param status - Filtre: PENDING, RESOLVED veya DISMISSED
 * @param page - Sayfa numarası
 * @returns Rapor listesi ve toplam sayı
 */
export async function getReports(status = 'PENDING', page = 1): Promise<{ reports: UserReport[]; total: number }> {
  const { data } = await api.get('/admin/reports', { params: { status, page } });
  return data;
}

/**
 * Kullanıcı raporunu işler — kullanıcı askıya alınabilir, rapor reddedilebilir
 * veya uyarı verilebilir.
 *
 * @param id - Rapor ID'si
 * @param action - Aksyon: 'suspend' (askıya al), 'dismiss' (reddet), 'warn' (uyar)
 * @param actionNote - Aksyon notu (opsiyonel)
 */
export async function handleReport(
  id: string,
  action: 'suspend' | 'dismiss' | 'warn',
  actionNote?: string,
): Promise<void> {
  await api.put(`/admin/reports/${id}`, { action, actionNote });
}

/**
 * Arkadaş önerisi gece job'ını manuel tetikler — tüm kullanıcılar için
 * uyum bazlı öneriler yeniden hesaplanıp önbelleğe yazılır.
 * @returns İşlenen ve önbelleğe yazılan kullanıcı sayısı
 */
export async function runFriendSuggestionsJob(): Promise<{ processed: number; stored: number }> {
  const { data } = await api.post('/admin/jobs/friend-suggestions/run');
  return data;
}

export interface AdminPlaceRequest {
  id: string;
  placeId: string;
  placeName: string;
  placeAddress: string | null;
  note: string | null;
  status: 'PENDING' | 'REVIEWED';
  createdAt: string;
  user: { id: string; displayName: string; email: string };
}

export async function getPlaceRequests(status?: string, page = 1): Promise<{ requests: AdminPlaceRequest[]; total: number; page: number; pages: number }> {
  const { data } = await api.get('/admin/place-requests', { params: { status, page } });
  return data;
}

export async function reviewPlaceRequest(id: string): Promise<AdminPlaceRequest> {
  const { data } = await api.patch(`/admin/place-requests/${id}/review`);
  return data;
}
