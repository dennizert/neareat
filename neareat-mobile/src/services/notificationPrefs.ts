import api from './api';
import type { NotificationType } from '../types';

export interface NotificationPref {
  type: NotificationType;
  enabled: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPref[]> {
  const { data } = await api.get('/notifications/type-preferences');
  return data.preferences;
}

export async function updateNotificationPreferences(
  preferences: NotificationPref[],
): Promise<{ updated: number }> {
  const { data } = await api.put('/notifications/type-preferences', { preferences });
  return data;
}
