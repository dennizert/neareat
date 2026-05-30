/**
 * Check-in Servisi (Sprint-7 #91/#92).
 * Backend `/api/checkin` endpoint'lerini saran ince katman.
 */
import { MOCK_MODE } from '../config';
import api from './api';

export interface CheckInResponse {
  id: string;
  placeId: string;
  placeName: string;
  createdAt: string;
  expiresAt: string;
}

export async function createCheckin(placeId: string, placeName: string): Promise<CheckInResponse> {
  if (MOCK_MODE) {
    return {
      id: 'mock-checkin',
      placeId,
      placeName,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    };
  }
  const { data } = await api.post('/checkin', { placeId, placeName });
  return data;
}

export async function getActiveCheckin(): Promise<CheckInResponse | null> {
  if (MOCK_MODE) return null;
  const { data } = await api.get('/checkin/me');
  return data;
}

export async function cancelCheckin(): Promise<number> {
  if (MOCK_MODE) return 0;
  const { data } = await api.delete('/checkin');
  return data.deleted;
}
