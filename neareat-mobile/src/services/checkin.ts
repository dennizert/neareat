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
  /**
   * Konum mekâna yeterince yakın doğrulandı mı? Yalnızca doğrulanmış check-in
   * yıldız kazandıran "ziyaret kanıtı" sayılır (backend starGuards.hasVerifiedVisit).
   */
  verified?: boolean;
  distanceMeters?: number | null;
}

/** POST /checkin gövdesine eklenen konum kanıtı. */
export interface CheckInLocation {
  lat: number;
  lng: number;
  /** Android'de expo-location'ın sahte konum bayrağı. */
  mocked?: boolean;
}

/**
 * Check-in oluşturur. `location` verilmezse check-in yine oluşur (arkadaş bildirimi
 * çalışır) ama backend ziyaret kanıtı saymaz → yorum/puan yıldızı kazandırmaz.
 */
export async function createCheckin(
  placeId: string,
  placeName: string,
  location?: CheckInLocation,
): Promise<CheckInResponse> {
  if (MOCK_MODE) {
    return {
      id: 'mock-checkin',
      placeId,
      placeName,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      verified: true,
      distanceMeters: 0,
    };
  }
  const { data } = await api.post('/checkin', {
    placeId,
    placeName,
    ...(location
      ? { lat: location.lat, lng: location.lng, mocked: location.mocked === true }
      : {}),
  });
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
