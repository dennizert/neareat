/**
 * Fotoğraf analizi servisi — mobil istemci (Sprint-7 #95).
 * Backend POST /api/recommendations/analyze-photo endpoint'ini sarar.
 */
import { MOCK_MODE } from '../config';
import api from './api';

export interface PhotoAnalysisResult {
  analysis: string | null;
  model: string | null;
  fallback: boolean;
  remainingToday: number | null;
  resetAt: string | null;
}

export interface PhotoAnalysisLimitError {
  type: 'LIMIT_EXCEEDED';
  remainingToday: 0;
  resetAt: string;
  upgrade: boolean;
}

export async function analyzePhoto(params: {
  imageUrl?: string;
  imageBase64?: string;
  mediaType?: string;
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
}): Promise<PhotoAnalysisResult> {
  if (MOCK_MODE) {
    return {
      analysis: 'Sıcak ışıklandırma ve ahşap detaylar görünüyor — rahat, samimi bir atmosfer. Akşam yemeği için uygun görünüyor.',
      model: 'mock',
      fallback: false,
      remainingToday: 2,
      resetAt: null,
    };
  }
  const { data } = await api.post('/recommendations/analyze-photo', params);
  return data;
}
