/**
 * Mesajlaşma Servisi
 *
 * Kullanıcılar arası özel mesajlaşma işlemlerini yönetir.
 * Konuşma listesi, mesaj geçmişi (cursor-based pagination), mesaj gönderme,
 * okunmamış sayacı ve kullanıcı raporlama fonksiyonlarını içerir.
 */
import api from './api';
import type { Message, Conversation } from '../types';

/**
 * Kullanıcının tüm konuşmalarını getirir.
 * Son mesaj, okunmamış sayı ve karşı taraf profili dahildir.
 *
 * @returns Konuşma listesi (son mesajlaşılandan başlayarak)
 */
export async function getConversations(): Promise<Conversation[]> {
  const res = await api.get('/messages/conversations');
  return res.data;
}

/**
 * Belirli bir kullanıcıyla olan mesaj geçmişini cursor-based pagination ile getirir.
 * Her sayfada 30 mesaj yüklenir. Daha eski mesajlar için cursor kullanılır.
 *
 * @param userId - Mesajlaşılan kullanıcının ID'si
 * @param cursor - Sonraki sayfa için cursor (opsiyonel — ilk sayfa için gönderilmez)
 * @returns Mesaj listesi, karşı taraf bilgisi, daha fazla mesaj var mı ve sonraki cursor
 */
export async function getMessages(
  userId: string,
  cursor?: string,
): Promise<{ messages: Message[]; otherUser: any; hasMore: boolean; nextCursor: string | null }> {
  const params: Record<string, string> = { limit: '30' };
  if (cursor) params.cursor = cursor;
  const res = await api.get(`/messages/${userId}`, { params });
  return res.data;
}

/**
 * Kullanıcıya mesaj gönderir.
 *
 * @param userId - Mesaj gönderilecek kullanıcının ID'si
 * @param content - Mesaj içeriği
 * @returns Oluşturulan mesaj objesi
 */
export async function sendMessage(userId: string, content: string): Promise<Message> {
  const res = await api.post(`/messages/${userId}`, { content });
  return res.data;
}

/**
 * Toplam okunmamış mesaj sayısını getirir.
 * Tab badge'inde gösterilir — tam konuşma listesi çekmekten daha hafif bir endpoint.
 *
 * @returns Okunmamış mesaj sayısı
 */
export async function getUnreadMessageCount(): Promise<number> {
  const res = await api.get('/messages/unread-count');
  return res.data.count;
}

/**
 * Kullanıcıyı raporlar (şikayet eder).
 * Kötüye kullanım, spam veya uygunsuz davranış durumlarında kullanılır.
 * Admin panelinde değerlendirilir.
 *
 * @param userId - Raporlanan kullanıcının ID'si
 * @param reason - Raporlama sebebi
 */
export async function reportUser(userId: string, reason: string): Promise<void> {
  await api.post(`/social/users/${userId}/report`, { reason });
}
