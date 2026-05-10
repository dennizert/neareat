import { create } from 'zustand';
import type { AppNotification } from '../types';
import { getUnreadCount, getNotifications, markAsRead as apiMarkAsRead, markAllAsRead as apiMarkAllRead } from '../services/notifications';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  currentPage: number;

  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: (page?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  hasMore: false,
  loading: false,
  currentPage: 1,

  async fetchUnreadCount() {
    try {
      const count = await getUnreadCount();
      set({ unreadCount: count });
    } catch { /* network hatası — sessizce geç */ }
  },

  async fetchNotifications(page = 1) {
    if (get().loading) return;
    set({ loading: true });
    try {
      const res = await getNotifications(page, 20);
      set({
        notifications: page === 1 ? res.notifications : [...get().notifications, ...res.notifications],
        total: res.total,
        hasMore: res.hasMore,
        currentPage: page,
      });
    } catch { /* sessizce geç */ } finally {
      set({ loading: false });
    }
  },

  async loadMore() {
    const { hasMore, loading, currentPage } = get();
    if (!hasMore || loading) return;
    await get().fetchNotifications(currentPage + 1);
  },

  async markRead(id: string) {
    try {
      await apiMarkAsRead(id);
      set(s => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch { /* sessizce geç */ }
  },

  async markAllRead() {
    try {
      await apiMarkAllRead();
      set(s => ({
        notifications: s.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch { /* sessizce geç */ }
  },

  clear() {
    set({ notifications: [], unreadCount: 0, total: 0, hasMore: false, currentPage: 1 });
  },
}));
