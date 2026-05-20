/**
 * Bildirim Servisi
 *
 * Uygulama içi bildirimlerin listelenmesi, okunmamış sayacı ve
 * okundu işaretleme API çağrılarını yönetir.
 */
import api from './api';
import type { AppNotification } from '../types';

/**
 * Bildirim listesini sayfalı olarak getirir.
 *
 * @param page - Sayfa numarası (varsayılan: 1)
 * @param limit - Sayfa başına bildirim sayısı (varsayılan: 20)
 * @returns Bildirim listesi, toplam sayı ve daha fazla var mı bilgisi
 */
export async function getNotifications(page = 1, limit = 20): Promise<{
  notifications: AppNotification[];
  total: number;
  hasMore: boolean;
}> {
  const { data } = await api.get('/notifications', { params: { page, limit } });
  return data;
}

/**
 * Okunmamış bildirim sayısını getirir.
 * NotificationBell badge'i için kullanılır.
 *
 * @returns Okunmamış bildirim sayısı
 */
export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return data.count;
}

/**
 * Tek bir bildirimi okundu olarak işaretler.
 *
 * @param id - Okundu işaretlenecek bildirimin ID'si
 */
export async function markAsRead(id: string): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

/**
 * Tüm bildirimleri toplu olarak okundu işaretler.
 */
export async function markAllAsRead(): Promise<void> {
  await api.put('/notifications/read-all');
}
