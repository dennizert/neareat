/**
 * Rezervasyon Servisi
 *
 * Restoran rezervasyonu oluşturma, listeleme, güncelleme, iptal etme
 * ve restoran tarafından onaylama/reddetme işlemlerini yönetir.
 * Hem kullanıcı hem de restoran hesabı tarafından kullanılır.
 */
import api from './api';
import type { Reservation, ReservationMessage } from '../types';

/** Rezervasyon oluşturma parametreleri */
export interface CreateReservationParams {
  placeId: string;
  date: string;
  time: string;
  guestCount: number;
  occasion?: string;
  specialRequests?: string;
}

/**
 * Yeni rezervasyon oluşturur. Başlangıçta PENDING durumundadır.
 * Restoran onaylayana kadar bekler.
 *
 * @param params - Rezervasyon bilgileri (tarih, saat, kişi sayısı vb.)
 * @returns Oluşturulan rezervasyon
 */
export async function createReservation(params: CreateReservationParams): Promise<Reservation> {
  const { data } = await api.post('/reservations', params);
  return data;
}

/**
 * Kullanıcının kendi rezervasyonlarını getirir.
 * @returns Rezervasyon listesi
 */
export async function getMyReservations(): Promise<Reservation[]> {
  const { data } = await api.get('/reservations/me');
  return data;
}

/**
 * Belirli bir rezervasyonun detayını getirir.
 * @param id - Rezervasyon ID'si
 * @returns Rezervasyon detayı
 */
export async function getReservationDetail(id: string): Promise<Reservation> {
  const { data } = await api.get(`/reservations/${id}`);
  return data;
}

/**
 * Rezervasyonu iptal eder.
 * @param id - İptal edilecek rezervasyonun ID'si
 */
export async function cancelReservation(id: string): Promise<void> {
  await api.delete(`/reservations/${id}`);
}

/** Rezervasyon güncelleme parametreleri */
export interface UpdateReservationParams {
  date: string;
  time: string;
  guestCount: number;
  occasion?: string;
  specialRequests?: string;
}

/**
 * Mevcut rezervasyonu günceller (tarih, saat, kişi sayısı değiştirilebilir).
 * @param id - Güncellenecek rezervasyonun ID'si
 * @param params - Güncellenecek alanlar
 * @returns Güncellenmiş rezervasyon
 */
export async function updateReservation(id: string, params: UpdateReservationParams): Promise<Reservation> {
  const { data } = await api.put(`/reservations/${id}`, params);
  return data;
}

/**
 * Restoranın aldığı rezervasyonları getirir (restoran hesabı için).
 * Duruma ve tarihe göre filtrelenebilir.
 *
 * @param status - Filtre: PENDING, CONFIRMED, REJECTED vb. (opsiyonel)
 * @param date - Filtre: belirli tarih (opsiyonel)
 * @returns Filtrelenmiş rezervasyon listesi
 */
export async function getRestaurantReservations(status?: string, date?: string): Promise<Reservation[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (date) params.date = date;
  const { data } = await api.get('/reservations/restaurant', { params });
  return data;
}

/**
 * Restoran tarafından rezervasyonu onaylar veya reddeder.
 *
 * @param id - Rezervasyon ID'si
 * @param status - Yeni durum: CONFIRMED veya REJECTED
 * @param rejectionReason - Reddedilme sebebi (sadece REJECTED için)
 * @returns Güncellenmiş rezervasyon
 */
export async function updateReservationStatus(
  id: string,
  status: 'CONFIRMED' | 'REJECTED',
  rejectionReason?: string,
  reservedSeats?: number, // S19-5: onayda rezerve koltuk (varsayılan = guestCount, backend)
): Promise<Reservation> {
  const { data } = await api.put(`/reservations/${id}/status`, { status, rejectionReason, reservedSeats });
  return data;
}

// S19-2: bir gün için saat bazlı koltuk doluluğu (restoran paneli).
export interface OccupancySlot { time: string; reserved: number; free: number | null; percent: number | null; band: string }
export interface OccupancyResponse { date: string; seatCapacity: number | null; slots: OccupancySlot[] }

export async function getOccupancy(date: string): Promise<OccupancyResponse> {
  const { data } = await api.get('/restaurant-account/occupancy', { params: { date } });
  return data;
}

// S19-6: kullanıcı talebi için doluluk bandı + yeterlilik (kayıtlı/kapasiteli restoranda).
export interface AvailabilityResponse { known: boolean; band: string; enough: boolean; reserved?: number; free?: number | null }

export async function getAvailability(placeId: string, date: string, time: string, guestCount: number): Promise<AvailabilityResponse> {
  const { data } = await api.get('/reservations/availability', { params: { placeId, date, time, guestCount } });
  return data;
}

/**
 * Müşterinin rezervasyona katılıp katılmadığını işaretler.
 * Katılım durumuna göre yıldız kazandırılır veya ceza verilir.
 *
 * @param id - Rezervasyon ID'si
 * @param attended - Katıldı mı (true) / Gelmedi mi (false)
 * @returns Güncellenmiş rezervasyon
 */
export async function markAttendance(id: string, attended: boolean): Promise<Reservation> {
  const { data } = await api.put(`/reservations/${id}/attendance`, { attended });
  return data;
}

/**
 * Rezervasyona mesaj gönderir (kullanıcı veya restoran).
 * Özel istekler, değişiklik talepleri vb. için kullanılır.
 *
 * @param id - Rezervasyon ID'si
 * @param content - Mesaj içeriği
 * @returns Oluşturulan mesaj
 */
export async function sendReservationMessage(id: string, content: string): Promise<ReservationMessage> {
  const { data } = await api.post(`/reservations/${id}/messages`, { content });
  return data;
}

/**
 * Rezervasyona ait mesaj geçmişini getirir.
 * @param id - Rezervasyon ID'si
 * @returns Mesaj listesi
 */
export async function getReservationMessages(id: string): Promise<ReservationMessage[]> {
  const { data } = await api.get(`/reservations/${id}/messages`);
  return data;
}
