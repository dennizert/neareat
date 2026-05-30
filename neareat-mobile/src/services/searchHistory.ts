/**
 * Arama Geçmişi Servisi (Sprint-6 #88).
 * Backend SearchHistory endpoint'lerini saran ince katman.
 */
import { MOCK_MODE } from '../config';
import api from './api';

export interface SearchHistoryItem {
  id: string;
  query: string;
  type: string | null;
  createdAt: string;
}

export async function getSearchHistory(): Promise<SearchHistoryItem[]> {
  if (MOCK_MODE) return [];
  const { data } = await api.get('/search-history');
  return data.items;
}

/**
 * Kullanıcının tüm arama geçmişini siler (KVKK).
 * @returns silinen kayıt sayısı
 */
export async function clearSearchHistory(): Promise<number> {
  if (MOCK_MODE) return 0;
  const { data } = await api.delete('/search-history');
  return data.deleted;
}

export async function deleteSearchHistoryItem(id: string): Promise<void> {
  if (MOCK_MODE) return;
  await api.delete(`/search-history/${encodeURIComponent(id)}`);
}
