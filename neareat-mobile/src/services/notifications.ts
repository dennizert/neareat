import api from './api';
import type { AppNotification } from '../types';

export async function getNotifications(page = 1, limit = 20): Promise<{
  notifications: AppNotification[];
  total: number;
  hasMore: boolean;
}> {
  const { data } = await api.get('/notifications', { params: { page, limit } });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return data.count;
}

export async function markAsRead(id: string): Promise<void> {
  await api.put(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.put('/notifications/read-all');
}
