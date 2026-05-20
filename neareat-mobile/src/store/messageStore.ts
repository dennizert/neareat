/**
 * Mesajlaşma Store'u (Zustand)
 *
 * Kullanıcıların birbiriyle mesajlaşma özelliğini yönetir:
 * - Konuşma listesi
 * - Okunmamış mesaj sayısı (tab badge'inde gösterilir)
 * - Mesaj gönderildikten sonra konuşma listesini optimistic güncelleme
 * - Konuşma okundu işaretleme
 */
import { create } from 'zustand';
import type { Conversation, Message } from '../types';
import { getConversations, getUnreadMessageCount } from '../services/messages';

interface MessageStore {
  conversations: Conversation[];
  unreadCount: number;
  fetchConversations: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  updateConversationAfterSend: (userId: string, profile: any, message: Message) => void;
  markConversationRead: (userId: string) => void;
  clear: () => void;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  conversations: [],
  unreadCount: 0,

  /**
   * Backend'den tüm konuşma listesini çeker ve okunmamış sayısını hesaplar.
   * Mesajlar tab'ına girildiğinde veya konuşma açıldığında çağrılır.
   */
  fetchConversations: async () => {
    try {
      const conversations = await getConversations();
      const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
      set({ conversations, unreadCount });
    } catch {}
  },

  /**
   * Sadece okunmamış mesaj sayısını çeker.
   * Tab badge'ini güncellemek için kullanılır — tam listeyi çekmekten daha hafif.
   */
  fetchUnreadCount: async () => {
    try {
      const count = await getUnreadMessageCount();
      set({ unreadCount: count });
    } catch {}
  },

  /**
   * Mesaj gönderildikten sonra konuşma listesini optimistic olarak günceller.
   * Backend yanıtı beklenmez — kullanıcı gönderdiği mesajı anında görür.
   * Güncellenen konuşma listenin en üstüne taşınır (en son mesajlaşılan).
   *
   * @param userId - Mesaj gönderilen kullanıcının ID'si
   * @param profile - Karşı tarafın profil bilgisi
   * @param message - Gönderilen mesaj objesi
   */
  updateConversationAfterSend: (userId, profile, message) => {
    set(state => {
      const existing = state.conversations.find(c => c.userId === userId);
      const updated: Conversation = {
        userId,
        profile,
        lastMessage: { content: message.content, createdAt: message.createdAt, isRead: true, isMine: true },
        unreadCount: existing?.unreadCount ?? 0,
      };
      const others = state.conversations.filter(c => c.userId !== userId);
      return { conversations: [updated, ...others] };
    });
  },

  /**
   * Bir konuşmayı okundu olarak işaretler ve global okunmamış sayacını düşürür.
   * Konuşma ekranı açıldığında çağrılır.
   *
   * @param userId - Okundu işaretlenecek konuşmanın karşı taraf ID'si
   */
  markConversationRead: (userId) => {
    set(state => {
      const conv = state.conversations.find(c => c.userId === userId);
      if (!conv || conv.unreadCount === 0) return state;
      const delta = conv.unreadCount;
      return {
        conversations: state.conversations.map(c =>
          c.userId === userId ? { ...c, unreadCount: 0 } : c,
        ),
        unreadCount: Math.max(0, state.unreadCount - delta),
      };
    });
  },

  /** Çıkış yapıldığında tüm mesaj verilerini temizler */
  clear: () => set({ conversations: [], unreadCount: 0 }),
}));
