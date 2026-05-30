/**
 * Yemek Günlüğü Servisi (Sprint-7 #93).
 * Backend `/api/diary` endpoint'lerini saran ince katman.
 */
import { MOCK_MODE } from '../config';
import api from './api';

export interface DiaryEntry {
  id: string;
  placeId: string;
  placeName: string;
  placePhotoUrl: string | null;
  placeTypes: string[];
  visitedAt: string;
  note: string | null;
  createdAt: string;
}

export interface DiaryStats {
  totalEntries: number;
  uniquePlaces: number;
  topCuisineTags: { tag: string; count: number }[];
  topPlaces: { placeId: string; placeName: string; count: number }[];
  monthlyCount: { month: string; count: number }[];
  firstVisit: string | null;
  lastVisit: string | null;
}

export interface AddDiaryEntryInput {
  placeId: string;
  placeName: string;
  placePhotoUrl?: string | null;
  placeTypes?: string[];
  note?: string | null;
  visitedAt?: string;
}

export async function addDiaryEntry(input: AddDiaryEntryInput): Promise<DiaryEntry> {
  if (MOCK_MODE) {
    return {
      id: `mock-${Date.now()}`,
      placeId: input.placeId,
      placeName: input.placeName,
      placePhotoUrl: input.placePhotoUrl ?? null,
      placeTypes: input.placeTypes ?? [],
      visitedAt: input.visitedAt ?? new Date().toISOString(),
      note: input.note ?? null,
      createdAt: new Date().toISOString(),
    };
  }
  const { data } = await api.post('/diary', input);
  return data;
}

export async function listDiaryEntries(page = 1, limit = 30): Promise<{
  items: DiaryEntry[]; total: number; page: number; limit: number;
}> {
  if (MOCK_MODE) return { items: [], total: 0, page, limit };
  const { data } = await api.get('/diary', { params: { page, limit } });
  return data;
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  if (MOCK_MODE) return;
  await api.delete(`/diary/${encodeURIComponent(id)}`);
}

export async function getDiaryStats(): Promise<DiaryStats> {
  if (MOCK_MODE) {
    return {
      totalEntries: 0, uniquePlaces: 0,
      topCuisineTags: [], topPlaces: [], monthlyCount: [],
      firstVisit: null, lastVisit: null,
    };
  }
  const { data } = await api.get('/diary/stats');
  return data;
}
